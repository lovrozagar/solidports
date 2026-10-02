/* eslint-disable typescript/no-explicit-any -- toast Data is generic, mirrors React */
import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastStore, selectors } from './store';
import type { ToastObject } from './useToastManager';

function createStore(toasts: ToastObject<any>[]) {
  // Solid: the store owns memos, so it is created inside a root.
  return createRoot(() =>
    ToastStore({
      // Mirrors `addToast`, which always stamps an `updateKey` on the way in.
      toasts: toasts.map((toast) => ({ updateKey: 0, ...toast })),
      timeout: 0,
      limit: 3,
      hovering: false,
      focused: false,
      isWindowFocused: true,
      viewport: null,
      prevFocusElement: null,
    }),
  );
}

// Solid: selectors take the toast id as an accessor.
function toastOf(store: ToastStore, id: string) {
  return selectors.toast(store.state, () => id);
}

function expectToastMetadataToMatchToasts(store: ToastStore) {
  let visibleIndex = 0;
  let offsetY = 0;

  store.state.toasts.forEach((toast, index) => {
    const isEnding = toast.transitionStatus === 'ending';

    expect(selectors.toast(store.state, () => toast.id)).toBe(toast);
    expect(selectors.toastIndex(store.state, () => toast.id)).toBe(index);
    expect(selectors.toastOffsetY(store.state, () => toast.id)).toBe(offsetY);
    expect(selectors.toastVisibleIndex(store.state, () => toast.id)).toBe(
      isEnding ? -1 : visibleIndex,
    );

    offsetY += toast.height || 0;

    if (!isEnding) {
      visibleIndex += 1;
    }
  });
}

