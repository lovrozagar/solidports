import { getOwner, onCleanup, runWithOwner } from 'solid-js';

type TimeoutId = number;
export type Timeout = ReturnType<typeof useTimeout>;

const EMPTY = 0 as TimeoutId;

type OwnerNode = { _parent: OwnerNode | null };

export function registerOwnerCleanup(fn: () => void) {
  let owner = getOwner() as OwnerNode | null;
  while (owner) {
    try {
      runWithOwner(owner as never, () => {
        onCleanup(fn);
      });
      return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes('CLEANUP_IN_FORBIDDEN_SCOPE')
      ) {
        throw error;
      }
      owner = owner._parent;
    }
  }
}

/**
 * A `setTimeout` with automatic cleanup and guard.
 */
export function useTimeout() {
  let currentId: TimeoutId = EMPTY;

  function start(delay: number, fn: Function) {
    clear();
    currentId = setTimeout(() => {
      currentId = EMPTY;
      fn();
    }, delay) as unknown as TimeoutId;
  }

  function clear() {
    if (currentId !== EMPTY) {
      clearTimeout(currentId as TimeoutId);
      currentId = EMPTY;
    }
  }

  function isStarted() {
    return currentId !== EMPTY;
  }

  registerOwnerCleanup(clear);

  return { clear, isStarted, start };
}
