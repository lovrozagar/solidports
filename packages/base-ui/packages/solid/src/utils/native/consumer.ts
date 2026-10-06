/* eslint-disable typescript/no-explicit-any -- consumer props are arbitrary; values pass through as the props hold them */
/*
 * Consumer props (plan 8 native kit): the one-time classification of a consumer's props at a native
 * part's setup, and the handler helpers it composes. Every native element reads its consumer's key
 * set here exactly once; reactive keys are then read inside the part's attribute effect.
 */
import { isStatic, untrack } from 'solid-js';
import { makeEventPreventable } from '../../merge-props/mergeProps';
import type { BaseUIEvent } from '../types';

type AnyProps = Record<string, any>;
type Handler = (...args: any[]) => unknown;

/** Keys a consumer passes that never reach the element as they are. */
export const NATIVE_RESERVED_KEYS: readonly string[] = ['class', 'style', 'render', 'ref', 'children'];
const RESERVED: ReadonlySet<string> = new Set(NATIVE_RESERVED_KEYS);
const EMPTY_KEYS: ReadonlySet<string> = new Set();
const EMPTY_LIST: readonly string[] = [];

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
  wrap?: (key: string, consumer: () => Handler | undefined) => unknown,
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
