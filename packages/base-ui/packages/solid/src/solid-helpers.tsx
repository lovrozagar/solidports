import {
  $PROXY,
  children,
  createEffect,
  createMemo,
  createOwner,
  createRenderEffect,
  getObserver,
  isHydrating,
  isStatic,
  omit,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor, Context, Owner } from 'solid-js';
// `solid-js` does not re-export `hasStaticKeys` or `setContext`; `@solidjs/signals` is a peer pinned
// to the solid-js range, so this is the same core solid-js runs on in the browser.
import { hasStaticKeys, setContext } from '@solidjs/signals';
import type { JSX } from '@solidjs/web';
import { isServer } from '@solidjs/web';
import type { PayloadChildRenderFunction } from './utils/popups';
import { mergeProps as solidMergeProps, splitProps } from './solid-1-compat';
import type { SplitProps } from './solid-1-compat';

export function callEventHandler<T, E extends Event>(
  eventHandler: JSX.EventHandlerUnion<T, E> | undefined,
  event: E & { currentTarget?: T | undefined; target?: Element | undefined },
) {
  if (eventHandler) {
    // Handlers never subscribe (see mergeProps' wrapEventHandler).
    untrack(() => {
      if (typeof eventHandler === 'function') {
        eventHandler(event);
      } else {
        eventHandler[0](eventHandler[1], event);
      }
    });
  }

  return event.defaultPrevented;
}

/**
 * Whether `props[key]` is undefined now and can never change (unset, or a literal `undefined`):
 * a part can then skip the computation that would follow it.
 */
export function isAbsentProp<T extends object>(props: T, key: keyof T & string): boolean {
  return untrack(() => !(key in props) || (isStatic(props, key) && props[key] === undefined));
}

export type Accessify<T, AccessorKeys extends keyof T> = {
  [K in keyof T]: K extends AccessorKeys ? Accessor<T[K]> : T[K];
};

// https://github.com/solidjs-community/solid-primitives/blob/461ab9edda2ffa6666d7ed2d5deed8b6b77f65a6/packages/utils/src/types.ts#L29
export type MaybeAccessor<T> = T | Accessor<T>;

// https://github.com/solidjs-community/solid-primitives/blob/461ab9edda2ffa6666d7ed2d5deed8b6b77f65a6/packages/utils/src/types.ts#L42C1-L44C7
export type MaybeAccessorValue<T extends MaybeAccessor<any>> = T extends () => any
  ? ReturnType<T>
  : T;

export function autofocus(element: HTMLElement | null | undefined) {
  if (!element) {
    return;
  }

  // Refs run ownerless once the element is inserted, so focus right away, as React applies
  // `autoFocus` during commit (before effects such as a focus manager's initial focus). An element
  // not yet inserted, or whose attributes are still being applied, is checked once it settles.
  if (element.isConnected && element.hasAttribute('autofocus')) {
    element.focus();
  } else {
    queueMicrotask(() => {
      if (element.isConnected && element.hasAttribute('autofocus')) {
        element.focus();
      }
    });
  }
}

// https://github.com/solidjs-community/solid-primitives/blob/461ab9edda2ffa6666d7ed2d5deed8b6b77f65a6/packages/utils/src/index.ts#L106C1-L107C59
/** Shallow equality: `Object.is`, or same keys with `Object.is` values (a React dependency list). */
export function shallowEqual(prev: unknown, next: unknown) {
  if (Object.is(prev, next)) {
    return true;
  }
  if (prev == null || next == null || typeof prev !== 'object' || typeof next !== 'object') {
    return false;
  }
  const prevKeys = Object.keys(prev);
  if (prevKeys.length !== Object.keys(next).length) {
    return false;
  }
  return prevKeys.every((key) =>
    Object.is((prev as Record<string, unknown>)[key], (next as Record<string, unknown>)[key]),
  );
}

type DepsEffectFn<T> = (deps: T, prev: T | undefined) => void | (() => void);

/**
 * React `useEffect(fn, deps)`: `deps` reads the dependency values and returns them as an object
 * (or array). The effect runs when one of them changes by `Object.is`, as React compares its
 * dependency array; recomputing to equal values does not re-run it. The effect returns its
 * cleanup.
 */
export function createDepsEffect<T>(deps: () => T, effect: DepsEffectFn<T>) {
  createEffect(createMemo(deps, { equals: shallowEqual }), effect);
}

/**
 * A memo of dependency values (an object or array) that only changes when one of them changes by
 * `Object.is`, as a React dependency array.
 */
