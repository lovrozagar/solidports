/**
 * The path that rendered each part's element, recorded in development only: `native` (the native
 * kit attached its attributes) or `slow` (`useRenderElement`). A part moves to the slow path
 * silently (a spread makes its props a proxy, a `render` prop), and both paths render the same
 * attributes, so tests assert the path (`expectNativePath` in the test utils). Production records
 * nothing.
 */
export type RenderPath = 'native' | 'slow';

const paths =
  process.env.NODE_ENV !== 'production' ? new WeakMap<Element, RenderPath>() : undefined;

/** Records the path that rendered `el` (development only). */
export function markRenderPath(el: Element, path: RenderPath): void {
  paths?.set(el, path);
}

/** The path that rendered `el`, or `undefined` for an element no part rendered. */
export function renderPathOf(el: Element): RenderPath | undefined {
  return paths?.get(el);
}
