/* eslint-disable typescript/no-explicit-any -- a props view handles arbitrary prop shapes; values are passed through as the sources hold them */
import {
  $PROXY,
  createMemo,
  getOwner,
  isHydrating,
  isStatic,
  runWithOwner,
  untrack,
  type Accessor,
} from 'solid-js';
import { isServer } from '@solidjs/web';
import { access } from '../solid-helpers';
import { combineStyle, makeEventPreventable } from '../merge-props/mergeProps';
import { shallowEqual } from '../solid-helpers';
import type { BaseUIEvent } from './types';

/**
 * A props source: a props object (plain, getters, or a Solid props proxy), or an accessor that
 * returns one (marked with `propsSourceAccessor`). `null`/`undefined` contribute nothing.
 */
export type PropsSource = object | null | undefined;

const ACCESSOR_SOURCES = new WeakSet<Function>();

/** Marks `accessor` as a source the view resolves on each read, rather than a props callback. */
export function propsSourceAccessor<T extends object | null | undefined>(
  accessor: Accessor<T>,
): Accessor<T> {
  // Resolved through one memo: a computation that reads the view's keys then depends on this node,
  // not on every signal the accessor reads (a part spreading these props into another part would
  // otherwise subscribe its memos to all of them).
  const source = createMemo(accessor);
  ACCESSOR_SOURCES.add(source);
  return source;
}

/** Marks a memo the caller already owns as an accessor source (no second memo). */
export function propsSourceMemo<T extends object | null | undefined>(
  memo: Accessor<T>,
): Accessor<T> {
  ACCESSOR_SOURCES.add(memo);
  return memo;
}

/** Whether `value` was marked with `propsSourceAccessor`. */
export function isPropsSourceAccessor(value: unknown): value is Accessor<PropsSource> {
  return typeof value === 'function' && ACCESSOR_SOURCES.has(value);
}

function resolve(source: unknown): Record<string, any> | undefined {
  const value =
    typeof source === 'function' && ACCESSOR_SOURCES.has(source)
      ? (source as Accessor<unknown>)()
      : source;
  return value != null && typeof value === 'object' ? (value as Record<string, any>) : undefined;
}

function isHandlerKey(key: string) {
  return key.length > 2 && key[0] === 'o' && key[1] === 'n';
}

