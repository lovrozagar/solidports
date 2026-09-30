import { createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { ToastStore } from './store';

/* Bug 6 regression: .catch handler used `return Promise.reject(error)` which
 * scheduled an extra microtask and could create an unhandled rejection in
 * instrumented environments. Post-fix uses `throw error` — same semantics,
 * conventional re-throw. */

const MINIMAL_STORE = {
  focused: false,
  hovering: false,
  isWindowFocused: true,
  limit: -1,
  prevFocusElement: null,
  timeout: 5000,
  toasts: [],
  viewport: null,
};

describe('ToastStore.promiseToast — rejection identity', () => {
  it('rejects with the original error (same identity, not wrapped)', async () => {
    let store!: ReturnType<typeof ToastStore>;
    createRoot(() => {
      store = ToastStore(MINIMAL_STORE);
    });

    const failure = new Error('boom');

    await expect(
      store.promiseToast(Promise.reject(failure), {
        error: (e) => ({ title: String(e) }),
        loading: { title: 'load' },
        success: () => ({ title: 'ok' }),
      }),
    ).rejects.toBe(failure);
  });

  it('updates the loading toast to type=error before the rejection escapes', async () => {
    let store!: ReturnType<typeof ToastStore>;
    createRoot(() => {
      store = ToastStore(MINIMAL_STORE);
    });

    const failure = new Error('boom');
    const settled = store.promiseToast(Promise.reject(failure), {
      error: () => ({ title: 'err-title' }),
      loading: { title: 'load' },
      success: () => ({ title: 'ok' }),
    });

    await expect(settled).rejects.toBe(failure);

    /* Toast must have been mutated to type=error before rejection propagated. */
    const toast = store.state.toasts.find((t) => t.title === 'err-title');
    expect(toast?.type).toBe('error');
  });
});
