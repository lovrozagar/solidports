import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  getObserver,
  isHydrating,
  Show,
  untrack,
} from 'solid-js';
import type { Accessor, Context } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isServer } from '@solidjs/web';
import type { PayloadChildRenderFunction } from './utils/popups';
import { mergeProps as solidMergeProps, splitProps, type SplitProps } from './solid-1-compat';

export function callEventHandler<T, E extends Event>(
  eventHandler: JSX.EventHandlerUnion<T, E> | undefined,
  event: E & { currentTarget?: T; target?: Element },
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
  if (!element || !element.hasAttribute('autofocus')) {
    return;
  }

  // Refs run ownerless once the element is inserted, so focus right away, as React applies
  // `autoFocus` during commit (before effects such as a focus manager's initial focus).
  if (element.isConnected) {
    element.focus();
  } else {
    queueMicrotask(() => element.focus());
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
  // eslint-disable-next-line solid/reactivity
  return solidMergeProps(defaults, props) as PropsMergeWithDefault<P, D>;
}

export function ComponentWithPayload<Payload>(props: {
  children: JSX.Element | PayloadChildRenderFunction<Payload>;
  payload: Accessor<Payload | undefined>;
}) {
  const cachedChildren = children(() => props.children as any);
  const childrenFn = createMemo(() => {
    const child = cachedChildren();
    return typeof child === 'function' ? (child as PayloadChildRenderFunction<Payload>) : null;
  });
  const payloadContext = {
    get payload() {
      return props.payload();
    },
  };

  return (
    <Show when={childrenFn()} fallback={cachedChildren()}>
      {(fn) => <>{fn()(payloadContext)}</>}
    </Show>
  );
}

/**
 * `<Context value={value}>{render()}</Context>` that hands back `render`'s own result. Outside SSR
 * and hydration, the provider runs `render` once (untracked, as a component body) and its children
 * memo stays internal: a part whose element is a plain node then gives its parent a node, not a
 * memo, so a list of parts adds nothing per row to the list's insert.
 */
export function provideContext<T>(
  context: Context<T>,
  value: T,
  render: () => JSX.Element,
): JSX.Element {
  const Provider = context as unknown as (props: {
    value: T;
    children: JSX.Element;
  }) => JSX.Element;
  if (isServer || isHydrating()) {
    // Hydration must create the same owners the server did.
    return <Provider value={value}>{render()}</Provider>;
  }
  let result: JSX.Element;
  let rendered = false;
  const resolveChildren = Provider({
    value,
    get children() {
      rendered = true;
      result = untrack(render);
      return undefined;
    },
  }) as unknown as () => unknown;
  // Once Solid's hydration runtime is enabled (any `hydrate()` on the page), the provider can hand
  // back its lazy children memo instead of that memo's value; read through it until the children
  // getter has run, or parts mounted after hydration render nothing.
  let next: unknown = resolveChildren;
  for (let depth = 0; !rendered && typeof next === 'function' && depth < 3; depth += 1) {
    next = untrack(next as () => unknown);
  }
  // `render` built its reactive graph inside the provider's lazy children memo. The production
  // runtime disposes an unobserved lazy memo, and every effect `render` created with it (the part
  // would freeze after its first paint), so keep the memo observed for the part's lifetime.
  createRenderEffect(resolveChildren, NOOP_APPLY);
  return result;
}

const NOOP_APPLY = () => {};
