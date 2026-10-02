/**
 * Based on the original implementation of combineProps from @solid-primitives/props:
 * https://github.com/solidjs-community/solid-primitives/blob/0cbdb59bb42f50de5e08000027789ae3d4c80280/packages/props/src/combineProps.ts
 */

/* eslint-disable no-plusplus */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-cond-assign */
/* eslint-disable curly */
/* eslint-disable guard-for-in */
/* eslint-disable typescript/no-explicit-any -- generic prop merger handles arbitrary element types and event handler shapes; `unknown` would force casts at every cache slot and break variance with consumer prop types */

import { $PROXY, untrack } from 'solid-js';
import type { Ref } from 'solid-js';
import type { ComponentProps, JSX, ValidComponent } from '@solidjs/web';
import type { BaseUIEvent, WithBaseUIEvent } from '../utils/types';
import { mergeProps as solidMergeProps } from '../solid-1-compat';

type EventHandler = (...args: any[]) => unknown;

export interface MergePropsOptions {
  /**
   * When true, all event handlers execute and the first non-undefined
   * result is returned (matching React's useInteractions mergeProps behavior).
   * When false/omitted, uses the default preventable chaining where
   * `event.preventBaseUIHandler()` can stop earlier handlers.
   */
  callAllHandlers?: boolean;
}

function isMergePropsOptions(value: unknown): value is MergePropsOptions {
  return typeof value === 'object' && value !== null && 'callAllHandlers' in value;
}

function trueFn() {
  return true;
}

const propTraps: ProxyHandler<{
  get: (k: string | number | symbol) => any;
  has: (k: string | number | symbol) => boolean;
  keys: () => string[];
}> = {
  deleteProperty: trueFn,
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  getOwnPropertyDescriptor(_, property) {
    // Report only the keys the merged props have, so `hasOwnProperty` matches a plain object.
    if (!_.has(property)) {
      return undefined;
    }
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn,
    };
  },
  has(_, property) {
    return _.has(property);
  },
  ownKeys(_) {
    return _.keys();
  },
  set: trueFn,
};

const extractCSSregex = /((?:--)?(?:\w+-?)+)\s*:\s*([^;]*)/g;

/**
 * converts inline string styles to object form
 * @example
 * const styles = stringStyleToObject("margin: 24px; border: 1px solid #121212");
 * styles; // { margin: "24px", border: "1px solid #121212" }
 * */
export function stringStyleToObject(style: string): JSX.CSSProperties {
  const object: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = extractCSSregex.exec(style))) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) {
      object[key] = value;
    }
  }
  return object;
}

/**
 * Combines two set of styles together. Accepts both string and object styles.\
 * @example
 * const styles = combineStyle("margin: 24px; border: 1px solid #121212", {
 *   margin: "2rem",
 *   padding: "16px"
 * });
 * styles; // { margin: "2rem", border: "1px solid #121212", padding: "16px" }
 */
