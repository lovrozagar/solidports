/*
 * A dependency snapshot that keeps its previous object while its values are equal, so an effect
 * reading it applies only when a value changed: `createDepsEffect` semantics without its memo node.
 */
import { shallowEqual } from '../../solid-helpers';

export function dedupe<T extends object>(compute: () => T): () => T {
  let previous: T | undefined;
  return () => {
    const next = compute();
    if (previous !== undefined && shallowEqual(previous, next)) {
      return previous;
    }
    previous = next;
    return next;
  };
}
