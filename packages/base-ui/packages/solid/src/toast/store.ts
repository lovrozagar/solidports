/* eslint-disable typescript/no-explicit-any -- toast Data is generic at consumer; StoredToast<any> erases consumer type at store level, mirrors React */
import { createSignal, getObserver, runWithOwner, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { activeElement, contains, getTarget } from '../floating-ui-solid/utils';
import { generateId } from '../utils/generateId';
import { ownerDocument } from '../utils/owner';
import { SolidStore } from '../utils/store/SolidStoreV2';
import { useTimeout, type Timeout } from '../utils/useTimeout';
import {
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastObject,
} from './useToastManager';
import { resolvePromiseOptions } from './utils/resolvePromiseOptions';
import { isFocusVisible } from './utils/focusVisible';

type ToastInternalUpdateOptions<Data extends object> = Partial<
  Omit<ToastObject<Data>, 'id' | 'updateKey'>
>;

/**
 * A toast once it lives in the store. `addToast` is the only way in and it always
 * assigns `updateKey`, so unlike the public `ToastObject` it is never missing.
 */
export type StoredToast<Data extends object = any> = ToastObject<Data> & { updateKey: number };

export type State = {
  toasts: StoredToast[];
  toastMetadata: Map<string, ToastMetadata>;
  hovering: boolean;
  focused: boolean;
  timeout: number;
  limit: number;
  isWindowFocused: boolean;
  viewport: HTMLElement | null;
  prevFocusElement: HTMLElement | null;
};

type ToastMetadata = {
  value: StoredToast;
  domIndex: number;
  visibleIndex: number;
  offsetY: number;
};

type InitialState = Omit<State, 'toastMetadata'>;

function createToastMetadata(toasts: StoredToast[]) {
  const metadata = new Map<string, ToastMetadata>();
  let visibleIndex = 0;
  let offsetY = 0;

  toasts.forEach((toast, toastIndex) => {
    const isEnding = toast.transitionStatus === 'ending';
    metadata.set(toast.id, {
      value: toast,
      domIndex: toastIndex,
      visibleIndex: isEnding ? -1 : visibleIndex,
      offsetY,
    });

    offsetY += toast.height || 0;

    if (!isEnding) {
      visibleIndex += 1;
    }
  });

  return metadata;
}

// Marks the active (non-ending) toasts beyond `limit` as limited. Callers pass
// toasts in newest-first order, so the newest `limit` toasts stay visible and
// the rest are flagged. Returns the same toast reference when its `limited`
// flag is unchanged to avoid unnecessary re-renders.
function applyLimited(toasts: StoredToast[], limit: number): StoredToast[] {
  let activeIndex = 0;
  return toasts.map((toast) => {
    if (toast.transitionStatus === 'ending') {
      return toast;
    }
    const limited = activeIndex >= limit;
    activeIndex += 1;
    return toast.limited === limited ? toast : { ...toast, limited };
  });
}

// Solid: selector arguments are accessors, so a selector subscribes to the id it reads.
export const selectors = {
  toasts: (state: State) => state.toasts,
  isEmpty: (state: State) => state.toasts.length === 0,
  toast: (state: State, id: Accessor<string>) => state.toastMetadata.get(id())?.value,
  toastIndex: (state: State, id: Accessor<string>) => state.toastMetadata.get(id())?.domIndex ?? -1,
  toastOffsetY: (state: State, id: Accessor<string>) => state.toastMetadata.get(id())?.offsetY ?? 0,
  toastVisibleIndex: (state: State, id: Accessor<string>) =>
    state.toastMetadata.get(id())?.visibleIndex ?? -1,
  focused: (state: State) => state.focused,
  expanded: (state: State) => state.hovering || state.focused,
  expandedOrOutOfFocus: (state: State) => state.hovering || state.focused || !state.isWindowFocused,
  prevFocusElement: (state: State) => state.prevFocusElement,
};

/**
 * Solid: a toast with a stable identity, so lists keyed by reference keep their item when the
 * toast updates. Like the store, tracked reads see the committed toast and untracked reads (store
 * methods, handlers) see the latest one, including key enumeration for spreads.
 */
function createToastRecord(initialToast: StoredToast) {
  let latest = initialToast;
  const [committed, setCommitted] = createSignal(initialToast);
  const current = () => (getObserver() === null ? latest : committed());

  const record = new Proxy({} as StoredToast, {
    get: (_, key) => Reflect.get(current(), key),
    has: (_, key) => Reflect.has(current(), key),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  function write(nextToast: StoredToast) {
    latest = nextToast;
    runWithOwner(null, () => untrack(() => setCommitted(() => nextToast)));
  }

  return { record, write };
}

function shallowEqualToast(a: StoredToast, b: StoredToast) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.is(a[key as keyof StoredToast], b[key as keyof StoredToast]))
  );
}