export function combineStyle(a: string, b: string): string;
export function combineStyle(
  a: JSX.CSSProperties | undefined,
  b: JSX.CSSProperties | undefined,
): JSX.CSSProperties;
export function combineStyle(
  a: JSX.CSSProperties | string | undefined,
  b: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties;
export function combineStyle(
  a: JSX.CSSProperties | string | undefined,
  b: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties | string {
  if (typeof a === 'string' && typeof b === 'string') return `${a};${b}`;

  const objA = typeof a === 'string' ? stringStyleToObject(a) : a;
  const objB = typeof b === 'string' ? stringStyleToObject(b) : b;
  return { ...objA, ...objB };
}

type ElementType = keyof JSX.IntrinsicElements | ValidComponent;
type PropsOf<T extends ElementType> = WithBaseUIEvent<ComponentProps<T>>;
// Solid: the merged handlers are what the DOM calls, and they make the native event preventable
// themselves, so the result takes plain events. React types the result as `PropsOf<T>` and relies
// on React's bivariant `EventHandler`; Solid's `JSX.EventHandler` is checked strictly, so a
// `BaseUIEvent` handler could not be spread onto a native element.
// A mapped type (as React's `PropsOf`) rather than the `ComponentProps` interfaces, so the result is
// assignable to `Record<string, unknown>` (e.g. `useRender`'s `props`).
type MergedPropsOf<T extends ElementType> = {
  [K in keyof ComponentProps<T>]: ComponentProps<T>[K];
};
export type MergablePropsCallback<T extends ElementType> = (otherProps: PropsOf<T>) => PropsOf<T>;

type PropsInput<T extends ElementType> = PropsOf<T> | MergablePropsCallback<T> | undefined;

const reduce = <T, K extends keyof T>(
  sources: Iterable<T>,
  key: K,
  calc: (a: NonNullable<T[K]>, b: NonNullable<T[K]>) => T[K],
) => {
  let v: T[K] | undefined;
  for (const value of sources) {
    if (!v) v = value[key];
    else if (value[key]) v = calc(v, value[key]);
  }
  return v;
};

/**
 * A helper that reactively merges multiple props objects together while smartly combining some of Solid's JSX/DOM attributes.
 *
 * Event handlers and refs are chained, class, classNames and styles are combined.
 * For all other props, the last prop object overrides all previous ones. Similarly to {@link mergeProps}
 * @param sources - Multiple sets of props to combine together.
 * @example
 * ```tsx
 * const MyButton: Component<ButtonProps> = props => {
 *    const { buttonProps } = createButton();
 *    const combined = combineProps(props, buttonProps);
 *    return <button {...combined} />
 * }
 * // component consumer can provide button props
 * // they will be combined with those provided by createButton() primitive
 * <MyButton style={{ margin: "24px" }} />
 * ```
 */
export function mergeProps<
  E extends ElementType | undefined = undefined,
  Args extends Array<any> = PropsInput<E extends ElementType ? E : any>[],
  R = MergedPropsOf<E extends ElementType ? E : any>,
>(sources: Args, options?: MergePropsOptions): R;
export function mergeProps<
  E extends ElementType | undefined = undefined,
  Args extends Array<any> = PropsInput<E extends ElementType ? E : any>[],
  R = MergedPropsOf<E extends ElementType ? E : any>,
>(...sources: [...Args, MergePropsOptions]): R;
export function mergeProps<
  E extends ElementType | undefined = undefined,
  Args extends Array<any> = PropsInput<E extends ElementType ? E : any>[],
  R = MergedPropsOf<E extends ElementType ? E : any>,
>(...sources: Args): R;
export function mergeProps<
  E extends ElementType | undefined = undefined,
  Args extends Array<any> = PropsInput<E extends ElementType ? E : any>[],
  R = MergedPropsOf<E extends ElementType ? E : any>,
>(...args: Args): R {
  let rawArgs = args as unknown[];
  let options: MergePropsOptions | undefined;

  // Detect options as the last argument
  const lastArg = rawArgs[rawArgs.length - 1];
  if (isMergePropsOptions(lastArg)) {
    options = lastArg;
    rawArgs = rawArgs.slice(0, -1);
  }

  const sources = (Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs) as Args;
  const callAll = options?.callAllHandlers === true;

  let cachedListeners = {} as Record<string, EventHandler | undefined>;
  let cachedListenerArrays = {} as Record<string, EventHandler[]>;
  let cacheStyles = [] as JSX.HTMLAttributes<any>[];
  let cacheRefs = [] as Array<Ref<any>>;
  let cacheClasses = [] as JSX.HTMLAttributes<any>[];
  let cacheClassList = [] as Array<{ classList?: Record<string, boolean | undefined> }>;
  const lastDescriptor = {} as Record<string, PropertyDescriptor | undefined>;

  /*
   * Track the last property descriptor for each key to handle explicit undefined values.
   * Solid's mergeProps doesn't overwrite with undefined, but React's mergeProps does.
   * We need to match React's behavior where explicit undefined should overwrite.
   */

  let merge = {} as Record<string, unknown>;
  for (let props of sources) {
    let propsOverride = false;
    if (typeof props === 'function') {
      const mergedListeners = callAll
        ? buildCallAllListeners(Object.assign({}, cachedListenerArrays))
        : Object.assign({}, cachedListeners);
      const mergedStyles = Object.assign([], cacheStyles);
      const mergedRefs = Object.assign([], cacheRefs);
      const mergedClasses = Object.assign([], cacheClasses);
      const mergedClassList = Object.assign([], cacheClassList);

      const localMerged = {
        get class() {
          return reduce(mergedClasses, 'class', (a, b) => `${b} ${a}`);
        },
        get classList() {
          return reduce(mergedClassList, 'classList', (a, b) => ({ ...a, ...b }));
        },
        get ref() {
          return chainRefs(mergedRefs);
        },
        get style() {
          return reduce(mergedStyles, 'style', combineStyle as any);
        },
      };

      const mergedForGetter = new Proxy(merge, {
        get(target, key, receiver) {
          if (typeof key !== 'string') return Reflect.get(target, key, receiver);
          if (key in localMerged) return localMerged[key as keyof typeof localMerged];

          if (key[0] === 'o' && key[1] === 'n' && key[2]) {
            const name = key.toLowerCase();
            if (name in mergedListeners) return mergedListeners[name];
          }

          return Reflect.get(target, key, receiver);
        },
      });

      propsOverride = true;
      props = props(mergedForGetter);

      cachedListeners = {};
      cachedListenerArrays = {};
      cacheStyles = [];
      cacheRefs = [];
      cacheClasses = [];
      cacheClassList = [];
    }

    for (const key in props) {
      /*
       * Track all descriptors before any special handling so we can later
       * check if the final value should be undefined
       */
      lastDescriptor[key] = Object.getOwnPropertyDescriptor(props, key);

      if (key === 'style') {
        cacheStyles.push(props as any);
        continue;
      }

      if (key === 'ref') {
        if (typeof props[key] === 'function') {
          cacheRefs.push(props[key]);
        }
        continue;
      }

      if (key === 'class' || key === 'className') {
        cacheClasses.push(props as any);
        continue;
      }

      if (key === 'classList') {
        cacheClassList.push(props as any);
        continue;
      }

      // event listeners
      if (key[0] === 'o' && key[1] === 'n' && key[2]) {
        const v = props[key];
        const name = key.toLowerCase();

        const callback: EventHandler | undefined =
          typeof v === 'function'
            ? v
            : // jsx event handlers can be tuples of [callback, arg]
              Array.isArray(v)
              ? v.length === 1
                ? v[0]
                : v[0].bind(void 0, v[1])
              : void 0;

        if (callback) {
          if (callAll) {
            if (!cachedListenerArrays[name]) {
              cachedListenerArrays[name] = [];
            }
            cachedListenerArrays[name].push(callback);
          } else {
            cachedListeners[name] = mergeEventHandlers(cachedListeners[name], callback);
          }
        }
      }
    }

    // eslint-disable-next-line solid/reactivity
    merge = propsOverride ? (props ?? {}) : solidMergeProps(merge, props);
  }

  const mergedListeners = callAll
    ? buildCallAllListeners(cachedListenerArrays)
    : { ...cachedListeners };
  const localMerged = {
    get class() {
      return reduce(cacheClasses, 'class', (a, b) => `${b} ${a}`);
    },
    get classList() {
      return reduce(cacheClassList, 'classList', (a, b) => ({ ...a, ...b }));
    },
    get ref() {
      return chainRefs(cacheRefs);
    },
    get style() {
      return reduce(cacheStyles, 'style', combineStyle as any);
    },
  };

  return new Proxy(
    {
      get(key) {
        if (typeof key !== 'string') return Reflect.get(merge, key);
        if (key in localMerged) return localMerged[key as keyof typeof localMerged];

        if (key[0] === 'o' && key[1] === 'n' && key[2]) {
          const name = key.toLowerCase();
          if (name in mergedListeners) return mergedListeners[name];
        }

        /*
         * Check if the last descriptor for this key resolves to undefined.
         * This handles the case where explicit undefined should overwrite previous values,
         * matching React's mergeProps behavior.
         */
        const desc = lastDescriptor[key];
        if (desc) {
          const value = desc.get ? desc.get() : desc.value;
          if (value === undefined) {
            return undefined;
          }
        }

        return Reflect.get(merge, key);
      },
      has(key) {
        return Reflect.has(merge, key);
      },
      keys() {
        return Object.keys(merge);
      },
    },
    propTraps,
  ) as any;
}

/**
 * Merges an arbitrary number of props using the same logic as {@link mergeProps}.
 * This function accepts an array of props instead of individual arguments.
 *
 * @param props Array of props to merge.
 * @returns The merged props.
 * @see mergeProps
 * @public
 */
export function mergePropsN<E extends ElementType | undefined = undefined>(
  props: PropsInput<E extends ElementType ? E : any>[],
): MergedPropsOf<E extends ElementType ? E : any> {
  return mergeProps<E>(props);
}

/**
 * https://github.com/solidjs-community/solid-primitives/blob/0cbdb59bb42f50de5e08000027789ae3d4c80280/packages/utils/src/index.ts#L82-L94
 * Returns a function that will call all functions in the reversed order with the same arguments.
 */
/** The ref callbacks a merged `ref` chains, so a consumer can apply each one exactly once. */
export const MERGED_REFS = Symbol('mergedRefs');

function chainRefs(refs: Function[]) {
  const chained = reverseChain(refs as ((...args: any[]) => any)[]);
  return Object.assign(chained, { [MERGED_REFS]: [...refs].reverse() });
}

export function reverseChain<Args extends [] | any[]>(
  callbacks: (((...args: Args) => any) | undefined)[],
): (...args: Args) => void {
  return (...args: Args) => {
    for (let i = callbacks.length - 1; i >= 0; i--) {
      const callback = callbacks[i];
      callback?.(...args);
    }
  };
}

function buildCallAllListeners(
  listenerArrays: Record<string, EventHandler[]>,
): Record<string, EventHandler> {
  const result = {} as Record<string, EventHandler>;
  for (const name in listenerArrays) {
    const handlers = listenerArrays[name];
    result[name] = (...args: any[]) => {
      return untrack(() => handlers.map((fn) => fn(...args)).find((val) => val !== undefined));
    };
  }
  return result;
}

function wrapEventHandler(handler: EventHandler | undefined): EventHandler | undefined {
  if (!handler) {
    return handler;
  }

  return (...args: unknown[]) => {
    const event = args[0];

    if (event instanceof Event) {
      makeEventPreventable(event as BaseUIEvent<typeof event>);
    }

    return untrack(() => handler(...args));
  };
}

function mergeEventHandlers(
  ourHandler: EventHandler | undefined,
  theirHandler: EventHandler | undefined,
): (...args: any[]) => void {
  if (!theirHandler) {
    return untrackedHandler(ourHandler) as any;
  }
  if (!ourHandler) {
    return wrapEventHandler(theirHandler) as any;
  }

  return untrackedHandler((...args: unknown[]) => {
    const event = args[0];

    if (event instanceof Event) {
      const baseUIEvent = event as BaseUIEvent<typeof event>;

      makeEventPreventable(baseUIEvent);

      const result = theirHandler(...args);

      if (!baseUIEvent.baseUIHandlerPrevented) {
        ourHandler?.(...args);
      }

      return result;
    }

    const result = theirHandler(...args);
    ourHandler?.(...args);
    return result;
  });
}

/**
 * Handlers never subscribe. An event can be dispatched from inside an effect (an effect that
 * calls `element.focus()`), and the handler's reads must not count as that effect's reads.
 */
function untrackedHandler<H extends EventHandler | undefined>(handler: H): H {
  if (!handler) {
    return handler;
  }
  return ((...args: unknown[]) => untrack(() => handler(...args))) as H;
}

export function makeEventPreventable<T extends Event>(event: BaseUIEvent<T>) {
  event.preventBaseUIHandler = () => {
    (event.baseUIHandlerPrevented as boolean) = true;
  };

  return event;
}
