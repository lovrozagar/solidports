// The docs runtime's counterparts of React APIs Solid has none of. `react-to-solid.mjs` points the
// transformed docs here; the generator copies this file to `docs/solid/src/adapters/react.ts`.
// Their arguments are values, as the React APIs take them; a result React re-reads on each render
// is an accessor.
import {
  createMemo,
  createRenderEffect,
  createSignal,
  isHydrating,
  onCleanup,
  onSettled,
  useContext,
} from 'solid-js';
import type { Accessor, Context } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';

/**
 * `React.useSyncExternalStore` as an accessor: the server snapshot on the server and through
 * hydration (so the markup matches), then the client snapshot, kept current by `subscribe`.
 */
export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): Accessor<T> {
  if (isServer) {
    const value = (getServerSnapshot ?? getSnapshot)();
    return () => value;
  }
  const initial = isHydrating() && getServerSnapshot ? getServerSnapshot() : getSnapshot();
  const [value, setValue] = createSignal<{ current: T }>({ current: initial });
  onSettled(() => {
    const update = () => setValue({ current: getSnapshot() });
    update();
    onCleanup(subscribe(update));
  });
  return () => value().current;
}

/** `React.useReducer`: state as an accessor and a dispatch that applies the reducer. */
export function useReducer<S, A, I = S>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (arg: I) => S,
): [Accessor<S>, (action: A) => void] {
  const initial = init ? init(initialArg) : (initialArg as unknown as S);
  const [state, setState] = createSignal<{ current: S }>({ current: initial });
  const dispatch = (action: A) => setState((prev) => ({ current: reducer(prev.current, action) }));
  return [() => state().current, dispatch];
}

/** `React.useTransition`: Solid batches writes itself, so the update runs now and never pends. */
export function useTransition(): [Accessor<boolean>, (callback: () => void) => void] {
  return [() => false, (callback) => callback()];
}

/** `React.useActionState`: the action's latest result and whether a call is in flight. */
export function useActionState<S, P>(
  action: (state: S, payload: P) => S | Promise<S>,
  initialState: S,
): [Accessor<S>, (payload: P) => void, Accessor<boolean>] {
  const [state, setState] = createSignal<{ current: S }>({ current: initialState });
  const [pending, setPending] = createSignal(0);
  const dispatch = (payload: P) => {
    setPending((count) => count + 1);
    Promise.resolve(action(state().current, payload))
      .then((next) => setState({ current: next }))
      .finally(() => setPending((count) => count - 1));
  };
  return [() => state().current, dispatch, () => pending() > 0];
}

/** `React.useOptimistic`: the passed state, or the optimistic one until the state changes. */
export function useOptimistic<S, A>(
  state: S,
  update: (state: S, action: A) => S = (_state, action) => action as unknown as S,
): [Accessor<S>, (action: A) => void] {
  const [optimistic, setOptimistic] = createSignal<{ current: S }>({ current: state });
  return [
    () => optimistic().current,
    (action) => setOptimistic({ current: update(state, action) }),
  ];
}

/**
 * `React.use`: a context's value (a docs context holds an accessor, which is returned as it is),
 * or a promise's, read through an async memo that suspends to the nearest `<Loading>`.
 */
export function use<T>(usable: PromiseLike<T> | Context<Accessor<T>>): Accessor<T> {
  if (typeof (usable as PromiseLike<T>).then === 'function') {
    const promise = usable as PromiseLike<T>;
    return createMemo(() => promise);
  }
  return useContext(usable as Context<Accessor<T>>);
}

/** `React.useImperativeHandle`: hands the ref its handle. */
export function useImperativeHandle<T>(
  ref: ((handle: T) => void) | { current: T | null } | null | undefined,
  create: () => T,
) {
  const handle = create();
  if (typeof ref === 'function') {
    ref(handle);
  } else if (ref) {
    ref.current = handle;
  }
}

// CSS properties that take a number as is; React writes any other number in pixels.
const UNITLESS = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexShrink',
  'flexNegative',
  'flexOrder',
  'gridArea',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'fontWeight',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
  'fillOpacity',
  'floodOpacity',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
]);

/**
 * A React `style` value as Solid takes it: CSS property names (custom properties as they are),
 * pixels for a number, and no entry for `null`. A function (a Base UI style of the state) returns
 * its result converted.
 */
export function reactStyle<T>(
  style: T,
): T extends (...args: infer A) => unknown
  ? (...args: A) => JSX.CSSProperties | undefined
  : JSX.CSSProperties | string | undefined;
export function reactStyle(style: unknown): unknown {
  if (typeof style === 'function') {
    return (...args: unknown[]) => reactStyle(style(...args));
  }
  if (style == null || typeof style !== 'object') {
    return style ?? undefined;
  }
  const converted: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null || typeof value === 'boolean') {
      continue;
    }
    const name = key.startsWith('--')
      ? key
      : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
    converted[name] =
      typeof value === 'number' && value !== 0 && !UNITLESS.has(key) ? `${value}px` : value;
  }
  return converted;
}

/**
 * React's `useLayoutEffect`: render effect timing on the client. On the server the computation is
 * still created (hydration ids stay aligned) and its compute runs, but the effect does not: React
 * never runs layout effects on the server, and Solid's server runs a render effect's.
 */
export function createLayoutEffect<T>(
  compute: Parameters<typeof createRenderEffect<T>>[0],
  effect: Parameters<typeof createRenderEffect<T>>[1],
): void {
  createRenderEffect<T>(compute, isServer ? (undefined as never) : effect);
}

const ELEMENT = Symbol.for('docs.element');

/**
 * A React element: JSX kept as a value, rendered where it is placed (Solid inserts a function by
 * calling it there, in that place's context).
 */
export function element(render: () => JSX.Element): JSX.Element {
  return Object.assign(render, { [ELEMENT]: true }) as unknown as JSX.Element;
}

/** `React.isValidElement`: a value made by `element()`. */
export function isValidElement(value: unknown): value is JSX.Element {
  return typeof value === 'function' && ELEMENT in value;
}
