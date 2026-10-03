/* eslint-disable typescript/no-explicit-any -- generic store accepts arbitrary state/context/selector shapes; `unknown` would force casts at every internal write */
import {
  createEffect,
  createMemo,
  createSignal,
  createStore,
  getObserver,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Store } from 'solid-js';
import {
  access,
  createDepsEffect,
  createDepsMemo,
  type MaybeAccessor,
  type MaybeAccessorValue,
} from '../../solid-helpers';
import { NOOP } from '../empty';
import type { SetStoreFunction } from '../../solid-1-compat';

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
) {
  let controlledValues: Map<keyof State, boolean> | undefined;
  const context = initialContext;
  const [state, setState] = createInitialStore(initialState);

  function update(statePart: Partial<State>) {
    setState(statePart as any);
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

  function useSyncedValues<Keys extends keyof State>(
    statePart: Accessor<Partial<State>> | Partial<{ [Key in Keys]: MaybeAccessor<State[Key]> }>,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      const keys = createMemo(() => Object.keys(access(statePart) as object));
      createEffect(keys, (next, prev) => {
        if (
          prev !== undefined &&
          (prev.length !== next.length || prev.some((key, index) => key !== next[index]))
        ) {
          console.error(
            'SolidStore.useSyncedValues expects the same prop keys on every render. Keys should be stable.',
          );
        }
      });
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
    key: keyof State,
    controlledProp: Value | Accessor<Value | undefined> | undefined,
  ): void {
    const controlled = createMemo(() => access(controlledProp));

    // React writes a defined controlled value into the store in a layout effect. Solid derives it:
    // the key follows the controlled value while there is one, and keeps the store's own value
    // (written by uncontrolled updates) otherwise.
    bindStoreKey(state, setState, key, (prev) => {
      const value = controlled();
      return value !== undefined ? value : prev;
    });

    if (process.env.NODE_ENV !== 'production') {
      const isControlled = createMemo(() => controlled() !== undefined);
      createEffect(isControlled, (currentlyControlled, previouslyControlled) => {
        const cache = (controlledValues ??= new Map<keyof State, boolean>());
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
      });
    }
  }

  function select<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]> {
    if (!selectors) {
      throw new Error('Base UI: SolidStore.select called but no selectors were provided.');
    }
    return selectors[key](state, ...args);
  }

  function useState<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): Accessor<MaybeAccessorValue<ReturnType<Selectors[Key]>>> {
    if (selectors && key in selectors) {
      // Tracked reads go through a memo, so dependents re-run only when the selected value changes
      // (React's selector equality). Untracked reads compute directly and see the latest write.
      const selected = createMemo(() => selectors[key](state, ...args));
      return () => (getObserver() === null ? selectors[key](state, ...args) : selected());
    }

    // eslint-disable-next-line solid/reactivity
    return createMemo(() => access(state[key as unknown as keyof State]) as any);
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
    let prevValue = untrack(() => selectFn(state));
    listener(prevValue, prevValue, store);

    return subscribeToStore(state, (nextState) => {
      const nextValue = untrack(() => selectFn(nextState));
      if (!Object.is(prevValue, nextValue)) {
        const oldValue = prevValue;
        prevValue = nextValue;
        listener(nextValue, oldValue, store);
      }
    });
  }

  const store = {
    context,
    observe,
    select,
    set: setState,
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

/**
 * Creates the backing state of a Base UI store, with the semantics of React's Store:
 *
 * - Shallow: keys are reactive and values are held by reference. Values are prop bags, elements
 *   and records replaced wholesale, so deep-wrapping them only adds proxies.
 * - Synchronous: Solid batches writes until the next flush, while Base UI reads its store right
 *   after writing it (`set` then `select` in one handler). Untracked reads (handlers, effect
 *   callbacks, store methods) see the latest written value at once. Tracked reads subscribe
 *   through the Solid store, so rendering stays consistent within a flush.
 * - External: `set` is valid anywhere, including unmount cleanups that Solid runs while a parent
 *   computation disposes its children.
 *
 * Getter fields stay live as store computeds and are never written.
 */
export function createStoreState<State extends object>(
  initialState: State,
): [Store<State>, SetStoreFunction<State>] {
  const [reactive, writeReactive] = untrack(() =>
    createStore(initialState as any, { shallow: true }),
  ) as unknown as [State, (fn: (draft: any) => void) => void];

  const computedKeys = new Set<PropertyKey>();
  const descriptors = Object.getOwnPropertyDescriptors(initialState);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (descriptors[key as keyof typeof descriptors]?.get) {
      computedKeys.add(key);
    }
  }

  // Latest value of every written key. Equal to the reactive value once a flush applies it.
  const written = new Map<PropertyKey, unknown>();

  // Keys derived from a source accessor (`useSyncedValue`): a writable memo per key.
  const bindings = new Map<PropertyKey, Binding>();

  const latest = (key: PropertyKey) => {
    if (written.has(key)) {
      return written.get(key);
    }
    const binding = bindings.get(key);
    return untrack(() => {
      const value = binding ? binding.value() : (reactive as any)[key];
      return isBinding(value) ? value.value() : value;
    });
  };

  const listeners = new Set<(state: State) => void>();
  // Internal state to handle recursive writes from listeners, as React's Store.
  let updateTick = 0;

  const state = new Proxy(reactive, {
    get(target, key, receiver) {
      if (getObserver() !== null) {
        // A bound key's slot holds its binding: readers subscribe to the slot (so unbinding
        // notifies them) and to the derived value.
        const value = Reflect.get(target, key, receiver);
        return isBinding(value) ? value.value() : value;
      }
      // An untracked read is an imperative store read (handler, effect callback, store method).
      return latest(key);
    },
    // Enumeration (spreads, `Object.keys`) sees the same latest values as untracked reads.
    has(target, key) {
      return (getObserver() === null && written.has(key)) || Reflect.has(target, key);
    },
    ownKeys(target) {
      const keys = Reflect.ownKeys(target);
      if (getObserver() !== null) {
        return keys;
      }
      written.forEach((_, key) => {
        // Numeric keys are stored as strings, as property keys.
        const ownKey = typeof key === 'number' ? String(key) : key;
        if (!keys.includes(ownKey)) {
          keys.push(ownKey);
        }
      });
      return keys;
    },
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (getObserver() !== null || (!written.has(key) && !bindings.has(key))) {
        return descriptor;
      }
      return { configurable: true, enumerable: true, writable: true, value: latest(key) };
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
    // The write runs outside any owner (see above), and untracked: ingesting a value probes it
    // (store internals read symbol keys, which reach the memo behind a live `merge` view).
    runWithOwner(null, () =>
      untrack(() => {
        for (const [key, value] of changes) {
          bindings.get(key)?.setValue(value);
        }
        if (plainChanges.length > 0) {
          writeReactive((draft) => {
            for (const [key, value] of plainChanges) {
              draft[key] = value;
            }
          });
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

  function writeSlot(key: PropertyKey, value: unknown) {
    runWithOwner(null, () =>
      untrack(() =>
        writeReactive((draft) => {
          draft[key] = value;
        }),
      ),
    );
  }

  function bind(key: PropertyKey, source: BindingSource, clearOnCleanup: boolean) {
    if (computedKeys.has(key)) {
      // A getter field is already live, and `set` ignores it.
      return;
    }
    // Re-deriving from `source` drops an override written with `set` (React re-syncs on render).
    // The first derivation sees the key's value from before binding as `prev`.
    let unbound: { value: unknown } | null = { value: latest(key) };
    const [value, setValue] = createSignal<unknown>((prev: unknown) => {
      const next = source(unbound ? unbound.value : prev);
      unbound = null;
      written.delete(key);
      return next;
    });
    const binding: Binding = {
      [BINDING]: true,
      value,
      setValue: (next: unknown) => setValue(() => next),
    };
    bindings.set(key, binding);
    written.delete(key);
    writeSlot(key, binding);

    // Listeners (`observe`) see derived changes too, as they saw the synced writes.
    createEffect(value, (next, prev) => {
      if (prev !== undefined && !Object.is(next, prev)) {
        notify();
      }
    });

    onCleanup(() => {
      if (bindings.get(key) !== binding) {
        return;
      }
      // Unbinding keeps the latest value (or clears it), as React's store keeps the synced value.
      const last = clearOnCleanup ? undefined : latest(key);
      bindings.delete(key);
      written.set(key, last);
      writeSlot(key, last);
      if (clearOnCleanup) {
        notify();
      }
    });
  }

  storeListeners.set(state, listeners);
  storeBinders.set(state, bind);
  return [state as Store<State>, setState as unknown as SetStoreFunction<State>];
}

const BINDING = Symbol('binding');

/** A synced value's source. It receives the key's previous value (or the value last `set`). */
type BindingSource = (prev: unknown) => unknown;

interface Binding {
  [BINDING]: true;
  value: Accessor<unknown>;
  setValue: (value: unknown) => void;
}

function isBinding(value: unknown): value is Binding {
  return typeof value === 'object' && value !== null && BINDING in value;
}

const storeBinders = new WeakMap<
  object,
  (key: PropertyKey, source: BindingSource, clearOnCleanup: boolean) => void
>();

/**
 * Derives a store key from `source` for the lifetime of the current owner.
 */
function bindStoreKey<State extends object>(
  state: State,
  setState: SetStoreFunction<State>,
  key: keyof State,
  source: BindingSource,
  options: { clearOnCleanup?: boolean } = {},
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
    onCleanup(() => (setState as any)(key, undefined));
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

export type SolidStore<
  State extends object,
  Context extends object = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> = ReturnType<typeof SolidStore<State, Context, Selectors>>;
