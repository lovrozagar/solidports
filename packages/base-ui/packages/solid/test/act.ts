import { flush } from 'solid-js';

/**
 * Solid counterpart of React's `act()`: run the callback, then apply the writes it queued.
 * Wrap direct DOM calls (`element.click()`) that bypass testing-library's event wrapper.
 * Synchronous callbacks flush synchronously; async callbacks flush after they settle.
 */
export function act(callback: () => void): void;
export function act(callback: () => Promise<unknown>): Promise<void>;
export function act(callback: () => unknown): void | Promise<void> {
  const result = callback();
  if (result != null && typeof (result as Promise<unknown>).then === 'function') {
    return (result as Promise<unknown>).then(() => flush());
  }
  flush();
  return undefined;
}
