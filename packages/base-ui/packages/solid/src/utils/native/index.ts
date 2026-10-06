/* eslint-disable typescript/no-explicit-any -- the kit bridges arbitrary consumer props and Solid's untyped `assign`; values pass through as the props hold them */
/*
 * Native kit (plan 8): the plain functions a Solid-native part uses to render its element with
 * direct JSX instead of `useRenderElement`. Nothing here creates a reactive node of its own; the
 * part owns its one attribute effect (if any). Contract: `.kb/solid/native-parts.md`.
 */
import {
  $PROXY,
  createRenderEffect,
  type Owner,
  isHydrating,
  isStatic,
  runWithOwner,
  untrack,
} from 'solid-js';
import { assign, isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { MERGED_REFS, combineStyle, makeEventPreventable } from '../../merge-props/mergeProps';
import { resolveClassName } from '../resolveClassName';
import { resolveStyle as resolveStyleProp } from '../resolveStyle';
import type { BaseUIEvent } from '../types';

type AnyProps = Record<string, any>;
type Handler = (...args: any[]) => unknown;

/** Keys a consumer passes that never reach the element as they are. */
export const NATIVE_RESERVED_KEYS: readonly string[] = ['class', 'style', 'render', 'ref', 'children'];
const RESERVED: ReadonlySet<string> = new Set(NATIVE_RESERVED_KEYS);
const EMPTY_KEYS: ReadonlySet<string> = new Set();
const EMPTY_LIST: readonly string[] = [];

/**
 * Whether a part may render its element natively for these props. Decided once at setup from
 * static information: a client render that is not hydrating, no `render` key at all, a props object
 * that is not a Solid proxy (its key set could change), a static `ref`, and static `staticKeys`
 * (props the part reads once, as the slow path does). Anything else keeps `useRenderElement`.
 */
export function canRenderNative(props: object, staticKeys: readonly string[] = []): boolean {
  if (isServer || isHydrating()) {
    return false;
  }
  if ((props as Record<PropertyKey, unknown>)[$PROXY]) {
    return false;
  }
  if ('render' in props || !isStatic(props, 'ref')) {
    return false;
  }
  for (const key of staticKeys) {
    if (!isStatic(props, key)) {
      return false;
    }
  }
  return true;
}

/** Whether `key` names an event handler prop (`on*`). */
export function isHandlerKey(key: string): boolean {
  return key.length > 2 && key[0] === 'o' && key[1] === 'n';
}

function toHandler(value: unknown): Handler | undefined {
  if (typeof value === 'function') {
    return value as Handler;
  }
  // JSX event handlers can be `[callback, data]` tuples.
  if (Array.isArray(value) && typeof value[0] === 'function') {
    return value.length === 1 ? value[0] : value[0].bind(undefined, value[1]);
  }
  return undefined;
}

/**
 * The consumer's handler for `key` as the props hold it now: a function, a `[handler, data]`
 * tuple, or the lowercase form (`onclick`), as the props view resolves it. Read at event time.
 */
export function readHandler(props: object, key: string): Handler | undefined {
  const source = props as AnyProps;
  const handler = toHandler(key in source ? source[key] : undefined);
  if (handler) {
    return handler;
  }
  const lower = key.toLowerCase();
  return lower !== key ? toHandler(lower in source ? source[lower] : undefined) : undefined;
}

/**
 * One handler in React's `mergeProps` order: `before` (the part's gate, as a React prop getter
 * runs before calling the consumer; returning `false` ends the chain), then the consumer's handler
 * (resolved when the event fires, so it never subscribes), then `part` unless the consumer called
 * `event.preventBaseUIHandler()`. The event is made preventable first, as every chain does.
 */
export function composeHandler<E extends Event>(
  consumer: (() => Handler | undefined) | undefined,
  part?: ((event: BaseUIEvent<E>) => void) | undefined,
  before?: ((event: BaseUIEvent<E>) => boolean | void) | undefined,
): (event: E, ...rest: unknown[]) => unknown {
  return (nativeEvent, ...rest) => {
    const event = makeEventPreventable(nativeEvent as BaseUIEvent<E>);
    return untrack(() => {
      if (before && before(event) === false) {
        return undefined;
      }
      const handler = consumer?.();
      const result = handler ? handler(event, ...rest) : undefined;
      if (part && !event.baseUIHandlerPrevented) {
        part(event);
      }
      return result;
    });
  };
}

/** `class` for the element: a function form receives the part's state; empty strings are no class. */
export function resolveClass<State>(
  value: string | ((state: State) => string | undefined) | undefined,
  state: State,
): string | undefined {
  return resolveClassName(value, state) || undefined;
}

/**
 * `style` for the element: a function form receives the part's state; a part style is combined
 * below the consumer's (the consumer's keys win), as the props view combines sources in order.
 */
export function resolveStyle<State>(
  value: JSX.CSSProperties | string | ((state: State) => JSX.CSSProperties | undefined) | undefined,
  state: State,
  partStyle?: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties | string | undefined {
  const resolved = resolveStyleProp(value as any, state) as JSX.CSSProperties | string | undefined;
  if (partStyle && resolved) {
    return combineStyle(partStyle, resolved);
  }
  return partStyle || resolved || undefined;
}

/** A state value as its default `data-*` attribute: `''` for `true`, the string for other truthy values. */
export function stateAttr(value: unknown): string | undefined {
  if (value === true) {
    return '';
  }
  return value ? String(value) : undefined;
}

/** Flattens a ref prop (callback, `mergeProps` chain, array, object ref) into its parts. */
export function collectRefs(
  ref: unknown,
  callbacks: Set<Function>,
  objects: Set<{ current: unknown }>,
): void {
  if (typeof ref === 'function') {
    const chained = (ref as { [MERGED_REFS]?: Function[] })[MERGED_REFS];
    if (chained) {
      chained.forEach((callback) => collectRefs(callback, callbacks, objects));
    } else {
      callbacks.add(ref);
    }
  } else if (Array.isArray(ref)) {
    ref.forEach((entry) => collectRefs(entry, callbacks, objects));
  } else if (ref != null && typeof ref === 'object' && 'current' in ref) {
    objects.add(ref as { current: unknown });
  }
}

/**
 * Applies refs to the element as Solid applies refs (ownerless, untracked): each distinct callback
 * once with the element, object refs set. Callback refs are never called with `null` here.
 */
export function applyRefs(el: Element, ...refs: unknown[]): void {
  const callbacks = new Set<Function>();
  const objects = new Set<{ current: unknown }>();
  refs.forEach((ref) => collectRefs(ref, callbacks, objects));
  runWithOwner(null, () =>
    untrack(() => {
      callbacks.forEach((callback) => callback(el));
      objects.forEach((ref) => {
        ref.current = el;
      });
    }),
  );
}

/**
 * React calls a part's own refs with `null` when the element unmounts and the ported hooks rely on
 * it; consumer refs keep Solid's contract. An object ref is cleared only while it still points at
 * the outgoing element.
 */
export function releasePartRefs(el: Element, ...refs: unknown[]): void {
  const callbacks = new Set<Function>();
  const objects = new Set<{ current: unknown }>();
  refs.forEach((ref) => collectRefs(ref, callbacks, objects));
  runWithOwner(null, () =>
    untrack(() => {
      callbacks.forEach((callback) => callback(null));
      objects.forEach((ref) => {
        if (ref.current === el) {
          ref.current = null;
        }
      });
    }),
  );
}

export interface ConsumerProps {
  /** Every consumer key the element receives (handlers, literals and reactive keys). */
  keys: ReadonlySet<string>;
  /** Values that never change plus one stable dispatcher per handler key: assigned once. */
  literal: Record<string, unknown>;
  /** Keys read inside the part's attribute effect. */
  reactive: readonly string[];
}

/**
 * Classifies the consumer's props once (untracked): `own` keys (the part's props) and the reserved
 * keys are skipped; `on*` keys get one dispatcher that reads the handler when the event fires;
 * literal values (Solid's `isStatic`) are assigned once; getters are read in the effect.
 * `wrap` lets the part wrap the dispatcher of a key it handles itself (its handler keys are then
 * still assigned once, with the part's composed handler).
 */
export function classifyConsumerProps(
  props: object,
  own: ReadonlySet<string>,
  wrap?: (key: string, consumer: () => Handler | undefined) => Handler | undefined,
): ConsumerProps {
  // Runs in the part's body, which `createComponent` already runs untracked; literal values are
  // plain data properties, so no read here tracks anything.
  let keys: Set<string> | undefined;
  let reactive: string[] | undefined;
  // As the props view: the first key seen per lowercase handler name is the one the element gets.
  let handlerNames: Set<string> | undefined;
  const literal: Record<string, unknown> = {};
  const source = props as AnyProps;
  for (const key of Object.keys(source)) {
    if (own.has(key) || RESERVED.has(key)) {
      continue;
    }
    const handler = isHandlerKey(key);
    if (handler) {
      const lower = key.toLowerCase();
      handlerNames ??= new Set();
      if (handlerNames.has(lower)) {
        continue;
      }
      handlerNames.add(lower);
    }
    (keys ??= new Set()).add(key);
    if (handler) {
      const consumer = () => readHandler(source, key);
      literal[key] = wrap?.(key, consumer) ?? composeHandler(consumer);
    } else if (isStatic(source, key)) {
      literal[key] = source[key];
    } else {
      (reactive ??= []).push(key);
    }
  }
  return { keys: keys ?? EMPTY_KEYS, literal, reactive: reactive ?? EMPTY_LIST };
}

/** Reads the reactive consumer keys into `target` (inside the part's attribute effect). */
export function readReactiveProps(
  props: object,
  reactive: readonly string[],
  target: Record<string, unknown>,
): Record<string, unknown> {
  if (reactive.length === 0) {
    return target;
  }
  const source = props as AnyProps;
  for (const key of reactive) {
    target[key] = source[key];
  }
  return target;
}

/**
 * Writes the element's attributes: `literal` once now, and `dynamic` (when given) from one render
 * effect owned by `owner` (the part), through Solid's `assign` with its own previous-value record,
 * so attribute, property, `class`, `style` and event semantics are the runtime's. A key whose value
 * becomes `undefined` is removed. Nothing is written when the part is disposed (React leaves the
 * detached element as it was).
 */
export function attachNativeAttributes(
  el: Element,
  literal: Record<string, unknown>,
  dynamic: (() => Record<string, unknown>) | undefined,
  owner: Owner | null,
): void {
  assign(el, literal, true, {}, true);
  if (!dynamic) {
    return;
  }
  const previous: Record<string, unknown> = {};
  runWithOwner(owner, () =>
    createRenderEffect(dynamic, (props) => {
      assign(el, props, true, previous, true);
    }),
  );
}
