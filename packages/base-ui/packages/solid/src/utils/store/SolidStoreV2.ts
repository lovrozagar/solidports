import {
  isDisposed,
  createEffect,
  createMemo,
  createSignal,
  getObserver,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor, Signal, Store } from 'solid-js';
import { isServer } from '@solidjs/web';
import { access, createDepsEffect, createDepsMemo } from '../../solid-helpers';
import type { MaybeAccessor, MaybeAccessorValue } from '../../solid-helpers';
import { NOOP } from '../empty';
import { createKeyedSelector } from '../createKeyedSelector';
import { runInLazyScope } from '../runInLazyScope';
import type { SetStoreFunction } from '../../solid-1-compat';

const storeBinders = new WeakMap<
  object,
  (key: PropertyKey, source: BindingSource, clearOnCleanup: boolean) => void
>();
// Starts the derived-key notifiers of a store for the given keys (`true`: every key).
const storeActivators = new WeakMap<object, (keys: Iterable<PropertyKey> | true) => void>();
// Notifies a store's listeners (`observe`) without a write.
const storeNotifiers = new WeakMap<object, () => void>();

interface KeyedSelectorShape {
  /** Reads the current id. Selectors declared with the same function share one projection. */
  key: (state: any) => unknown;
  /** Read only once `id` is the current one. */
  gate: ((state: any) => boolean) | undefined;
}

// The key and gate of each selector declared with `keyedSelector`.
const keyedSelectorKeys = new WeakMap<Function, KeyedSelectorShape>();

/**
 * A selector answering "is `id` the store's current one", where `key` reads the current one
 * (`undefined` for none), and, with `gate`, "and does `gate` hold". Declared keyed, a tracked
 * `select` of it subscribes the reader to `id` only: when the current one moves, the readers of
 * the old and the new id re-run, not every reader, and only the current id's readers read `gate`.
 * Selectors declared with the same `key` function share one projection: a popup trigger reads
 * three of the active trigger id. Any other read (untracked, the server, `observe`) calls it as a
 * plain selector.
 */
export function keyedSelector<State extends object, Id = string>(
  key: (state: State) => Id | null | undefined,
  gate?: (state: State) => boolean,
) {
  const selector = (state: State, id: Accessor<Id | undefined>) => {
    const value = id();
    return value !== undefined && key(state) === value && (gate === undefined || gate(state));
  };
  keyedSelectorKeys.set(selector, { key, gate });
  return selector;
}

type KeyedSelector = (state: any, id: Accessor<unknown>) => boolean;

/**
 * A Store that supports controlled state keys, non-reactive values and provides utility methods for React.
 */
export function SolidStore<
  State extends object,
  Context extends object = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