export function createDepsMemo<T>(deps: () => T) {
  return createMemo(deps, { equals: shallowEqual });
}

/**
 * React's `useLayoutEffect` / `useIsoLayoutEffect`: `createRenderEffect` timing on the client. On
 * the server the computation is still created (hydration ids stay aligned) and its compute runs, but
 * the apply does not: React never runs layout effects on the server, and Solid's server runs a
 * render effect's apply, so ported registrations and DOM work would write or touch the DOM there.
 */
export function createLayoutEffect<T>(
  compute: Parameters<typeof createRenderEffect<T>>[0],
  effect: Parameters<typeof createRenderEffect<T>>[1],
  options?: Parameters<typeof createRenderEffect<T>>[2],
): void {
  // On the server, no apply: the computation exists (ids stay aligned) and its compute runs.
  createRenderEffect<T>(compute, isServer ? (undefined as never) : effect, options);
}

/** `createDepsEffect` with render-effect timing (React's `useIsoLayoutEffect`). */
export function createDepsRenderEffect<T>(deps: () => T, effect: DepsEffectFn<T>) {
  createLayoutEffect(createMemo(deps, { equals: shallowEqual }), effect);
}

const objectPrototype = Object.prototype as unknown as {
  __lookupGetter__(key: string): unknown;
  __lookupSetter__(key: string): unknown;
};
const lookupGetter = objectPrototype.__lookupGetter__;
const lookupSetter = objectPrototype.__lookupSetter__;

/**
 * Solid's `isStatic` for props that are not a Solid proxy: whether `key` is absent or a plain value
 * (no getter or setter). Looked up without a property descriptor, which `isStatic` builds for every
 * key it checks: a native part checks every consumer key of every element, and the descriptors
 * were a share of hydration's allocation.
 */
export function isStaticKey(props: object, key: string): boolean {
  // Called through `Object.prototype`: split props have a null prototype.
  return lookupGetter.call(props, key) === undefined && lookupSetter.call(props, key) === undefined;
}

/**
 * Whether `props[key]` can never change: a plain value, or a key that is absent from props whose
 * key set is fixed. A Solid proxy (a `merge` result, a dynamic spread) with a changing key set can
 * gain the key later, so an absent key there is not static.
 */
export function isStaticProp(props: object, key: string) {
  if (key in props) {
    return (props as Record<PropertyKey, unknown>)[$PROXY]
      ? isStatic(props, key)
      : isStaticKey(props, key);
  }
  return !(props as Record<PropertyKey, unknown>)[$PROXY] || hasStaticKeys(props);
}

/**
 * Whether `props[key]` can ever be truthy: a reactive or dynamic key, a function (an accessor),
 * or a truthy static value. A part whose input can never be true skips the machinery it gates (a
 * never-disabled button binds no disabled gates).
 */
export function mayBeTruthy(props: object, key: string): boolean {
  if (!isStaticProp(props, key)) {
    return true;
  }
  if (!(key in props)) {
    return false;
  }
  const value = untrack(() => (props as Record<string, unknown>)[key]);
  return typeof value === 'function' || Boolean(value);
}

/**
 * An accessor for the latest value: it subscribes inside computations and reads untracked
 * elsewhere (event handlers, effect callbacks and cleanups), as React code reads refs and stores
 * imperatively.
 */
export function live<T>(read: () => T): () => T {
  return () => (getObserver() === null ? untrack(read) : read());
}

export function access<V extends MaybeAccessor<unknown>>(
  v: V,
): V extends Accessor<infer U> ? U : V {
  return typeof v === 'function' && !v.length ? (v as Function)() : (v as any);
}

export type Args<T extends ((...args: any[]) => any) | undefined | null> = Parameters<
  Exclude<T, undefined | null>
>;

/**
 * The element props of a part: `props` without `class`, `render` and the part's
 * own `keys`, as one Solid `omit` view. Replaces `splitComponentProps`: the part reads its own
 * props directly (`componentProps.disabled`), so no getter is defined per picked key.
 */
export function omitComponentProps<T extends Record<any, any>, K extends readonly (keyof T)[]>(
  props: T,
  keys: K,
): Omit<T, K[number] | 'class' | 'render'> {
  return omit(props, 'class', 'render', ...keys) as unknown as Omit<
    T,
    K[number] | 'class' | 'render'
  >;
}

export function splitComponentProps<
  T extends Record<any, any>,
  K extends [readonly (keyof T)[], ...(readonly (keyof T)[])[]],
