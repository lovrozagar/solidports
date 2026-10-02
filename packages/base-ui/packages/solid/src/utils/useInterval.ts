import { createSignal } from 'solid-js';
import { registerOwnerCleanup } from './useTimeout';

type IntervalId = number;
export type Interval = ReturnType<typeof useInterval>;

const EMPTY = 0 as IntervalId;

/**
 * A `setInterval` with automatic cleanup and guard.
 */
export function useInterval() {
  const [currentId, setCurrentId] = createSignal<IntervalId>(EMPTY);

  function start(delay: number, fn: Function) {
    clear();
    setCurrentId(
      setInterval(() => {
        fn();
      }, delay) as unknown as IntervalId,
    );
  }

  function clear() {
    if (currentId() !== EMPTY) {
      clearInterval(currentId() as IntervalId);
      setCurrentId(EMPTY);
    }
  }

  function isStarted() {
    return currentId() !== EMPTY;
  }

  registerOwnerCleanup(clear);

  return { clear, isStarted, start };
}