function arraysEqual(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

/** `lazyMemo`'s signature, created now (server and hydration renders). */
function eagerMemo<T>(
  owner: ReturnType<typeof getOwner>,
  compute: () => T,
  equals: (a: T, b: T) => boolean,
): Accessor<T> {
  return runWithOwner(owner, () => createMemo(compute, { equals })) as Accessor<T>;
}

/**
 * A memo created on first read, owned by `owner`: views that are never enumerated (most element
 * props are read per key) never pay for it.
 */
function lazyMemo<T>(
  owner: ReturnType<typeof getOwner>,
  compute: () => T,
  equals: (a: T, b: T) => boolean,
): Accessor<T> {
  let memo: Accessor<T> | undefined;
  return () =>
    (memo ??= runWithOwner(owner, () => createMemo(compute, { equals })) as Accessor<T>)();
}

type EventHandler = (...args: any[]) => unknown;

const WRAP = Symbol('wrapHandler');

/**
 * A handler that wraps the lower-priority handlers for its key instead of running before them:
 * `wrap(next)` returns the handler, and `next(event)` runs the rest of the chain. This is what a
 * React prop getter does when it calls the consumer's handler from inside its own.
 */
export interface WrappedHandler<E = Event> {
  [WRAP]: (
    next: (event: E, ...rest: unknown[]) => unknown,
  ) => (event: E, ...rest: unknown[]) => unknown;
}

/** Marks a handler as wrapping the lower-priority handlers of its key (see `WrappedHandler`). */
export function wrapHandler<E = Event>(
  wrap: (
    next: (event: E, ...rest: unknown[]) => unknown,
  ) => (event: E, ...rest: unknown[]) => unknown,
): WrappedHandler<E> {
  return { [WRAP]: wrap };
}

function isWrappedHandler(value: unknown): value is WrappedHandler<unknown> {
  return value != null && typeof value === 'object' && WRAP in value;
}

type ChainEntry = EventHandler | WrappedHandler<unknown>;

function toHandler(value: unknown): ChainEntry | undefined {
  if (typeof value === 'function') {
    return value as EventHandler;
  }
  if (isWrappedHandler(value)) {
    return value;
  }
  // JSX event handlers can be `[callback, data]` tuples.
  if (Array.isArray(value) && typeof value[0] === 'function') {
    return value.length === 1 ? value[0] : value[0].bind(undefined, value[1]);
  }
  return undefined;
}

/**
 * Chains handlers as `mergeProps` does: the later source runs first, and calling
 * `event.preventBaseUIHandler()` skips the earlier ones. Handlers never subscribe.
 */
function chainHandlers(handlers: ChainEntry[]): EventHandler | undefined {
  if (handlers.length === 0) {
    return undefined;
  }
  // Runs entry `index` and, unless it prevents Base UI handlers, the lower-priority ones after it.
  // A wrapped entry owns the rest of the chain: it decides whether and when `next` runs it.
  const run = (index: number, args: unknown[]): unknown => {
    if (index < 0) {
      return undefined;
    }
    const entry = handlers[index];
    if (isWrappedHandler(entry)) {
      return entry[WRAP]((...nextArgs: unknown[]) => run(index - 1, nextArgs))(
        ...(args as [unknown, ...unknown[]]),
      );
    }
    const result = entry(...args);
    const event = args[0];
    if (!(event instanceof Event && (event as BaseUIEvent<Event>).baseUIHandlerPrevented)) {
      run(index - 1, args);
    }
    return result;
  };
  return (...args: unknown[]) =>
    untrack(() => {
      const event = args[0];
      if (event instanceof Event) {
        makeEventPreventable(event as BaseUIEvent<Event>);
      }
      return run(handlers.length - 1, args);
    });
}

const STATIC_KEY_PROBES = new WeakMap<object, (key: string) => boolean>();

/**
 * Whether `view[key]` can never change: the source that answers the key holds it as a literal
 * (Solid's `isStatic`, through nested props views). Merged keys (`class`, `style`, `classList`,
 * handlers), accessor sources and opaque proxies are never static.
 */
export function isStaticPropsViewKey(view: object, key: string): boolean {
  return STATIC_KEY_PROBES.get(view)?.(key) ?? false;
}

function isStaticSourceKey(source: object, key: string): boolean {
  const probe = STATIC_KEY_PROBES.get(source);
  if (probe) {
    return probe(key);
  }
  try {
    return isStatic(source, key);
  } catch {
    return false;
  }
}

export interface PropsViewOptions {
  /** Keys the view never exposes. */
  omit?: readonly string[] | undefined;
}

/**
 * A lazy view over `sources` (lowest priority first) with `mergeProps` semantics, where every key
 * tracks only that key: `view.x` reads `x` from the sources that have it and nothing else. Only the
 * key set (`ownKeys`, `in`) depends on which keys the sources have, never on their values.
 *
 * - Other keys: the last source that has the key wins, including an explicit `undefined` (React).
 * - `on*`: handlers chain (see `chainHandlers`), matched case-insensitively.
 * - `class`: later classes first; `style`: combined in order; `classList`: merged.
 */
const NO_OMIT: ReadonlySet<string> = new Set();
const OMIT_SETS = new WeakMap<readonly string[], ReadonlySet<string>>();

/** One `Set` per `omit` array (callers pass module-level constants), not one per view. */
function omitSet(omit: readonly string[] | undefined): ReadonlySet<string> {
  if (!omit || omit.length === 0) {
    return NO_OMIT;
  }
  let set = OMIT_SETS.get(omit);
  if (!set) {
    set = new Set(omit);
    OMIT_SETS.set(omit, set);
  }
  return set;
}

/** Each view's (and state-attributes source's) key list, read directly when another view enumerates it. */
const VIEW_KEYS = new WeakMap<object, () => readonly string[]>();
/** A `Set` per key-list array, for descriptor lookups. */
const KEY_SETS = new WeakMap<readonly string[], ReadonlySet<string>>();

/** A props view's key list, read without the proxy (no `ownKeys` result checks). */
export function propsViewKeys(view: object): readonly string[] {
  return (
    VIEW_KEYS.get(view)?.() ??
    (Reflect.ownKeys(view).filter((key) => typeof key === 'string') as string[])
  );
}

function keySetOf(keys: readonly string[]): ReadonlySet<string> {
  let set = KEY_SETS.get(keys);
  if (!set) {
    set = new Set(keys);
    KEY_SETS.set(keys, set);
  }
  return set;
}

/**
 * A source's own string keys. A props view answers from its key list; a Solid props proxy from
 * `ownKeys` alone (`Object.keys` would also call the descriptor trap for every key); a plain
 * object from `Object.keys`.
 */
function ownStringKeys(props: Record<string, any>): readonly string[] {
  const viewKeys = VIEW_KEYS.get(props);
  if (viewKeys) {
    return viewKeys();
  }
  if (props[$PROXY as unknown as string]) {
    return Reflect.ownKeys(props).filter((key): key is string => typeof key === 'string');
  }
  return Object.keys(props);
}

export function createPropsView(
  sources: readonly unknown[] | Accessor<readonly unknown[]>,
  options: PropsViewOptions = {},
): Record<string, any> {
  const omitted = omitSet(options.omit);
  const list = typeof sources === 'function' ? sources : () => sources;

  function get(key: string): unknown {
    const all = list();
    if (key === 'class') {
      let value: string | undefined;
      for (const source of all) {
        const props = resolve(source);
        const next = props && 'class' in props ? props.class : undefined;
        if (next) {
          value = value ? `${next} ${value}` : next;
        }
      }
      return value;
    }
    if (key === 'style') {
      let value: unknown;
      for (const source of all) {
        const props = resolve(source);
        const next = props && 'style' in props ? props.style : undefined;
        if (next) {
          value = value ? combineStyle(value as any, next) : next;
        }
      }
      return value;
    }
    if (key === 'classList') {
      let value: Record<string, unknown> | undefined;
      for (const source of all) {
        const props = resolve(source);
        const next = props && 'classList' in props ? props.classList : undefined;
        if (next) {
          value = value ? { ...value, ...next } : next;
        }
      }
      return value;
    }
    if (isHandlerKey(key)) {
      const lower = key.toLowerCase();
      const handlers: ChainEntry[] = [];
      for (const source of all) {
        const props = resolve(source);
        if (!props) {
          continue;
        }
        const handler =
          toHandler(key in props ? props[key] : undefined) ??
          (lower !== key ? toHandler(lower in props ? props[lower] : undefined) : undefined);
        if (handler) {
          handlers.push(handler);
        }
      }
      return chainHandlers(handlers);
    }
    for (let index = all.length - 1; index >= 0; index -= 1) {
      const props = resolve(all[index]);
      if (props && key in props) {
        return props[key];
      }
    }
    return undefined;
  }

  const keys = lazyMemo(
    getOwner(),
    () => {
      const seen = new Set<string>();
      const handlerNames = new Set<string>();
      const result: string[] = [];
      for (const source of list()) {
        const props = resolve(source);
        if (!props) {
          continue;
        }
        for (const key of ownStringKeys(props)) {
          if (omitted.has(key) || seen.has(key)) {
            continue;
          }
          if (isHandlerKey(key)) {
            const lower = key.toLowerCase();
            if (handlerNames.has(lower)) {
              continue;
            }
            handlerNames.add(lower);
          }
          seen.add(key);
          result.push(key);
        }
      }
      return result;
    },
    arraysEqual,
  );

  // Per key, so `key in view` depends only on the sources' `key`, not on every key they have.
  function has(key: string) {
    if (omitted.has(key)) {
      return false;
    }
    const lower = isHandlerKey(key) ? key.toLowerCase() : undefined;
    // Last to first: later sources usually carry the key (`ref`, `children`), ending the scan early.
    const all = list();
    for (let index = all.length - 1; index >= 0; index -= 1) {
      const props = resolve(all[index]);
      if (props && (key in props || (lower !== undefined && lower !== key && lower in props))) {
        return true;
      }
    }
    return false;
  }

  function staticKey(key: string): boolean {
    if (
      omitted.has(key) ||
      key === 'class' ||
      key === 'style' ||
      key === 'classList' ||
      isHandlerKey(key)
    ) {
      return false;
    }
    const all = list();
    for (let index = all.length - 1; index >= 0; index -= 1) {
      const source = all[index];
      const props = resolve(source);
      if (!props || !(key in props)) {
        continue;
      }
      // An accessor source's current props decide; the caller re-evaluates when it changes.
      return isStaticSourceKey(props, key);
    }
    return false;
  }

  const view = new Proxy({} as Record<string, any>, {
    get(_, key, receiver) {
      if (key === $PROXY) {
        return receiver;
      }
      if (typeof key !== 'string' || omitted.has(key)) {
        return undefined;
      }
      return get(key);
    },
    has(_, key) {
      return key === $PROXY || (typeof key === 'string' && has(key));
    },
    ownKeys() {
      return keys();
    },
    // Answered from the key list: enumeration (`Object.keys`, spreads) asks this for every key it
    // got from `ownKeys`, and a per-key `has` would walk every source for each, subscribing the
    // enumerating computation to all of them. `has` stays per key for `key in view`.
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || !keySetOf(keys()).has(key)) {
        return undefined;
      }
      return { configurable: true, enumerable: true, get: () => get(key) };
    },
    set: () => true,
    deleteProperty: () => true,
  });
  STATIC_KEY_PROBES.set(view, (key) => untrack(() => staticKey(key)));
  VIEW_KEYS.set(view, keys);
  return view;
}

