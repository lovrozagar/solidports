// `react-dom` for the Solid docs. `createPortal` is a `<Portal>` (the transform writes it);
// `flushSync` applies the updates its callback makes before it returns, as React's does.
import { flush } from 'solid-js';

export function flushSync<R>(callback: () => R): R {
  const result = callback();
  flush();
  return result;
}
