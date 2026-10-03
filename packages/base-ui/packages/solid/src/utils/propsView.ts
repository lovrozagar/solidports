/* eslint-disable typescript/no-explicit-any -- a props view handles arbitrary prop shapes; values are passed through as the sources hold them */
import { $PROXY, createMemo, getOwner, runWithOwner, untrack, type Accessor } from 'solid-js';
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
  ACCESSOR_SOURCES.add(accessor);
  return accessor;
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

function toHandler(value: unknown): EventHandler | undefined {
  if (typeof value === 'function') {
    return value as EventHandler;
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
function chainHandlers(handlers: EventHandler[]): EventHandler | undefined {
  if (handlers.length === 0) {
    return undefined;
  }
  return (...args: unknown[]) =>
    untrack(() => {
      const event = args[0];
      const preventable = event instanceof Event;
      if (preventable) {
        makeEventPreventable(event as BaseUIEvent<Event>);
      }
      let result: unknown;
      for (let index = handlers.length - 1; index >= 0; index -= 1) {
        if (
          index < handlers.length - 1 &&
          preventable &&
          (event as BaseUIEvent<Event>).baseUIHandlerPrevented
        ) {
          break;
        }
        const value = handlers[index](...args);
        if (index === handlers.length - 1) {
          result = value;
        }
      }
      return result;
    });
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
export function createPropsView(
  sources: readonly unknown[] | Accessor<readonly unknown[]>,
  options: PropsViewOptions = {},
): Record<string, any> {
  const omitted = new Set(options.omit ?? []);
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
      const handlers: EventHandler[] = [];
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
        for (const key of Object.keys(props)) {
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

  return new Proxy({} as Record<string, any>, {
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
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || !has(key)) {
        return undefined;
      }
      return { configurable: true, enumerable: true, get: () => get(key) };
    },
    set: () => true,
    deleteProperty: () => true,
  });
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
): Record<string, any> {
  const attributesByStateKey = new Map<string, Accessor<Record<string, unknown> | null>>();
  // Per-key memos are created lazily (inside other computations) but owned here, so a re-run of
  // the computation that first asked does not dispose them.
  const owner = getOwner();

  function attributesFor(stateKey: string) {
    let attributes = attributesByStateKey.get(stateKey);
    if (!attributes) {
      attributes = runWithOwner(owner, () =>
        createMemo(
          () => {
            const value = state()[stateKey];
            const mapper = mapping()?.[stateKey];
            if (mapper) {
              return mapper(value) ?? null;
            }
            if (value === true) {
              return { [`data-${stateKey.toLowerCase()}`]: '' };
            }
            if (value) {
              return { [`data-${stateKey.toLowerCase()}`]: value.toString() };
            }
            return null;
          },
          { equals: shallowEqual },
        ),
      );
      attributesByStateKey.set(stateKey, attributes);
    }
    return attributes;
  }

  // State keys from last to first (a later state key wins, as `Object.assign`), each with the one
  // attribute it can produce when it has no mapper. Reads the state's key set, not its values.
  const layout = createMemo(
    () => {
      const currentMapping = mapping();
      return Object.keys(state())
        .reverse()
        .map((stateKey) => ({
          stateKey,
          attribute: currentMapping?.[stateKey] ? undefined : `data-${stateKey.toLowerCase()}`,
        }));
    },
    {
      equals: (a, b) =>
        a.length === b.length &&
        a.every(
          (entry, index) =>
            entry.stateKey === b[index].stateKey && entry.attribute === b[index].attribute,
        ),
    },
  );

  // The attributes the custom mappers currently produce (attribute -> highest-priority mapped
  // state key and its attributes), as one dependency for lookups.
  const mappedAttributes = createMemo(
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
    {
      equals: (a, b) =>
        a.size === b.size &&
        [...a].every(
          ([key, value]) =>
            b.get(key)?.stateKey === value.stateKey && b.get(key)?.attributes === value.attributes,
        ),
    },
  );

  /** The attributes object that provides `key`, or `undefined`. */
  function owning(key: string) {
    for (const { stateKey, attribute } of layout()) {
      if (attribute === undefined) {
        const mapped = mappedAttributes().get(key);
        if (mapped?.stateKey === stateKey) {
          return mapped.attributes;
        }
      } else if (attribute === key) {
        const attributes = attributesFor(stateKey)();
        if (attributes) {
          return attributes;
        }
      }
    }
    return undefined;
  }

  const read = (key: string) => access(owning(key)?.[key]);

  const keys = lazyMemo(
    owner,
    () => {
      const result = new Set<string>();
      for (const { stateKey } of [...layout()].reverse()) {
        const attributes = attributesFor(stateKey)();
        if (attributes) {
          for (const attribute of Object.keys(attributes)) {
            result.add(attribute);
          }
        }
      }
      return [...result];
    },
    arraysEqual,
  );

  return new Proxy({} as Record<string, any>, {
    get(_, key) {
      return typeof key === 'string' ? read(key) : undefined;
    },
    has(_, key) {
      return typeof key === 'string' && owning(key) !== undefined;
    },
    ownKeys() {
      return keys();
    },
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || owning(key) === undefined) {
        return undefined;
      }
      return { configurable: true, enumerable: true, get: () => read(key) };
    },
  });
}