>(
  initialState: State | [Store<State>, SetStoreFunction<State>],
  initialContext: Context = {} as Context,
  selectors?: Selectors,
): SolidStore<State, Context, Selectors> {
  let controlledValues: Map<keyof State, boolean> | undefined;
  const context = initialContext;
  const [state, setState] = createInitialStore(initialState);
  // Keyed selectors' memberships (`keyedSelector`), one per key function, created when its current
  // id first changes, in a lazy scope of the owner the store was created under: they live as long as
  // the store and are disposed with it. Until then readers compare directly, subscribed to what the
  // current id reads, and `firstKeys` holds the id they first saw: a store whose current id never
  // moves (every closed popup root) creates nothing, and the first change, which re-runs every
  // reader as a plain selector would, moves them onto the projection, so later changes re-run only
  // the old and the new id's readers. A store created outside any owner reads them directly: those
  // are the handles' inert stand-ins (`NullStore`), whose state never changes, and an ownerless
  // projection would be an error when the first read comes from an effect callback.
  const storeOwner = getOwner();
  const memberships = new Map<Function, (id: unknown) => boolean>();
  const firstKeys = new Map<Function, unknown>();

  function selectKeyed(selector: KeyedSelector, id: Accessor<unknown>): boolean {
    if (isServer || storeOwner === null || getObserver() === null || isDisposed(storeOwner)) {
      return selector(state, id);
    }
    const { key, gate } = keyedSelectorKeys.get(selector)!;
    // Read after the key matched: only the current id's readers subscribe to it.
    const passes = () => gate === undefined || gate(state);
    let isCurrent = memberships.get(key);
    if (isCurrent === undefined) {
      // Compared untracked: the reader that sees the change reads through the projection only, so
      // it does not stay subscribed to the raw current id.
      const current = untrack(() => key(state));
      if (!firstKeys.has(key)) {
        firstKeys.set(key, current);
      }
      if (Object.is(firstKeys.get(key), current)) {
        // Subscribes to what the current id reads, so its first change re-runs this reader.
        key(state);
        const value = id();
        return value !== undefined && current === value && passes();
      }
      firstKeys.delete(key);
      isCurrent = runInLazyScope(storeOwner, () =>
        createKeyedSelector(() => {
          const next = key(state);
          return next === undefined ? [] : [next];
        }),
      );
      memberships.set(key, isCurrent);
    }
    const value = id();
    return value !== undefined && isCurrent(value) && passes();
  }

  function update<const Key extends keyof State>(statePart: Pick<State, Key>) {
    setState(statePart as any);
  }

  function set<Key extends keyof State>(key: Key, value: State[Key]) {
    setState(key as any, value as any);
  }

  /**
   * Keeps `key` equal to `value`, as React's `useSyncedValue` re-syncs it on every render. The key
   * is derived from `value` (a writable memo) rather than copied by an effect, so readers see the
   * synced value in the same flush as its source. A `set` overrides it until `value` changes.
   */
  function useSyncedValue<Key extends keyof State>(
    key: Key,
    value: Accessor<State[Key]> | ((prev: State[Key]) => State[Key]),
  ) {
    bindStoreKey(state, setState, key, value as BindingSource);
  }

  function useSyncedValueWithCleanup<Key extends KeysAllowingUndefined<State>>(
    key: Key,
    value: Accessor<State[Key]>,
  ) {
    bindStoreKey(state, setState, key, value, { clearOnCleanup: true });
  }

  function useSyncedValues<const Keys extends keyof State>(
    statePart: Accessor<Pick<State, Keys>> | { [Key in Keys]: MaybeAccessor<State[Key]> },
  ) {
    if (process.env.NODE_ENV !== 'production') {
      createEffect(
        () => Object.keys(access(statePart) as object),
        (next, prev) => {
          if (
            prev !== undefined &&
            (prev.length !== next.length || prev.some((key, index) => key !== next[index]))
          ) {
            console.error(
              'SolidStore.useSyncedValues expects the same prop keys on every render. Keys should be stable.',
            );
          }
        },
      );
    }

    if (!storeBinders.has(state)) {
      // A store created elsewhere: copy the entries. As React, depend on the entries rather than
      // on the object identity.
      createDepsEffect(
        () => readSyncedSnapshot(statePart as any),
        (snapshot) => {
          setState(snapshot as any);
        },
      );
      return;
    }

    // As React, the entries are synced together: a change to any entry re-syncs every key (React
    // writes the whole part), which also drops values `set` over them since. A change of object
    // identity alone does not. Keys are stable (checked above).
    const snapshot = createDepsMemo(() => readSyncedSnapshot(statePart as any));
    for (const key of Object.keys(untrack(snapshot))) {
      bindStoreKey(state, setState, key as keyof State, () => snapshot()[key]);
    }
  }

  function readSyncedSnapshot(
    statePart: Accessor<Partial<State>> | Partial<{ [key: string]: MaybeAccessor<unknown> }>,
  ) {
    const part = access(statePart) as Record<string, unknown>;
    const snapshot: Record<string, unknown> = {};
    // eslint-disable-next-line guard-for-in
    for (const key in part) {
      snapshot[key] = access(part[key]);
    }
    return snapshot;
  }

  function useControlledProp<Key extends keyof State, Value extends State[Key]>(
    key: Key,
    controlledProp: Value | Accessor<Value | undefined> | undefined,
  ): void {
    // The binding below is the key's only derivation, so the prop is read there directly.
    const controlled = () => access(controlledProp);

    // React writes a defined controlled value into the store in a layout effect. Solid derives it:
    // the key follows the controlled value while there is one, and keeps the store's own value
    // (written by uncontrolled updates) otherwise.
    bindStoreKey(state, setState, key, (prev) => {
      const value = controlled();
      return value !== undefined ? value : prev;
    });

    if (process.env.NODE_ENV !== 'production') {
      createEffect(
        () => controlled() !== undefined,
        (currentlyControlled, previouslyControlled) => {
          controlledValues ??= new Map<keyof State, boolean>();
          const cache = controlledValues;
          if (!cache.has(key)) {
            cache.set(key, currentlyControlled);
          }

          const cached = cache.get(key);
          if (
            previouslyControlled !== undefined &&
            cached !== undefined &&
            cached !== currentlyControlled
          ) {
            console.error(
              `A component is changing the ${
                currentlyControlled ? '' : 'un'
              }controlled state of ${key.toString()} to be ${currentlyControlled ? 'un' : ''}controlled. Elements should not switch from uncontrolled to controlled (or vice versa).`,
            );
          }
        },
      );
    }
  }

  function select<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]> {
    if (!selectors) {
      throw new Error('Base UI: SolidStore.select called but no selectors were provided.');
    }
    const selector = selectors[key];
    if (keyedSelectorKeys.has(selector)) {
      return selectKeyed(selector as KeyedSelector, args[0] as Accessor<unknown>) as ReturnType<
        Selectors[Key]
      >;
    }
    return selector(state, ...args);
  }

  function useState<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): Accessor<MaybeAccessorValue<ReturnType<Selectors[Key]>>> {
    // A tracked read of a key, or of a selector that returns one key as is, subscribes the reader
    // to that key directly: the key's signal already notifies only on change, so a memo would only
    // add a node. A derived selector reads through a memo created on the first tracked read, under
    // this call's owner (transparent, see `runInLazyScope`): dependents re-run only when the
    // selected value changes (React's selector equality), and a value read only by handlers costs no
    // computation. Untracked reads compute directly and see the latest write.
    const selector = selectors && key in selectors ? selectors[key] : undefined;
    const directKey = selector ? directSelectorKey(selector) : key;
    if (directKey !== undefined) {
      const read =
        selector === undefined
          ? () => access(state[directKey as keyof State]) as any
          : () => state[directKey as keyof State] as any;
      return () => (getObserver() === null ? untrack(read) : read());
    }
    const compute = keyedSelectorKeys.has(selector!)
      ? () => select(key, ...args)
      : () => selector!(state, ...args);
    const owner = getOwner();
    let selected: Accessor<any> | undefined;
    return () => {
      if (getObserver() === null) {
        return untrack(compute);
      }
      selected ??= runWithOwner(owner, () =>
        createMemo(compute, { transparent: true }),
      ) as Accessor<any>;
      return selected();
    };
  }

  function useContextCallback<Key extends ContextFunctionKeys<Context>>(
    key: Key,
    fn: NoInfer<ContextFunction<Context, Key>> | undefined,
  ) {
    (context as any)[key] = fn ?? (NOOP as ContextFunction<Context, Key>);
  }

  function useStateSetter<const Key extends keyof State, Value extends State[Key]>(key: Key) {
    // Used as a ref setter. Solid 2 can attach a replacement element before the previous one's
    // cleanup clears it (React detaches first), so a clear only applies to the value this setter
    // wrote.
    let written: Value | undefined;
    return (value: Value) => {
      if (value == null && written != null && !Object.is(state[key], written)) {
        written = undefined;
        return;
      }
      written = value;
      setState(key as any, value as any);
    };
  }

  function observe<Key extends keyof Selectors>(
    selector: Key,
    listener: (
      newValue: ReturnType<Selectors[Key]>,
      oldValue: ReturnType<Selectors[Key]>,
      store: SolidStore<State, Context, Selectors>,
    ) => void,
  ): () => void;

  function observe<Selector extends ObserveSelector<State>>(
    selector: Selector,
    listener: (
      newValue: ReturnType<Selector>,
      oldValue: ReturnType<Selector>,
      store: SolidStore<State, Context, Selectors>,
    ) => void,
  ): () => void;

  function observe(
    selector: keyof Selectors | ObserveSelector<State>,
    listener: (newValue: any, oldValue: any, store: SolidStore<State, Context, Selectors>) => void,
  ) {
    let selectFn: ObserveSelector<State>;
    if (typeof selector === 'function') {
      selectFn = selector;
    } else {
      if (!selectors) {
        throw new Error('Base UI: SolidStore.observe with key selector requires selectors.');
      }
      selectFn = selectors[selector] as ObserveSelector<State>;
    }

    // As React's Store: called once with the current value, then synchronously after every
    // write that changes the selected value. Selection is untracked; this is not a computation.
    // The keys a selection reads are recorded, so only their derived values (`useSyncedValue`)
    // notify: a store observed for one key does not watch every bound key.
    const watchKeys = storeActivators.get(state);
    const selectValue = (current: State) => {
      if (!watchKeys) {
        return untrack(() => selectFn(current));
      }
      const keys = new Set<PropertyKey>();
      let everyKey = false;
      const recorder = new Proxy(current, {
        get: (target, key) => {
          keys.add(key);
          return Reflect.get(target, key);
        },
        has: (target, key) => {
          keys.add(key);
          return Reflect.has(target, key);
        },
        ownKeys: (target) => {
          everyKey = true;
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor: (target, key) => {
          everyKey = true;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      const value = untrack(() => selectFn(recorder));
      watchKeys(everyKey ? true : keys);
      return value;
    };
    let prevValue = selectValue(state);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- the store object lists `observe` itself; the listener runs after it is built
    listener(prevValue, prevValue, store);

    return subscribeToStore(state, (nextState) => {
      const nextValue = selectValue(nextState);
      if (!Object.is(prevValue, nextValue)) {
        const oldValue = prevValue;
        prevValue = nextValue;
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- the store object lists `observe` itself; the listener runs after it is built
        listener(nextValue, oldValue, store);
      }
    });
  }

  /**
   * Notifies every listener (`observe`) as a write would, for state a selector derives from outside
   * the store (React's `notifyAll()`). Solid's state is one proxy, so its reference does not change.
   */
  function notifyAll() {
    storeNotifiers.get(state)?.();
  }

  const store = {
    context,
    notifyAll,
    observe,
    select,
    set,
    setState,
    state,
    update,
    useContextCallback,
    useControlledProp,
    useState,
    useStateSetter,
    useSyncedValue,
    useSyncedValueWithCleanup,
    useSyncedValues,
  };
  return store;
}

const directSelectorKeys = new WeakMap<Function, PropertyKey | null>();
const NO_KEY = Symbol('no key');

/**
 * The key a selector returns as is (`(state) => state.mounted`), or `undefined` for a selector that
 * derives its value. Found once per selector by running it over a recording state twice, with every
 * key holding a unique marker and then `undefined`: a direct selector reads exactly one key and
 * returns its value both times, so fallbacks (`state.a ?? state.b`) and derivations are excluded.
 */
function directSelectorKey(selector: Function): PropertyKey | undefined {
  let key = directSelectorKeys.get(selector);
  if (key === undefined) {
    key = selector.length === 1 ? probeSelector(selector, true) : null;
    if (key !== null && probeSelector(selector, false) !== key) {
      key = null;
    }
    directSelectorKeys.set(selector, key);
  }
  return key === null ? undefined : key;
}

function probeSelector(selector: Function, marked: boolean): PropertyKey | null {
  let read: PropertyKey = NO_KEY;
  let reads = 0;
  const marker = {};
  const probe = new Proxy(
    {},
    {
      get(_, key) {
        reads += 1;
        read = key;
        return marked ? marker : undefined;
      },
    },
  );
  try {
    const result = selector(probe);
    return reads === 1 && result === (marked ? marker : undefined) ? read : null;
  } catch {
    return null;
  }
}

function createInitialStore<State extends object>(
  initialState: State | [Store<State>, SetStoreFunction<State>],
) {
  if (Array.isArray(initialState)) {
    return initialState;
  }
  return createStoreState(initialState);
}

const storeListeners = new WeakMap<object, Set<(state: any) => void>>();

/**
 * Subscribes to every write of a store created by `createStoreState`, as React's
 * `Store.subscribe`: listeners run synchronously after each change, with the latest state.
 */
function subscribeToStore<State extends object>(state: State, listener: (state: State) => void) {
  const listeners = storeListeners.get(state);
  if (!listeners) {
    return NOOP;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const BINDING = Symbol('binding');

/**
 * Creates the backing state of a Base UI store, with the semantics of React's Store:
 *
 * - Per key: each key is one signal holding its value by reference. Values are prop bags,
 *   elements and records replaced wholesale, as React stores them; a tracked read subscribes to
 *   the keys it reads and nothing below them.
 * - Synchronous: Solid batches writes until the next flush, while Base UI reads its store right
 *   after writing it (`set` then `select` in one handler). Untracked reads (handlers, effect
 *   callbacks, store methods) see the latest written value at once. Tracked reads see the
 *   committed value, so rendering stays consistent within a flush.
 * - External: `set` is valid anywhere, including unmount cleanups that Solid runs while a parent
 *   computation disposes its children.
 *
 * Getter fields stay live (called on the state) and are never written.
 */
export function createStoreState<State extends object>(
  initialState: State,
): [Store<State>, SetStoreFunction<State>] {
  const computedGetters = new Map<PropertyKey, () => unknown>();
  const descriptors = Object.getOwnPropertyDescriptors(initialState);
  for (const key of Reflect.ownKeys(descriptors)) {
    const getter = descriptors[key as keyof typeof descriptors]?.get;
    if (getter) {
      computedGetters.set(key, getter);
    }
  }
  const computedKeys = new Set(computedGetters.keys());

  // The committed value of each key, one signal per key created on first use. A box, so a function
  // value is held rather than called. Ownerless: the store outlives the owner that first reads it.
  const slots = new Map<PropertyKey, Signal<{ value: unknown }>>();
  // Plain keys (and their insertion order), and a signal for readers of the key set.
  const committedKeys = new Set<PropertyKey>(
    Reflect.ownKeys(initialState).filter((key) => !computedKeys.has(key)),
  );
  const [keySet, setKeySet] = runWithOwner(null, () =>
    createSignal(0, { ownedWrite: true }),
  ) as Signal<number>;

  // Keys derived from a source accessor (`useSyncedValue`): a writable memo per key.
  const bindings = new Map<PropertyKey, Binding>();

  /** What a key's slot starts out holding: its binding if bound before its first read. */
  const unslotted = (key: PropertyKey) =>
    bindings.get(key) ??
    (Object.hasOwn(initialState, key)
      ? (initialState as Record<PropertyKey, unknown>)[key]
      : undefined);

  function slot(key: PropertyKey) {
    let current = slots.get(key);
    if (!current) {
      const initial = unslotted(key);
      current = runWithOwner(null, () =>
        createSignal(
          { value: initial },
          { equals: false, ownedWrite: true, name: `store.${String(key)}` },
        ),
      ) as Signal<{ value: unknown }>;
      slots.set(key, current);
    }
    return current;
  }

  const readSlot = (key: PropertyKey) => slot(key)[0]().value;
  /**
   * A key's committed value without creating its slot: a slot is created for a subscriber or a
   * write, never for an untracked read (a closed popup root binds about 20 keys nothing reads).
   */
  const peekSlot = (key: PropertyKey) => {
    const existing = slots.get(key);
    return existing ? untrack(existing[0]).value : unslotted(key);
  };

  function writeSlot(key: PropertyKey, value: unknown) {
    if (isServer) {
      // Server state is the recorded latest values: signals are never written there.
      committedKeys.add(key);
      return;
    }
    runWithOwner(null, () =>
      untrack(() => {
        slot(key)[1]({ value });
        if (!committedKeys.has(key)) {
          committedKeys.add(key);
          setKeySet((version) => version + 1);
        }
      }),
    );
  }

  // Latest value of every written key. Equal to the committed value once a flush applies it.
  const written = new Map<PropertyKey, unknown>();

  // Bound keys whose derived changes notify listeners; `true` once a listener reads every key.
  let watched: Set<PropertyKey> | true | undefined;

  const latest = (key: PropertyKey) => {
    if (written.has(key)) {
      return written.get(key);
    }
    return untrack(() => {
      const getter = computedGetters.get(key);
      if (getter) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- the state proxy reads through `latest`; both exist before any read
        return getter.call(state);
      }
      const binding = bindings.get(key);
      const value = binding ? binding.value() : peekSlot(key);
      return isBinding(value) ? value.value() : value;
    });
  };

  const listeners = new Set<(state: State) => void>();
  // Internal state to handle recursive writes from listeners, as React's Store.
  let updateTick = 0;

  const descriptorFor = (value: unknown): PropertyDescriptor => ({
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });

  const state: State = new Proxy({} as State, {
    get(_, key) {
      // The server renders once: every read is the latest value, with nothing to subscribe to.
      if (getObserver() !== null && !isServer) {
        const getter = computedGetters.get(key);
        if (getter) {
          return getter.call(state);
        }
        // A bound key's slot holds its binding: readers subscribe to the slot (so unbinding
        // notifies them) and to the derived value. The binding comes from `bindings`, not from the
        // slot: a key bound in this pass has its slot write pending until the flush, and readers
        // in the same pass must already see the derived value (React syncs during render).
        const value = readSlot(key);
        const binding = bindings.get(key);
        if (binding) {
          return binding.value();
        }
        return isBinding(value) ? value.value() : value;
      }
      // An untracked read is an imperative store read (handler, effect callback, store method).
      return latest(key);
    },
    // Enumeration (spreads, `Object.keys`) sees the same latest values as untracked reads.
    has(_, key) {
      if (computedKeys.has(key)) {
        return true;
      }
      if (getObserver() === null || isServer) {
        return written.has(key) || committedKeys.has(key);
      }
      keySet();
      return committedKeys.has(key);
    },
    ownKeys() {
      const tracked = getObserver() !== null && !isServer;
      if (tracked) {
        keySet();
      }
      const keys: PropertyKey[] = [...committedKeys, ...computedKeys];
      if (!tracked) {
        written.forEach((_, key) => {
          if (!committedKeys.has(key)) {
            keys.push(key);
          }
        });
      }
      // Numeric keys are reported as strings, as property keys.
      return keys.map((key) => (typeof key === 'number' ? String(key) : key)) as (
        string | symbol
      )[];
    },
    getOwnPropertyDescriptor(_, key) {
      const getter = computedGetters.get(key);
      if (getter) {
        return { configurable: true, enumerable: true, get: () => getter.call(state) };
      }
      if (getObserver() !== null && !isServer) {
        keySet();
        if (!committedKeys.has(key)) {
          return undefined;
        }
        const value = readSlot(key);
        return descriptorFor(isBinding(value) ? value.value() : value);
      }
      if (!written.has(key) && !committedKeys.has(key)) {
        return undefined;
      }
      return descriptorFor(latest(key));
    },
  });

  function commit(patch: Record<PropertyKey, unknown>) {
    const changes: Array<[PropertyKey, unknown]> = [];
    for (const key of Reflect.ownKeys(patch)) {
      const value = patch[key as keyof typeof patch];
      if (computedKeys.has(key) || Object.is(latest(key), value)) {
        continue;
      }
      written.set(key, value);
      changes.push([key, value]);
    }
    if (changes.length === 0) {
      return;
    }
    const plainChanges = changes.filter(([key]) => !bindings.has(key));
    // The write runs outside any owner (see above), and untracked.
    runWithOwner(null, () =>
      untrack(() => {
        // The server reads the recorded values (`written`); it never writes signals.
        if (!isServer) {
          for (const [key, value] of changes) {
            bindings.get(key)?.setValue(value);
          }
        }
        for (const [key, value] of plainChanges) {
          writeSlot(key, value);
        }
      }),
    );
    notify();
  }

  function notify() {
    updateTick += 1;
    const currentTick = updateTick;
    for (const listener of Array.from(listeners)) {
      if (currentTick !== updateTick) {
        // A recursive write has already notified all listeners.
        return;
      }
      listener(state);
    }
  }

  function setState(...args: unknown[]) {
    if (args.length >= 2) {
      // React's `store.set(key, value)`: a function value is stored as is, not called.
      commit({ [args[0] as PropertyKey]: args[1] });
      return;
    }
    const [arg] = args;
    if (typeof arg === 'function') {
      // Draft form: reads see the latest values, writes collect into one patch.
      const patch: Record<PropertyKey, unknown> = {};
      const draft = new Proxy(patch, {
        get: (_, key) => (key in patch ? patch[key as string] : latest(key)),
        set: (_, key, value) => {
          patch[key as string] = value;
          return true;
        },
      });
      const result = (arg as (draft: State) => unknown)(draft as State);
      commit(result != null && typeof result === 'object' ? (result as any) : patch);
      return;
    }
    if (arg != null && typeof arg === 'object') {
      commit(arg as Record<PropertyKey, unknown>);
    }
  }

  function bind(key: PropertyKey, source: BindingSource, clearOnCleanup: boolean) {
    if (computedKeys.has(key)) {
      // A getter field is already live, and `set` ignores it.
      return;
    }
    // Re-deriving from `source` drops an override written with `set` (React re-syncs on render).
    // The first derivation sees the key's value from before binding as `prev`.
    let unbound: { value: unknown } | null = { value: latest(key) };
    // The derived signal is created on first access, under the owner the key is bound under: a
    // key nobody reads (most popup keys while the popup is closed) costs no computation. It is
    // transparent, as a node created on first read would take the owner's next hydration id (see
    // `runInLazyScope`). The server, which renders once and never writes signals, computes the
    // value directly: its derived signals would take hydration ids (they ignore `transparent`).
    const owner = getOwner();
    let derived: Signal<unknown> | undefined;
    const signal = () => {
      derived ??= runWithOwner(owner, () =>
        createSignal<unknown>(
          (prev: unknown) => {
            const next = source(unbound ? unbound.value : prev);
            unbound = null;
            written.delete(key);
            return next;
          },
          { name: `store.${String(key)}`, transparent: true },
        ),
      ) as Signal<unknown>;
      return derived;
    };
    const peek = () =>
      derived ? untrack(derived[0]) : untrack(() => source(unbound ? unbound.value : undefined));
    // Read for the first time after its owner disposed (another part's teardown reading the key
    // before this binding's cleanup runs): computed directly, nothing is created under it.
    const ownerGone = () => owner !== null && isDisposed(owner);
    const binding: Binding = {
      [BINDING]: true,
      value: () => (!isServer && (derived || !ownerGone()) ? signal()[0]() : peek()),
      setValue: (next: unknown) => {
        if (derived || !ownerGone()) {
          signal()[1](() => next);
        }
      },
      peek,
    };
    bindings.set(key, binding);
    written.delete(key);
    if (slots.has(key)) {
      writeSlot(key, binding);
    } else if (!committedKeys.has(key)) {
      // No reader yet: the slot is created holding the binding on first read.
      committedKeys.add(key);
      if (!isServer) {
        runWithOwner(null, () => untrack(() => setKeySet((version) => version + 1)));
      }
    }

    // Listeners (`observe`) see derived changes too, as they saw the synced writes. The notifier
    // is an effect per bound key, so it is created only once a listener reads the key (most
    // stores never have one).
    binding.owner = getOwner();
    if (watched === true || watched?.has(key)) {
      startNotifier(binding);
    }

    void onCleanup(() => {
      if (bindings.get(key) !== binding) {
        return;
      }
      // Unbinding keeps the latest value (or clears it), as React's store keeps the synced value.
      // A binding never read is computed directly: nothing is created while its owner disposes.
      let last: unknown;
      if (!clearOnCleanup) {
        last = written.has(key) ? written.get(key) : binding.peek();
      }
      bindings.delete(key);
      written.set(key, last);
      writeSlot(key, last);
      if (clearOnCleanup) {
        notify();
      }
    });
  }

  function startNotifier(binding: Binding) {
    // Server state never changes after a write, which notifies directly.
    if (binding.notifying || isServer) {
      return;
    }
    binding.notifying = true;
    // The value at activation is the baseline, so a change before the effect's first run still
    // notifies.
    const initial = untrack(binding.value);
    runWithOwner(binding.owner ?? null, () => {
      // Transparent: created when a listener first reads the key (see `runInLazyScope`).
      createEffect(
        binding.value,
        (next, prev) => {
          const before = prev === undefined ? initial : prev;
          if (!Object.is(next, before)) {
            notify();
          }
        },
        { transparent: true },
      );
    });
  }

  storeActivators.set(state, (keys) => {
    if (watched === true) {
      return;
    }
    // A getter field reads other keys through the store itself: watch every key.
    if (keys === true || [...keys].some((key) => computedKeys.has(key))) {
      watched = true;
      bindings.forEach(startNotifier);
      return;
    }
    watched ??= new Set();
    for (const key of keys) {
      if (!watched.has(key)) {
        watched.add(key);
        const binding = bindings.get(key);
        if (binding) {
          startNotifier(binding);
        }
      }
    }
  });
  storeListeners.set(state, listeners);
  storeNotifiers.set(state, notify);
  storeBinders.set(state, bind);
  return [state as Store<State>, setState as unknown as SetStoreFunction<State>];
}

/** A synced value's source. It receives the key's previous value (or the value last `set`). */
type BindingSource = (prev: unknown) => unknown;

interface Binding {
  [BINDING]: true;
  value: Accessor<unknown>;
  setValue: (value: unknown) => void;
  /** The current value, untracked, without creating the derived signal. */
  peek: () => unknown;
  /** The owner the key was bound under; its notifier is created there on demand. */
  owner?: ReturnType<typeof getOwner> | undefined;
  notifying?: boolean | undefined;
}

function isBinding(value: unknown): value is Binding {
  return typeof value === 'object' && value !== null && BINDING in value;
}

/**
 * Derives a store key from `source` for the lifetime of the current owner.
 */
function bindStoreKey<State extends object>(
  state: State,
  setState: SetStoreFunction<State>,
  key: keyof State,
  source: BindingSource,
  options: { clearOnCleanup?: boolean | undefined } = {},
) {
  const bind = storeBinders.get(state);
  if (bind) {
    bind(key, source, options.clearOnCleanup ?? false);
    return;
  }
  // A store created elsewhere: copy the value.
  createEffect(
    () => source(undefined),
    (next) => {
      (setState as any)(key, next);
    },
  );
  if (options.clearOnCleanup) {
    void onCleanup(() => (setState as any)(key, undefined));
  }
}

type MaybeCallable = (...args: any[]) => any;

type ContextFunctionKeys<Context> = {
  [Key in keyof Context]-?: Extract<Context[Key], MaybeCallable> extends never ? never : Key;
}[keyof Context];

type ContextFunction<Context, Key extends keyof Context> = Extract<Context[Key], MaybeCallable>;

type KeysAllowingUndefined<State> = {
  [Key in keyof State]-?: undefined extends State[Key] ? Key : never;
}[keyof State];

type ObserveSelector<State> = (state: State) => any;

type SelectorFunction<State, Args extends any[] = any[]> = (state: State, ...args: Args) => any;

type Tail<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : [];

export type SelectorArgs<Selector> = Selector extends (...params: infer Params) => any
  ? Tail<Params>
  : never;

/**
 * A store `SolidStore` creates. Declared rather than inferred: `observe` hands its listener the
 * store itself, and an inferred type that refers to itself cannot be written into declarations.
 */
export type SolidStore<
  State extends object,
  Context extends object = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> = SolidStoreInstance<State, Context, Selectors>;

/**
 * The store's shape, typed as a class as React's `ReactStore` is (a type only: the factory builds
 * a plain object). Type tools treat a class's methods as behavior rather than data: docs-infra's
 * API extraction expands a store's data members but not its methods, so a prop typed by a store
 * handle (`Menu.Trigger`'s `handle`) no longer expands every method's signature, each of which
 * names the store again. A spread copy (`{ ...store }`) is typed without the methods, so stores add
 * members with `Object.assign(store, ...)`, keeping one object as React keeps one instance.
 */
export declare class SolidStoreInstance<
  State extends object,
  Context extends object = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> {
  context: Context;
  notifyAll(): void;
  observe<Key extends keyof Selectors>(
    selector: Key,
    listener: (
      newValue: ReturnType<Selectors[Key]>,
      oldValue: ReturnType<Selectors[Key]>,
      store: SolidStore<State, Context, Selectors>,
    ) => void,
  ): () => void;
  observe<Selector extends ObserveSelector<State>>(
    selector: Selector,
    listener: (
      newValue: ReturnType<Selector>,
      oldValue: ReturnType<Selector>,
      store: SolidStore<State, Context, Selectors>,
    ) => void,
  ): () => void;
  select<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]>;
  set<Key extends keyof State>(key: Key, value: State[Key]): void;
  setState: SetStoreFunction<State>;
  state: State;
  update<const Key extends keyof State>(statePart: Pick<State, Key>): void;
  useContextCallback<Key extends ContextFunctionKeys<Context>>(
    key: Key,
    fn: NoInfer<ContextFunction<Context, Key>> | undefined,
  ): void;
  useControlledProp<Key extends keyof State, Value extends State[Key]>(
    key: Key,
    controlledProp: Value | Accessor<Value | undefined> | undefined,
  ): void;
  useState<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): Accessor<MaybeAccessorValue<ReturnType<Selectors[Key]>>>;
  useStateSetter<const Key extends keyof State, Value extends State[Key]>(
    key: Key,
  ): (value: Value) => void;
  useSyncedValue<Key extends keyof State>(
    key: Key,
    value: Accessor<State[Key]> | ((prev: State[Key]) => State[Key]),
  ): void;
  useSyncedValueWithCleanup<Key extends KeysAllowingUndefined<State>>(
    key: Key,
    value: Accessor<State[Key]>,
  ): void;
  useSyncedValues<const Keys extends keyof State>(
    statePart: Accessor<Pick<State, Keys>> | { [Key in Keys]: MaybeAccessor<State[Key]> },
  ): void;
}