// Solid: React's `Timeout.create()`; created ownerless so an owning effect re-run never clears it.
function createTimeout(): Timeout {
  return runWithOwner(null, useTimeout);
}

/**
 * Solid: React's `ToastStore extends ReactStore`. The base store already has React's synchronous
 * semantics (untracked reads see the latest write), so the methods port one to one.
 */
export function ToastStore(initialState: InitialState) {
  // Solid: lists key by reference (`<For>`), while React keys toasts by `id`. Each toast keeps one
  // record per id; updates are written into it, so a list keeps its item and only the changed
  // fields update. The records read synchronously like the store itself.
  const toastRecords = new Map<string, ReturnType<typeof createToastRecord>>();

  function reconcileToasts(nextToasts: StoredToast[]) {
    let changed = false;
    const nextIds = new Set<string>();
    const reconciled = nextToasts.map((toast) => {
      nextIds.add(toast.id);
      const existing = toastRecords.get(toast.id);
      if (!existing) {
        const created = createToastRecord({ ...toast });
        toastRecords.set(toast.id, created);
        changed = true;
        return created.record;
      }
      if (existing.record !== toast && !shallowEqualToast(existing.record, toast)) {
        existing.write({ ...toast });
        changed = true;
      }
      return existing.record;
    });
    toastRecords.forEach((_, id) => {
      if (!nextIds.has(id)) {
        scheduleRecordRemoval(id);
      }
    });
    return { toasts: reconciled, changed };
  }

  // Solid: React keeps a keyed instance when its key leaves and returns within one update
  // (re-adding an ending toast removes and re-adds it). Keep a removed record until the end of
  // the tick, so a re-add in the same tick reuses it and the list keeps its item.
  const pendingRecordRemovals = new Set<string>();

  function scheduleRecordRemoval(id: string) {
    if (pendingRecordRemovals.has(id)) {
      return;
    }
    pendingRecordRemovals.add(id);
    queueMicrotask(() => {
      pendingRecordRemovals.delete(id);
      if (!state.toasts.some((toast) => toast.id === id)) {
        toastRecords.delete(id);
      }
    });
  }

  const initialToasts = reconcileToasts(initialState.toasts).toasts;
  const base = SolidStore<State, {}, typeof selectors>(
    {
      ...initialState,
      toasts: initialToasts,
      toastMetadata: createToastMetadata(initialToasts),
    },
    {},
    selectors,
  );
  const { state } = base;

  const timers = new Map<string, TimerInfo>();

  let areTimersPaused = false;

  const setViewport = (viewport: HTMLElement | null) => {
    base.set('viewport', viewport);
  };

  function syncProviderProps(timeout: number, limit: number) {
    const limitChanged = state.limit !== limit;

    if (state.timeout === timeout && !limitChanged) {
      return;
    }

    const updates = { timeout, limit } as Pick<
      State,
      'timeout' | 'limit' | 'toasts' | 'toastMetadata'
    >;

    if (limitChanged) {
      // Solid: reconcile into the per-id records, so rendered toasts see the new `limited` flag.
      const newToasts = reconcileToasts(applyLimited(state.toasts, limit)).toasts;
      updates.toasts = newToasts;
      updates.toastMetadata = createToastMetadata(newToasts);
    }

    base.update(updates);
  }

  const disposeEffect = () => {
    return () => {
      timers.forEach((timer) => {
        timer.timeout?.clear();
      });
      timers.clear();
    };
  };

  function removeToast(toastId: string, skipOnRemove: boolean = false) {
    const index = selectors.toastIndex(state, () => toastId);
    if (index === -1) {
      return;
    }

    const toast = state.toasts[index];
    if (!skipOnRemove) {
      toast?.onRemove?.();
    }

    const newToasts = [...state.toasts];
    newToasts.splice(index, 1);
    setToasts(newToasts);
  }

  const addToast = <Data extends object>(toast: ToastManagerAddOptions<Data>): string => {
    const { timeout, limit } = state;
    const id = toast.id || generateId('toast');

    if (toast.id) {
      const toastId = toast.id;
      const existingToast = selectors.toast(state, () => toastId);

      if (existingToast) {
        if (existingToast.transitionStatus === 'ending') {
          removeToast(toastId, true);
        } else {
          const { id: ignoredId, transitionStatus: ignoredTransitionStatus, ...updates } = toast;
          updateToastInternal(toastId, updates, true, true);
          return toastId;
        }
      }
    }

    const toastToAdd: StoredToast<Data> = {
      ...toast,
      id,
      updateKey: 0,
      transitionStatus: 'starting',
    };

    const updatedToasts = [toastToAdd, ...state.toasts];
    setToasts(applyLimited(updatedToasts, limit));

    const duration = toastToAdd.timeout ?? timeout;
    if (toastToAdd.type !== 'loading' && duration > 0) {
      scheduleTimer(id, duration, () => closeToast(id));
    }

    if (selectors.expandedOrOutOfFocus(state)) {
      pauseTimers();
    }

    return id;
  };

  const updateToast = <Data extends object>(
    id: string,
    updates:
      | ToastManagerUpdateOptions<Data>
      | ((prevToast: ToastObject<Data>) => ToastManagerUpdateOptions<Data>),
  ) => {
    const prevToast = selectors.toast(state, () => id);
    // Never run the updater for an update the store is going to ignore.
    if (!prevToast || prevToast.transitionStatus === 'ending') {
      return;
    }

    // The updater may have called back into the store, so the internal update
    // reads the current state again.
    updateToastInternal(
      id,
      // Solid: the record is updated in place, so the updater gets a snapshot, as React's
      // immutable toast.
      typeof updates === 'function' ? updates({ ...prevToast }) : updates,
      false,
      true,
    );
  };

  const updateToastInternal = <Data extends object>(
    id: string,
    updates: ToastInternalUpdateOptions<Data>,
    resetTimer: boolean = false,
    markUpdated: boolean = false,
  ) => {
    const { timeout, toasts } = state;
    const prevToastRecord = selectors.toast(state, () => id);
    if (!prevToastRecord) {
      return;
    }
    // Solid: records update in place, so keep the previous values as React's immutable toast.
    const prevToast: StoredToast = { ...prevToastRecord };

    // Ignore updates for toasts that are already closing.
    // This prevents races where async updates (e.g. promise success/error)
    // can block a dismissal from completing.
    if (prevToast.transitionStatus === 'ending') {
      return;
    }

    const nextToast: StoredToast<Data> = {
      ...prevToast,
      ...updates,
      ...(markUpdated && {
        updateKey: prevToast.updateKey + 1,
      }),
    };

    setToasts(toasts.map((toast) => (toast.id === id ? nextToast : toast)));

    const nextTimeout = nextToast.timeout ?? timeout;
    const prevTimeout = prevToast.timeout ?? timeout;

    const timeoutUpdated = Object.hasOwn(updates, 'timeout');

    const shouldHaveTimer =
      nextToast.transitionStatus !== 'ending' && nextToast.type !== 'loading' && nextTimeout > 0;

    const hasTimer = timers.has(id);
    const timeoutChanged = prevTimeout !== nextTimeout;
    const wasLoading = prevToast.type === 'loading';

    if (!shouldHaveTimer && hasTimer) {
      clearTimer(id);
      return;
    }

    // Schedule or reschedule timer if needed
    if (
      shouldHaveTimer &&
      (!hasTimer || timeoutChanged || timeoutUpdated || wasLoading || resetTimer)
    ) {
      clearTimer(id);

      scheduleTimer(id, nextTimeout, () => closeToast(id));

      if (selectors.expandedOrOutOfFocus(state)) {
        pauseTimers();
      }
    }
  };

  const closeToast = (toastId?: string) => {
    const closeAll = toastId === undefined;
    const { limit, toasts } = state;
    let toastsToClose: StoredToast[];

    if (closeAll) {
      toastsToClose = toasts;
      clearTimers();
    } else {
      const toast = selectors.toast(state, () => toastId);
      if (!toast) {
        return;
      }
      toastsToClose = [toast];
      clearTimer(toastId);
    }

    const endingToasts = toasts.map((item) =>
      closeAll || item.id === toastId
        ? { ...item, transitionStatus: 'ending' as const, height: 0 }
        : item,
    );
    const newToasts = applyLimited(endingToasts, limit);
    // Solid: records update in place, so read which toasts were already closing beforehand.
    const wasEnding = toastsToClose.map((toast) => toast.transitionStatus === 'ending');
    setToasts(newToasts, !newToasts.some((toast) => toast.transitionStatus !== 'ending'));

    toastsToClose.forEach((toast, index) => {
      if (!wasEnding[index]) {
        toast.onClose?.();
      }
    });

    handleFocusManagement(toastId);
  };

  const promiseToast = <Value, Data extends object>(
    promiseValue: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, Data>,
  ): Promise<Value> => {
    // Create a loading toast (which does not auto-dismiss).
    const loadingOptions = resolvePromiseOptions(options.loading);
    const id = addToast({
      ...loadingOptions,
      type: 'loading',
    });

    const handledPromise = promiseValue
      .then((result: Value) => {
        const successOptions = resolvePromiseOptions(options.success, result);
        updateToast(id, {
          ...successOptions,
          type: 'success',
          timeout: successOptions.timeout,
        });

        return result;
      })
      .catch((error) => {
        const errorOptions = resolvePromiseOptions(options.error, error);
        updateToast(id, {
          ...errorOptions,
          type: 'error',
          timeout: errorOptions.timeout,
        });

        return Promise.reject(error);
      });

    // Private API used exclusively by `Manager` to handoff the promise
    // back to the manager after it's handled here.
    if ({}.hasOwnProperty.call(options, 'setPromise')) {
      (options as any).setPromise(handledPromise);
    }

    return handledPromise;
  };

  function pauseTimers() {
    if (areTimersPaused) {
      return;
    }
    areTimersPaused = true;
    timers.forEach((timer) => {
      // Timers added while already paused have no running timeout, so their
      // `remaining` is still the full delay and must be left alone.
      if (timer.timeout) {
        timer.timeout.clear();
        // `start` is stamped on every resume, so subtracting from `remaining`
        // (rather than from the original delay) keeps repeated pause/resume
        // cycles from handing the toast extra time.
        timer.remaining = Math.max(timer.remaining - (Date.now() - timer.start), 0);
      }
    });
  }

  function resumeTimers() {
    if (!areTimersPaused) {
      return;
    }
    areTimersPaused = false;
    timers.forEach((timer, id) => {
      timer.remaining = timer.remaining > 0 ? timer.remaining : timer.delay;
      timer.timeout ??= createTimeout();
      timer.timeout.start(timer.remaining, () => {
        handleTimerFired(id);
        timer.callback();
      });
      timer.start = Date.now();
    });
  }

  function restoreFocusToPrevElement() {
    state.prevFocusElement?.focus({ preventScroll: true });
  }

  const handleDocumentPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    const target = getTarget(event) as Element | null;
    if (contains(state.viewport, target)) {
      return;
    }

    // This is explicit touch activity outside the viewport, so the paused
    // interaction state should end even if the window focus state is unchanged.
    resumeTimers();
    base.update({ hovering: false, focused: false });
  };

  function scheduleTimer(id: string, delay: number, callback: () => void) {
    const start = Date.now();
    const shouldStartActive = !selectors.expandedOrOutOfFocus(state);
    const currentTimeout = shouldStartActive ? createTimeout() : undefined;

    currentTimeout?.start(delay, () => {
      handleTimerFired(id);
      callback();
    });

    timers.set(id, {
      timeout: currentTimeout,
      start,
      delay,
      remaining: delay,
      callback,
    });
  }

  function clearTimers() {
    timers.forEach((timer) => {
      timer.timeout?.clear();
    });
    timers.clear();
    areTimersPaused = false;
  }

  function clearTimer(id: string) {
    const timer = timers.get(id);
    timer?.timeout?.clear();
    timers.delete(id);

    resetPausedStateIfNoTimersRemain();
  }

  function handleTimerFired(id: string) {
    timers.delete(id);
    resetPausedStateIfNoTimersRemain();
  }

  function resetPausedStateIfNoTimersRemain() {
    if (timers.size === 0) {
      // No timers remain to keep paused; clear the flag so a fresh toast's
      // running timer can be paused again on hover/focus.
      areTimersPaused = false;
    }
  }

  function setToasts(newToasts: StoredToast[], clearInteraction: boolean = newToasts.length === 0) {
    const { toasts: reconciledToasts, changed } = reconcileToasts(newToasts);
    // Solid: an update that changes nothing keeps the list as is, so lists keyed by reference
    // (including ones that recreate toast objects) do not remount their toasts.
    const currentToasts = state.toasts;
    if (
      !changed &&
      !clearInteraction &&
      reconciledToasts.length === currentToasts.length &&
      reconciledToasts.every((toast, index) => toast === currentToasts[index])
    ) {
      return;
    }

    // The records update in place, so the list itself changes only when its items or their order
    // do; lists that recreate their items (`toasts().map(...)`) keep them on a field update.
    const sameItems =
      reconciledToasts.length === currentToasts.length &&
      reconciledToasts.every((toast, index) => toast === currentToasts[index]);
    const updates = {
      toastMetadata: createToastMetadata(reconciledToasts),
    } as Pick<State, 'toasts' | 'toastMetadata' | 'hovering' | 'focused'>;
    if (!sameItems) {
      updates.toasts = reconciledToasts;
    }

    if (clearInteraction) {
      updates.hovering = false;
      updates.focused = false;
    }

    base.update(updates);
  }

  function handleFocusManagement(toastId: string | undefined) {
    const activeEl = activeElement(ownerDocument(state.viewport));
    if (!state.viewport || !contains(state.viewport, activeEl) || !isFocusVisible(activeEl)) {
      return;
    }

    if (toastId === undefined) {
      restoreFocusToPrevElement();
      return;
    }

    const toasts = selectors.toasts(state);
    const currentIndex = selectors.toastIndex(state, () => toastId);

    const scan = (from: number, step: number) => {
      for (let index = from; index >= 0 && index < toasts.length; index += step) {
        if (toasts[index].transitionStatus !== 'ending') {
          return toasts[index];
        }
      }
      return null;
    };

    // Try to find the next toast that isn't animating out, then fall back to the previous one.
    const nextToast = scan(currentIndex + 1, 1) ?? scan(currentIndex - 1, -1);

    if (nextToast) {
      nextToast.ref?.current?.focus();
    } else {
      restoreFocusToPrevElement();
    }
  }

  return {
    ...base,
    setViewport,
    syncProviderProps,
    disposeEffect,
    removeToast,
    addToast,
    updateToast,
    updateToastInternal,
    closeToast,
    promiseToast,
    pauseTimers,
    resumeTimers,
    restoreFocusToPrevElement,
    handleDocumentPointerDown,
  };
}

interface TimerInfo {
  timeout?: Timeout | undefined;
  /** Timestamp of the last time the timeout started running. */
  start: number;
  /** Full timeout duration, used to restart a timer that elapsed while throttled. */
  delay: number;
  /** Time left before the toast auto-dismisses, excluding any paused time. */
  remaining: number;
  callback: () => void;
}

export type ToastStore = ReturnType<typeof ToastStore>;