/**
 * A props source for a part's state attributes (`getStateAttributesProps` semantics), tracked per
 * attribute: an attribute's value depends only on the state key that produces it. A lookup of
 * another key reads no state for default-mapped keys (`data-<key>`), only the custom mappers, so a
 * prop unrelated to state never depends on it. Enumeration depends on which attributes are present.
 */
export function createStateAttributesSource<State extends Record<string, any>>(
  state: Accessor<State>,
  mapping: Accessor<
    Record<string, ((value: any) => Record<string, unknown> | null) | undefined> | undefined
  >,
  /** The state's key set and the mapping never change: the layout is read once, no memo. */
  fixedLayout = false,
): Record<string, any> {
  const attributesByStateKey = new Map<string, Accessor<Record<string, unknown> | null>>();
  // Per-key memos are created lazily (inside other computations) but owned here, so a re-run of
  // the computation that first asked does not dispose them.
  const owner = getOwner();

  // A default-mapped state key (`data-<key>`) is read straight from the state: the attribute is
  // present when the value is truthy, `''` for `true`. Only custom mappers get a memo (one per
  // state key, shallow-equal output), as a mapper may build a new object on every call.
  function attributesFor(stateKey: string) {
    let attributes = attributesByStateKey.get(stateKey);
    if (!attributes) {
      attributes = runWithOwner(owner, () =>
        createMemo(() => mapping()?.[stateKey]?.(state()[stateKey]) ?? null, {
          equals: shallowEqual,
        }),
      );
      attributesByStateKey.set(stateKey, attributes);
    }
    return attributes;
  }

  // State keys from last to first (a later state key wins, as `Object.assign`), each with the one
  // attribute it can produce when it has no mapper. Reads the state's key set, not its values.
  const computeLayout = () => {
    const currentMapping = mapping();
    // `Reflect.ownKeys`: on a proxied state (merged sources), `Object.keys` would also build a
    // descriptor per key.
    return (Reflect.ownKeys(state()).filter((key) => typeof key === 'string') as string[])
      .reverse()
      .map((stateKey) => ({
        stateKey,
        attribute: currentMapping?.[stateKey] ? undefined : `data-${stateKey.toLowerCase()}`,
      }));
  };
  const fixed = fixedLayout ? untrack(computeLayout) : undefined;
  const layout = fixed
    ? () => fixed
    : createMemo(computeLayout, {
        equals: (a, b) =>
          a.length === b.length &&
          a.every(
            (entry, index) =>
              entry.stateKey === b[index].stateKey && entry.attribute === b[index].attribute,
          ),
      });

  // The attributes the custom mappers currently produce (attribute -> highest-priority mapped
  // state key and its attributes), as one dependency for lookups.
  // Created on first use: only parts with a custom mapper read it.
  // Lazy on the client (most parts have no custom mapper). Server and hydration renders create it
  // up front, as both must create the part's owners in the same order (hydration keys); a memo
  // created on first read would land at a different position on each side.
  const createdUpFront = isServer || isHydrating();
  const mappedAttributes = (createdUpFront ? eagerMemo : lazyMemo)(
    owner,
    () => {
      const result = new Map<string, { stateKey: string; attributes: Record<string, unknown> }>();
      for (const { stateKey, attribute } of layout()) {
        const attributes = attribute === undefined ? attributesFor(stateKey)() : null;
        if (attributes) {
          for (const key of Object.keys(attributes)) {
            if (!result.has(key)) {
              result.set(key, { stateKey, attributes });
            }
          }
        }
      }
      return result;
    },
    (a, b) =>
      a.size === b.size &&
      [...a].every(
        ([key, value]) =>
          b.get(key)?.stateKey === value.stateKey && b.get(key)?.attributes === value.attributes,
      ),
  );

  /** `key`'s value and whether a state key provides it (highest priority first). */
  function lookup(key: string): { value: unknown } | undefined {
    for (const { stateKey, attribute } of layout()) {
      if (attribute === undefined) {
        const mapped = mappedAttributes().get(key);
        if (mapped?.stateKey === stateKey) {
          return { value: access(mapped.attributes[key]) };
        }
      } else if (attribute === key) {
        const value = state()[stateKey];
        if (value) {
          return { value: value === true ? '' : String(value) };
        }
      }
    }
    return undefined;
  }

  const read = (key: string) => lookup(key)?.value;

  // One memo for the key set (equal lists keep the previous one), so the views that enumerate
  // this source depend on it rather than on every state value behind it.
  const keys = lazyMemo(
    owner,
    () => {
      const result = new Set<string>();
      for (const { stateKey, attribute } of [...layout()].reverse()) {
        if (attribute !== undefined) {
          if (state()[stateKey]) {
            result.add(attribute);
          }
          continue;
        }
        const attributes = attributesFor(stateKey)();
        if (attributes) {
          for (const key of Object.keys(attributes)) {
            result.add(key);
          }
        }
      }
      return [...result];
    },
    arraysEqual,
  );

  const source = new Proxy({} as Record<string, any>, {
    get(_, key) {
      return typeof key === 'string' ? read(key) : undefined;
    },
    has(_, key) {
      return typeof key === 'string' && lookup(key) !== undefined;
    },
    ownKeys() {
      return keys();
    },
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || lookup(key) === undefined) {
        return undefined;
      }
      return { configurable: true, enumerable: true, get: () => read(key) };
    },
  });
  VIEW_KEYS.set(source, keys);
  return source;
}
