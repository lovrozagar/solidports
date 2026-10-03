import { createEffect, createSignal, untrack } from 'solid-js';
import { access, type MaybeAccessor } from '../solid-helpers';
import { AnimationFrame } from './useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

/**
 * Runs `callback` after the next frame has painted. React applies a `setState` from a rAF in a
 * scheduler task after that frame paints, so `[data-starting-style]` is styled for one frame.
 * Solid 2 flushes the write in the rAF callback itself, before the frame's style recalc, and CSS
 * transitions never start; a task queued from the rAF runs after the frame renders, as React's.
 */
function requestAfterPaint(callback: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const frame = AnimationFrame.request(() => {
    timeout = setTimeout(callback);
  });
  return () => {
    AnimationFrame.cancel(frame);
    clearTimeout(timeout);
  };
}

/**
 * Provides a status string for CSS animations.
 * @param open - an accessor to a boolean that determines if the element is open.
 * @param enableIdleState - a boolean that enables the `'idle'` state between `'starting'` and `'ending'`
 * @param deferEndingState - a boolean that delays the `'ending'` state by a frame
 * @param animateInitialOpen - a boolean that makes an element which mounts already open still go
 *   through `'starting'`. Off by default so content that was open on the first render (a
 *   `defaultOpen` popup on page load, SSR'd markup) doesn't animate in.
 * @param canStayMounted - while closed, whether the element may stay mounted (e.g. its container
 *   is still mounted). When it turns `false`, `mounted` resets in the same flush.
 */
export function useTransitionStatus(
  open: MaybeAccessor<boolean>,
  enableIdleState: MaybeAccessor<boolean> = false,
  deferEndingState: MaybeAccessor<boolean> = false,
  animateInitialOpen: MaybeAccessor<boolean> = false,
  canStayMounted: MaybeAccessor<boolean> = true,
) {
  const openProp = () => Boolean(access(open));
  const enableIdleStateProp = () => Boolean(access(enableIdleState));
  const deferEndingStateProp = () => Boolean(access(deferEndingState));

  // React updates `mounted` and `transitionStatus` during render when `open` flips. Solid derives
  // them in the same flush instead: writable memos re-derive whenever their inputs change, and keep
  // what the frame callbacks and `setMounted` write until the next change. Copying them from an
  // effect would render one flush with the new `open` and the stale status.
  const [mounted, setMounted] = createSignal<boolean>(
    (prev) => openProp() || ((prev ?? false) && Boolean(access(canStayMounted))),
  );

  let previouslyOpen: boolean | undefined;
  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>((prev) => {
    const isOpen = openProp();
    const isMounted = mounted();
    const deferEnding = deferEndingStateProp();
    const wasOpen = previouslyOpen;
    previouslyOpen = isOpen;

    if (wasOpen === undefined) {
      // Initial values, like React's `useState(initial)`. Content that mounts already open skips
      // `'starting'` unless `animateInitialOpen` asks for it.
      if (!isOpen) {
        return undefined;
      }
      if (untrack(() => access(animateInitialOpen))) {
        return 'starting';
      }
      return untrack(enableIdleStateProp) ? 'idle' : undefined;
    }

    if (isOpen) {
      return wasOpen ? prev : 'starting';
    }

    if (isMounted) {
      return prev !== 'ending' && !deferEnding ? 'ending' : prev;
    }

    return prev === 'ending' ? undefined : prev;
  });

  createEffect(
    () => [openProp(), mounted(), transitionStatus(), deferEndingStateProp()] as const,
    ([isOpen, isMounted, status, deferEnding]) => {
      if (!isOpen && isMounted && status !== 'ending' && deferEnding) {
        const frame = AnimationFrame.request(() => setTransitionStatus('ending'));
        return () => AnimationFrame.cancel(frame);
      }
      return undefined;
    },
  );

  createEffect(
    () => [openProp(), enableIdleStateProp()] as const,
    ([isOpen, idleEnabled]) => {
      if (!isOpen) {
        return undefined;
      }

      return requestAfterPaint(() => setTransitionStatus(idleEnabled ? 'idle' : undefined));
    },
  );

  return {
    mounted,
    setMounted,
    transitionStatus,
  };
}
