import { flush } from 'solid-js';

/**
 * Solid counterpart of React's `await act(async () => {})`: lets pending promise reactions run
 * (React's act drains several microtask turns) and applies the writes they queue.
 */
export async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
    flush();
  }
}