describe('ToastStore', () => {
  it('keeps toast metadata synchronized after mutations', () => {
    const store = createStore([
      { id: 'newest', height: 30 },
      { id: 'middle', height: 40 },
      { id: 'oldest', height: 50 },
    ]);

    expectToastMetadataToMatchToasts(store);

    store.updateToastInternal('middle', { height: 45 });

    expectToastMetadataToMatchToasts(store);

    store.closeToast('middle');

    expectToastMetadataToMatchToasts(store);
    expect(toastOf(store, 'middle')?.transitionStatus).toBe('ending');

    store.removeToast('middle', true);

    expectToastMetadataToMatchToasts(store);

    store.addToast({ id: 'front', title: 'Front', timeout: 0 });

    expectToastMetadataToMatchToasts(store);
  });

  it('ignores height recalculations while a toast is transitioning out', () => {
    const store = createStore([{ id: 'a', height: 40 }]);

    store.closeToast('a');
    expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');

    // Mirrors the write `recalculateHeight` makes when a content observer fires:
    // it always includes `transitionStatus: undefined`. The ending toast must stay
    // ending so `useOpenChangeComplete` still removes it.
    store.updateToastInternal('a', { height: 80, transitionStatus: undefined });

    const toast = toastOf(store, 'a');
    expect(toast?.transitionStatus).toBe('ending');
    expect(toast?.height).toBe(0);

    store.removeToast('a', true);
    expect(toastOf(store, 'a')).toBe(undefined);
  });

  it('ignores mutations that target an unknown toast', () => {
    const store = createStore([{ id: 'a' }]);
    const toastsBefore = store.state.toasts;

    store.removeToast('missing');
    store.closeToast('missing');
    store.updateToast('missing', { title: 'nope' });

    expect(store.state.toasts).toBe(toastsBefore);
    expect(toastOf(store, 'a')?.transitionStatus).toBe(undefined);
  });

  it('replaces custom data wholesale when updating a toast', () => {
    const store = createStore([{ id: 'a', data: { name: 'Draft', count: 1 } }]);

    const nextData = { count: 2 };
    store.updateToast('a', { data: nextData });
    expect(toastOf(store, 'a')?.data).toBe(nextData);

    store.updateToast('a', { title: 'Saved' });
    expect(toastOf(store, 'a')?.data).toBe(nextData);

    store.updateToast('a', { data: undefined });
    expect(toastOf(store, 'a')?.data).toBe(undefined);
  });

  it('derives the update from the current toast when given a function', () => {
    const store = createStore([{ id: 'a', title: 'Draft', data: { name: 'Draft', count: 1 } }]);

    store.updateToast('a', (prevToast) => ({
      title: `${prevToast.title} (saved)`,
      data: { ...prevToast.data, count: 2 },
    }));
    const toast = toastOf(store, 'a');
    expect(toast?.title).toBe('Draft (saved)');
    expect(toast?.data).toEqual({ name: 'Draft', count: 2 });
    expect(toast?.updateKey).toBe(1);
  });

  it('passes a toast without custom data to the updater', () => {
    const store = createStore([{ id: 'a' }]);
    const updater = vi.fn((_prevToast: ToastObject<any>) => ({ data: { name: 'Draft' } }));

    store.updateToast('a', updater);
    expect(updater).toHaveBeenCalledTimes(1);
    const prevToast = updater.mock.calls[0]?.[0];
    expect(prevToast?.id).toBe('a');
    expect(prevToast?.data).toBe(undefined);
    expect(toastOf(store, 'a')?.data).toEqual({ name: 'Draft' });
  });

  it('stores a function passed as custom data instead of calling it', () => {
    const store = createStore([{ id: 'a', data: () => 'first' }]);
    const nextValue = () => 'second';

    store.updateToast('a', { data: nextValue });
    expect(toastOf(store, 'a')?.data).toBe(nextValue);
  });

  it('does not call the updater for a missing or ending toast', () => {
    const store = createStore([{ id: 'a', data: { name: 'Draft' } }]);
    store.closeToast('a');
    expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');

    const updater = vi.fn(() => ({}));
    store.updateToast('a', updater);
    store.updateToast('missing', updater);
    expect(updater).not.toHaveBeenCalled();
    expect(toastOf(store, 'a')?.data).toEqual({ name: 'Draft' });
  });

  it('keeps a toast added from inside an updater', () => {
    const store = createStore([{ id: 'a', data: { count: 1 } }]);

    store.updateToast('a', () => {
      store.addToast({ id: 'b' });
      return { data: { count: 2 } };
    });
    expect(store.state.toasts.map((toast) => toast.id)).toEqual(['b', 'a']);
    expect(toastOf(store, 'a')?.data).toEqual({ count: 2 });
    expectToastMetadataToMatchToasts(store);
  });

  it('keeps a toast closed from inside its updater closed', () => {
    const store = createStore([{ id: 'a', data: { count: 1 } }]);

    store.updateToast('a', () => {
      store.closeToast('a');
      return { data: { count: 2 } };
    });
    expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');
    expect(toastOf(store, 'a')?.data).toEqual({ count: 1 });
  });

  it('stores a function as the value when re-adding a toast under an existing id', () => {
    const store = createStore([]);
    const value = () => 'first';
    const nextValue = () => 'second';

    store.addToast({ id: 'a', data: value });
    store.addToast({ id: 'a', data: nextValue });
    expect(toastOf(store, 'a')?.data).toBe(nextValue);
  });

  it('replaces custom data when re-adding a toast under an existing id', () => {
    const store = createStore([]);

    store.addToast({ id: 'a', data: { status: 'error', errorCode: 42 } });
    store.addToast({ id: 'a', data: { status: 'ok' } });
    expect(toastOf(store, 'a')?.data).toEqual({ status: 'ok' });

    store.addToast({ id: 'a', title: 'Still uploading' });
    expect(toastOf(store, 'a')?.data).toEqual({ status: 'ok' });
  });

  it('stores a function passed as custom data on a promise toast', async () => {
    const store = createStore([]);
    const loadingValue = () => 'loading';
    const successValue = () => 'done';

    const pending = store.promiseToast(Promise.resolve('done'), {
      loading: { title: 'Saving', data: loadingValue },
      success: { title: 'Saved', data: successValue },
      error: 'Failed',
    });
    expect(store.state.toasts[0]?.data).toBe(loadingValue);

    await pending;
    expect(store.state.toasts[0]?.data).toBe(successValue);
  });

  it('does not invoke onRemove for a toast that is no longer in the store', () => {
    const onRemove = vi.fn();
    const store = createStore([{ id: 'a', onRemove }]);

    store.removeToast('a');
    expect(onRemove).toHaveBeenCalledTimes(1);

    // Removing again must be a no-op rather than firing the callback a second time.
    store.removeToast('a');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  describe('limit', () => {
    it('recomputes limited flags when the limit changes', () => {
      // Ordered newest-first, matching how `addToast` prepends.
      const store = createStore([{ id: 'c' }, { id: 'b' }, { id: 'a' }]);

      store.syncProviderProps(0, 1);
      expect(toastOf(store, 'c')?.limited).toBe(false);
      expect(toastOf(store, 'b')?.limited).toBe(true);
      expect(toastOf(store, 'a')?.limited).toBe(true);

      store.syncProviderProps(0, 3);
      expect(toastOf(store, 'c')?.limited).toBe(false);
      expect(toastOf(store, 'b')?.limited).toBe(false);
      expect(toastOf(store, 'a')?.limited).toBe(false);
    });
  });

  describe('timer pausing', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('re-pauses timers after the last toast is closed and a new one is added', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      // Add a toast with a running timer, then pause it (as a hover would).
      store.addToast({ title: 'a', timeout: 100 });
      store.pauseTimers();

      // Closing the last toast must clear the internal "paused" flag, otherwise
      // the next toast's timer can never be paused again.
      store.closeToast(store.state.toasts[0].id);

      store.addToast({ title: 'b', timeout: 100 });
      const newToastId = store.state.toasts[0].id;

      // Hovering again should pause the new toast's timer.
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(toastOf(store, newToastId)?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after all toasts are closed and a new one is added', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });
      store.addToast({ id: 'b', title: 'b', timeout: 100 });
      store.pauseTimers();

      store.closeToast();

      store.addToast({ id: 'c', title: 'c', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(toastOf(store, 'c')?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after the last active toast closes while ending toasts remain', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });
      store.addToast({ id: 'b', title: 'b', timeout: 100 });
      store.pauseTimers();

      store.closeToast('b');
      store.closeToast('a');

      store.addToast({ id: 'c', title: 'c', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(toastOf(store, 'c')?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after the last timed toast closes while untimed toasts remain', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'loading', title: 'loading', type: 'loading' });
      store.addToast({ id: 'timed', title: 'timed', timeout: 100 });
      store.pauseTimers();

      store.closeToast('timed');

      store.addToast({ id: 'c', title: 'c', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(toastOf(store, 'c')?.transitionStatus).not.toBe('ending');
    });

    it('keeps a rescheduled timer paused while expanded, and runs it once collapsed', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });

      // Hovering the viewport pauses the running timer.
      store.set('hovering', true);
      store.pauseTimers();

      // Passing `timeout` reschedules the timer. The replacement must not start
      // running while the viewport is still expanded.
      store.updateToast('a', { timeout: 100 });

      vi.advanceTimersByTime(200);
      expect(toastOf(store, 'a')?.transitionStatus).not.toBe('ending');

      // Collapsing must still be able to start the rescheduled timer.
      store.set('hovering', false);
      store.resumeTimers();

      vi.advanceTimersByTime(100);
      expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');
    });

    it('does not extend the remaining time across repeated pause/resume cycles', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 5000 });

      // Two hover cycles, each leaving the timer running for 1000ms.
      for (let cycle = 0; cycle < 2; cycle += 1) {
        vi.advanceTimersByTime(1000);
        store.pauseTimers();
        vi.advanceTimersByTime(1000);
        store.resumeTimers();
      }

      // 2000ms of the 5000ms timeout has been consumed, so 3000ms must remain.
      vi.advanceTimersByTime(2999);
      expect(toastOf(store, 'a')?.transitionStatus).not.toBe('ending');

      vi.advanceTimersByTime(2);
      expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');
    });

    it('restarts the full delay when the clock jumped past the timeout before pausing', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 5000 });

      // Mimics a throttled background tab: wall-clock time passes without the
      // scheduled timeout ever running.
      vi.setSystemTime(Date.now() + 60_000);
      store.pauseTimers();
      store.resumeTimers();

      vi.advanceTimersByTime(4999);
      expect(toastOf(store, 'a')?.transitionStatus).not.toBe('ending');

      vi.advanceTimersByTime(1);
      expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');
    });

    it('re-pauses timers after the last timed toast becomes untimed', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });
      store.pauseTimers();

      store.updateToastInternal('a', { timeout: 0 });

      store.addToast({ id: 'b', title: 'b', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(toastOf(store, 'b')?.transitionStatus).not.toBe('ending');
    });

    it('accumulates active time across hover cycles so the toast still dismisses', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });

      vi.advanceTimersByTime(40);
      store.pauseTimers();
      expect(toastOf(store, 'a')?.transitionStatus).not.toBe('ending');

      store.resumeTimers();
      vi.advanceTimersByTime(40);
      store.pauseTimers();
      expect(toastOf(store, 'a')?.transitionStatus).not.toBe('ending');

      store.resumeTimers();
      vi.advanceTimersByTime(40);

      expect(toastOf(store, 'a')?.transitionStatus).toBe('ending');
    });
  });
});
