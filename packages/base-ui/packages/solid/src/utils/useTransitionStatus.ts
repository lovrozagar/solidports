import { createSignal, onCleanup, untrack } from 'solid-js';
import { access } from '../solid-helpers';
import type { MaybeAccessor } from '../solid-helpers';
import { AnimationFrame, queueAfterFrame } from './useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

/**
 * Runs `callback` after the next frame has painted. React applies a `setState` from a rAF in a
 * scheduler task after that frame paints, so `[data-starting-style]` is styled for one frame.
 * Solid 2 flushes the write in the rAF callback itself, before the frame's style recalc, and CSS
 * transitions never start; a task queued from the rAF runs after the frame renders, as React's.
 * Every element's callback of one frame runs in the same task (`queueAfterFrame`), so their writes
 * flush once: 300 panels opening together leave `'starting'` in one batch, not a task each.
 */
function requestAfterPaint(callback: () => void) {
  let cancelled = false;
  const frame = AnimationFrame.request(() => {
    queueAfterFrame(() => {
      if (!cancelled) {
        callback();
      }
    });
  });
  return () => {
    cancelled = true;
    AnimationFrame.cancel(frame);
  };
}

/**
 * Provides a status string for CSS animations.
 * @param open - an accessor to a boolean that determines if the element is open.
 * @param enableIdleState - enables the `'idle'` state between `'starting'` and `'ending'`; a plain
 *   boolean, fixed for the element's lifetime (the frames are scheduled from it)
 * @param deferEndingState - delays the `'ending'` state by a frame; a plain boolean, as above
 * @param animateInitialOpen - a boolean that makes an element which mounts already open still go
 *   through `'starting'`. Off by default so content that was open on the first render (a
 *   `defaultOpen` popup on page load, SSR'd markup) doesn't animate in.
 * @param canStayMounted - while closed, whether the element may stay mounted (e.g. its container
 *   is still mounted). When it turns `false`, `mounted` resets in the same flush.
 */
export function useTransitionStatus(
  open: MaybeAccessor<boolean>,
  enableIdleState = false,
  deferEndingState = false,
  animateInitialOpen: MaybeAccessor<boolean> = false,
  canStayMounted: MaybeAccessor<boolean> = true,
) {
  const openProp = () => Boolean(access(open));
  const idleEnabled = enableIdleState;
  const deferEnding = deferEndingState;

  // React updates `mounted` and `transitionStatus` during render when `open` flips. Solid derives
  // them in the same flush instead: writable memos re-derive whenever their inputs change, and keep
  // what the frame callbacks and `setMounted` write until the next change. Copying them from an
  // effect would render one flush with the new `open` and the stale status.
  // `setMounted(false)` goes through a request the memo reads, so `open` still wins when both
  // change in one flush: React re-mounts on `open && !mounted`, whereas a direct write would keep
  // `false` over the re-derivation.
  const [unmountRequest, setUnmountRequest] = createSignal(0);
  let handledUnmountRequest = 0;
  const [mounted, setMounted] = createSignal<boolean>((prev) => {
    const request = unmountRequest();
    const unmountRequested = request !== handledUnmountRequest;
    handledUnmountRequest = request;
    return openProp() || (!unmountRequested && (prev ?? false) && Boolean(access(canStayMounted)));
  });

  let previouslyOpen: boolean | undefined;
  // React enters `'starting'` only for `open && !mounted`: an element still mounted when it opens
  // (reopened during its exit, or mounted through `setMounted(true)`, as a cached image is) keeps
  // its status. `mounted` is derived from `open` here, so track whether it was mounted before.
  let previouslyMounted = false;
  let mountedExplicitly = false;
  // `setMounted(false)` unmounts even when a reopen in the same flush re-derives `mounted` as
  // `true`, so the reopen enters `'starting'` as React's `open && !mounted` does.
  let unmountedExplicitly = false;
  // The two frames React's effects schedule (the idle status after the opening frame paints, and a
  // deferred `'ending'`) are scheduled here, from the status computation, when their inputs change,
  // and cancelled when those change again or the element is disposed: an effect per element would
  // be a node each, created on every first open. Neither frame's write can start the other's
  // (`'idle'` is written while open, `'ending'` while closed), so nothing a write changes needs a
  // new decision.
  let wasOpenForIdle: boolean | undefined;
  let cancelIdle: (() => void) | undefined;
  let endingInputs: string | undefined;
  let endingFrame: ReturnType<typeof AnimationFrame.request> | undefined;
  void onCleanup(() => {
    cancelIdle?.();
    cancelEnding();
  });
  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>((prev) => {
    const isOpen = openProp();
    const isMounted = mounted();
    const next = nextStatus(prev, isOpen, isMounted);
    scheduleFrames(isOpen, isMounted, next);
    return next;
  });

  function cancelEnding() {
    if (endingFrame !== undefined) {
      AnimationFrame.cancel(endingFrame);
      endingFrame = undefined;
    }
  }

  // Function declarations, so the status computation can call them; their frame callbacks write
  // the status, after it exists.
  function scheduleFrames(isOpen: boolean, isMounted: boolean, status: TransitionStatus) {
    if (isOpen !== wasOpenForIdle) {
      wasOpenForIdle = isOpen;
      cancelIdle?.();
      cancelIdle = undefined;
      // Nothing to clear when the element mounted open or reopened after its exit settled.
      if (isOpen && (idleEnabled || status !== undefined)) {
        cancelIdle = requestAfterPaint(() => {
          cancelIdle = undefined;
          setTransitionStatus(idleEnabled ? 'idle' : undefined);
        });
      }
    }
    const inputs = `${isOpen}|${isMounted}|${status}`;
    if (inputs !== endingInputs) {
      endingInputs = inputs;
      cancelEnding();
      if (!isOpen && isMounted && status !== 'ending' && deferEnding) {
        endingFrame = AnimationFrame.request(() => {
          endingFrame = undefined;
          setTransitionStatus('ending');
        });
      }
    }
  }

  function nextStatus(prev: TransitionStatus, isOpen: boolean, isMounted: boolean) {
    const wasOpen = previouslyOpen;
    const wasMounted = (previouslyMounted && !unmountedExplicitly) || mountedExplicitly;
    previouslyOpen = isOpen;
    previouslyMounted = isMounted;
    mountedExplicitly = false;
    unmountedExplicitly = false;

    if (wasOpen === undefined) {
      // Initial values, like React's `useState(initial)`. Content that mounts already open skips
      // `'starting'` unless `animateInitialOpen` asks for it.
      if (!isOpen) {
        return undefined;
      }
      if (untrack(() => access(animateInitialOpen))) {
        return 'starting';
      }
      return idleEnabled ? 'idle' : undefined;
    }

    if (isOpen) {
      if (wasOpen) {
        return prev;
      }
      // With the idle state, React's idle effect restarts `'starting'` for a reopened element.
      return wasMounted && !idleEnabled ? prev : 'starting';
    }

    if (isMounted) {
      return prev !== 'ending' && !deferEnding ? 'ending' : prev;
    }

    return prev === 'ending' ? undefined : prev;
  }

  return {
    mounted,
    setMounted: ((value: Parameters<typeof setMounted>[0]) => {
      if (value === false) {
        unmountedExplicitly = true;
        setUnmountRequest((request) => request + 1);
        return false;
      }
      if (value === true) {
        mountedExplicitly = true;
      }
      return setMounted(value as never);
    }) as typeof setMounted,
    transitionStatus,
  };
}
