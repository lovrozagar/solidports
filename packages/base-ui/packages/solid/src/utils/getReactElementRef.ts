/**
 * Extracts the `ref` from a render element: a `{ component, ...props }` config, the Solid
 * counterpart of a React element. A rendered node, a function, an array (a fragment) or any other
 * value has no ref to read.
 */
export function getReactElementRef(element: unknown): unknown {
  if (
    element == null ||
    typeof element !== 'object' ||
    Array.isArray(element) ||
    (typeof Node !== 'undefined' && element instanceof Node)
  ) {
    return null;
  }

  return (element as { ref?: unknown }).ref ?? null;
}
