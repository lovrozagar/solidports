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
 */
export function useTransitionStatus(
  open: MaybeAccessor<boolean>,
  enableIdleState: MaybeAccessor<boolean> = false,
  deferEndingState: MaybeAccessor<boolean> = false,
  animateInitialOpen: MaybeAccessor<boolean> = false,
) {
  const openProp = () => Boolean(access(open));
  const enableIdleStateProp = () => Boolean(access(enableIdleState));
  const deferEndingStateProp = () => Boolean(access(deferEndingState));
  // Initial values only, like React's `useState(initial)`.
  // Starting at `false` while open lets the entering branch below produce the `'starting'` phase.
  const [mounted, setMounted] = createSignal(
    untrack(() => openProp() && !access(animateInitialOpen)),
  );
  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>(
    untrack(() => (openProp() && enableIdleStateProp() ? 'idle' : undefined)),
  );

  // React applies these as setState-during-render. Solid 2 forbids owned writes, so they live
  // in the effect callback. `createTrackedEffect` cannot be used here: it reads stale values and
  // would never see `open` flip to true, leaving `data-starting-style` (opacity: 0) stuck.
  createEffect(
    () => [openProp(), mounted(), transitionStatus(), deferEndingStateProp()] as const,
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
      if (!isOpen || idleEnabled) {
        return undefined;
      }

      return requestAfterPaint(() => setTransitionStatus(undefined));
    },
  );

  createEffect(
    () => [openProp(), enableIdleStateProp(), mounted(), transitionStatus()] as const,
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

  // The effect above commits `mounted`/`'starting'` one flush after `open` flips, but React's
  // render-phase update makes the very first render carry them. Derive that render so an element
  // that mounts on open is inserted with `[data-starting-style]` instead of gaining it after its
  // first style recalc, which would start the enter transition from the visible state.
  const isEntering = () => openProp() && !mounted();
  // Likewise for closing: React's render-phase update makes the first closed render carry
  // `'ending'`, so an element removed right after closing still exits with `[data-ending-style]`.
  const isExiting = () =>
    !openProp() && mounted() && transitionStatus() !== 'ending' && !deferEndingStateProp();
  // And once unmounted: React's render-phase update clears `'ending'` in the same render that
  // sets `mounted` to `false`, so no effect observes an unmounted element still `'ending'`.
  const hasExited = () => !openProp() && !mounted() && transitionStatus() === 'ending';

  return {
    mounted: () => mounted() || isEntering(),
    setMounted,
    transitionStatus: (): TransitionStatus => {
      if (isEntering()) {
        return 'starting';
      }
      if (isExiting()) {
        return 'ending';
      }
      return hasExited() ? undefined : transitionStatus();
    },
  };
}