>(props: T, ...keys: K) {
  const [componentProps, ...others] = splitProps(props, ['class', 'render'], ...keys);
  return [componentProps, ...others] as unknown as SplitProps<
    T,
    [componentPropsToOmit: ['class', 'render'], ...K]
  >;
}

export type CodependentRefs<T extends string[]> = {
  [K in T[number]]?: {
    ref: Accessor<HTMLElement | null | undefined>;
    id: Accessor<string | undefined>;
    explicitId: Accessor<string | undefined>;
  };
};

// https://github.com/solidjs/solid/issues/2478#issuecomment-2888503241
export function childrenLazy(resolver: () => JSX.Element) {
  const _s = Symbol();
  let x: any = _s;
  return () => {
    if (x === _s) {
      x = children(resolver);
    }
    return x;
  };
}

export type ReactLikeRef<T> = { current: T };
export function useRef<T>(initialValue: T): ReactLikeRef<T>;
export function useRef<T>(initialValue: T | null): ReactLikeRef<T | null>;
export function useRef<T>(initialValue: T | undefined): ReactLikeRef<T | undefined> {
  const ref = { current: initialValue };
  return ref;
}

type Simplify<T> = T extends any ? { [K in keyof T]: T[K] } : T;
type OnlyDeclaredProps<P, D extends Partial<P>> = {
  -readonly [K in keyof D]-?: D[K] | Exclude<P[K extends keyof P ? K : never], undefined>;
};

export type PropsMergeWithDefault<P, D extends Partial<P>> = Simplify<{
  [K in keyof (P & OnlyDeclaredProps<P, D>)]: K extends keyof D
    ? OnlyDeclaredProps<P, D>[K]
    : P[K extends keyof P ? K : never];
}>;

export function defaultProps<
  P extends object,
  D extends Partial<P>,
  C extends { [K in Extract<keyof D, keyof P> as keyof D]?: D[K] },
>(props: P, defaults: D extends C ? D : C) {
  return solidMergeProps(defaults, props) as PropsMergeWithDefault<P, D>;
}

export function ComponentWithPayload<Payload>(props: {
  children: JSX.Element | PayloadChildRenderFunction<Payload>;
  payload: Accessor<Payload | undefined>;
}) {
  const payloadContext = {
    get payload() {
      return props.payload();
    },
  };
  // One memo for a closed popup root's children, where `children()`, a `Show` and its branches took
  // nine nodes per root (D32's closed-root unit). A render function gets a memo of its own, created
  // under this one when the function changes: a payload function is called with the payload context,
  // and a zero-arity function in its own memo, since resolved in place it would be called again
  // (re-creating its components) each time an accessor it returned updates.
  return createMemo(() => {
    const child = props.children;
    if (typeof child !== 'function') {
      return child;
    }
    if (child.length === 0) {
      return createMemo(child as () => JSX.Element);
    }
    return createMemo(() => (child as PayloadChildRenderFunction<Payload>)(payloadContext));
  }) as unknown as JSX.Element;
}
const TRANSPARENT = { transparent: true };

/**
 * An owner, child of the current one, that carries `context = value` for everything created under
 * it. Transparent: it takes no hydration id of its own, so its children consume ids from the
 * nearest id-carrying ancestor, as without it. Client only, outside hydration.
 */
export function createContextOwner<T>(context: Context<T>, value: T): Owner {
  const owner = createOwner(TRANSPARENT);
  setContext(context, value, owner);
  return owner;
}

/**
 * `<Context value={value}>{render()}</Context>` that hands back `render`'s own result. On the
 * client after hydration, `render` runs once (untracked, as a component body) under one
 * transparent owner that carries the context (`createContextOwner`): no provider root and no lazy
 * children memo, so a part costs one owner instead of four nodes, and a part whose element is a
 * plain node gives its parent a node. The server and hydration render the provider (D5): the
 * server's owners are `solid-js`'s own, which a signals `setContext` does not reach, and
 * hydration must create the owners the server did.
 */
export function provideContext<T>(
  context: Context<T>,
  value: T,
  render: () => JSX.Element,
): JSX.Element {
  if (isServer || isHydrating()) {
    const Provider = context as unknown as (props: {
      value: T;
      children: JSX.Element;
    }) => JSX.Element;
    // Hydration must create the same owners the server did.
    return <Provider value={value}>{render()}</Provider>;
  }
  return runWithOwner(createContextOwner(context, value), () => untrack(render));
}
