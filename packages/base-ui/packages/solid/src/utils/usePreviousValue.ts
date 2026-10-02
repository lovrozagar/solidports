import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';

/**
 * Returns a previous value of its argument.
 * @param value Current value.
 * @returns Previous value, or null if there is no previous value.
 */
export function usePreviousValue<T>(value: Accessor<T>): Accessor<T | null> {
  // Solid: a memo derives the pair during the same flush, as React updates it during render.
  const state = createMemo<{ current: T; previous: T | null }>((prev) => {
    const current = value();
    if (prev === undefined) {
      return { current, previous: null };
    }
    if (Object.is(current, prev.current)) {
      return prev;
    }
    return { current, previous: prev.current };
  });

  return () => state().previous;
}
