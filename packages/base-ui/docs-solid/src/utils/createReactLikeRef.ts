/* Port-shim for React.useRef: returns a callable that also exposes `.current`.
 * Solid native-element refs are functions `(el) => void`; React-style demos use
 * `ref.current`. This shim works both ways: `<input ref={r} />` calls it as a
 * function (sets `r.current`), and `r.current` reads/writes the latest value. */
export interface ReactLikeRef<T> {
  (el: T | null): void;
  current: T | null;
}

export function createReactLikeRef<T>(init: T | null = null): ReactLikeRef<T> {
  const ref = ((el: T | null) => {
    ref.current = el;
  }) as ReactLikeRef<T>;
  ref.current = init;
  return ref;
}
