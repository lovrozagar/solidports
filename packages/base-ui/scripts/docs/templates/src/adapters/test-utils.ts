// `@mui/internal-test-utils` for the Solid docs' tests: React Testing Library's API on Solid's.
// A test's `rerender(<Component {...next} />)` is a props signal the rendered element reads (the
// transform writes it), so the rendered tree keeps its state, as React's rerender does.
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  cleanup,
  fireEvent as fireSolidEvent,
  render as renderSolid,
} from '@solidjs/testing-library';
import { afterEach } from 'vitest';

export { screen, within } from '@solidjs/testing-library';

/**
 * `fireEvent`, which applies the updates the event makes before it returns, as React Testing
 * Library's does (it fires in `act`).
 */
export const fireEvent = new Proxy(fireSolidEvent, {
  apply(target, thisArg, args) {
    const result = Reflect.apply(target, thisArg, args);
    flush();
    return result;
  },
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof value !== 'function') {
      return value;
    }
    return (...args: unknown[]) => {
      const result = value(...args);
      flush();
      return result;
    };
  },
});

/** `act`: runs the callback, then applies Solid's pending updates, as React's applies its own. */
export async function act(callback: () => unknown): Promise<void> {
  await callback();
  flush();
}

export interface CreateRendererOptions {
  /**
   * React's Strict Mode, which replays effect setup. Solid runs an effect's setup once, so the
   * option renders as without it.
   */
  strict?: boolean | undefined;
}

/** `createRenderer`: renders an element and settles it, and unmounts it after each test. */
export function createRenderer(options: CreateRendererOptions = {}) {
  void options;
  afterEach(() => cleanup());
  return {
    async render(element: JSX.Element) {
      const result = renderSolid(() => element);
      await act(() => Promise.resolve());
      return result;
    },
  };
}
