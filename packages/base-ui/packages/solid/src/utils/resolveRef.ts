import type { ReactLikeRef } from '../solid-helpers';

/**
 * If the provided argument is a ref object, returns its `current` value.
 * Otherwise, returns the argument itself.
 */
export function resolveRef<T extends HTMLElement | null | undefined>(
  maybeRef: T | ReactLikeRef<T>,
): T {
  if (maybeRef === null || maybeRef === undefined) {
    return maybeRef as T;
  }

  return 'current' in (maybeRef as object) ? (maybeRef as ReactLikeRef<T>).current : (maybeRef as T);
}
