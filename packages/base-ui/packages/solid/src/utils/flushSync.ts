import { flush } from 'solid-js';

/**
 * Solid counterpart of `ReactDOM.flushSync`: runs the callback, then applies its writes before
 * returning, so code after the call reads the committed state.
 */
export function flushSync<T>(callback: () => T): T {
  return flush(callback) as T;
}
