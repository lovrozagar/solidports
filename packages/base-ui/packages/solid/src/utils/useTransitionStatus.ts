import { createEffect, createSignal } from 'solid-js';
import { access, type MaybeAccessor } from '../solid-helpers';
import { AnimationFrame } from './useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

/**
 * Runs `callback` in the frame after next. React applies a `setState` from a rAF after the
 * browser paints, so `[data-starting-style]` is styled for at least one frame. Solid 2 flushes
 * the write in the same frame, before any style recalc, and CSS transitions never start.
 */
function requestAfterPaint(callback: () => void) {
  let frame = AnimationFrame.request(() => {
    frame = AnimationFrame.request(callback);
  });
  return () => AnimationFrame.cancel(frame);
}

/**
 * Provides a status string for CSS animations.
 * @param open - an accessor to a boolean that determines if the element is open.
 * @param enableIdleState - a boolean that enables the `'idle'` state between `'starting'` and `'ending'`
 * @param deferEndingState - a boolean that delays the `'ending'` state by a frame
 */
export function useTransitionStatus(
  open: MaybeAccessor<boolean>,
  enableIdleState: MaybeAccessor<boolean> = false,
  deferEndingState: MaybeAccessor<boolean> = false,
) {
  const openProp = () => Boolean(access(open));
  const enableIdleStateProp = () => Boolean(access(enableIdleState));
  const deferEndingStateProp = () => Boolean(access(deferEndingState));
  const [mounted, setMounted] = createSignal(openProp());
  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>(
    openProp() && enableIdleStateProp() ? 'idle' : undefined,
  );

  // React applies these as setState-during-render. Solid 2 forbids owned writes, so they live
  // in the effect callback. `createTrackedEffect` cannot be used here: it reads stale values and
  // would never see `open` flip to true, leaving `data-starting-style` (opacity: 0) stuck.
  createEffect(
    () =>
      [openProp(), mounted(), transitionStatus(), deferEndingStateProp()] as const,
    ([isOpen, isMounted, status, deferEnding]) => {
      if (isOpen && !isMounted) {
        setMounted(true);
        setTransitionStatus('starting');
        return;
      }

      if (!isOpen && isMounted && status !== 'ending' && !deferEnding) {
        setTransitionStatus('ending');
        return;
      }

      if (!isOpen && !isMounted && status === 'ending') {
        setTransitionStatus(undefined);
      }
    },
  );

  createEffect(
    () =>
      [openProp(), mounted(), transitionStatus(), deferEndingStateProp()] as const,
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
      if (!isOpen || idleEnabled) {
        return undefined;
      }

      return requestAfterPaint(() => setTransitionStatus(undefined));
    },
  );

  createEffect(
    () =>
      [openProp(), enableIdleStateProp(), mounted(), transitionStatus()] as const,
    ([isOpen, idleEnabled, isMounted, status]) => {
      if (!isOpen || !idleEnabled) {
        return undefined;
      }

      if (isOpen && isMounted && status !== 'idle') {
        setTransitionStatus('starting');
      }

      return requestAfterPaint(() => setTransitionStatus('idle'));
    },
  );

  return {
    mounted,
    setMounted,
    transitionStatus,
  };
}
