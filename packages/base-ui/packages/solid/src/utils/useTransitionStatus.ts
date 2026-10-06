import { createSignal, getOwner, runWithOwner, untrack } from 'solid-js';
import { createEffectGroup } from './native/effectGroup';
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
  // React enters `'starting'` only for `open && !mounted`: an element still mounted when it opens
  // (reopened during its exit, or mounted through `setMounted(true)`, as a cached image is) keeps
  // its status. `mounted` is derived from `open` here, so track whether it was mounted before.
  let previouslyMounted = false;
  let mountedExplicitly = false;
  // The two frame-scheduling effects below only have work once the element is open or mounted:
  // an element that starts closed (a collapsed panel, a closed popup) gets them when it first
  // opens, owned by this hook's owner. Each keeps its own dependencies and cleanup.
  const owner = getOwner();
  let effectsCreated = false;
  // The status signal is created below; its initial computation must not create the effects (they
  // read the signal), so the creation from the computation starts after the initial one.
  let initialized = false;
  const ensureEffects = () => {
    if (effectsCreated) {
      return;
    }
    effectsCreated = true;
    runWithOwner(owner, () => untrack(createEffects));
  };
  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>((prev) => {
    const isOpen = openProp();
    const isMounted = mounted();
    if (initialized && (isOpen || isMounted)) {
      ensureEffects();
    }
    const deferEnding = deferEndingStateProp();
    const wasOpen = previouslyOpen;
    const wasMounted = previouslyMounted || mountedExplicitly;
    previouslyOpen = isOpen;
    previouslyMounted = isMounted;
    mountedExplicitly = false;

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
      if (wasOpen) {
        return prev;
      }
      // With the idle state, React's idle effect restarts `'starting'` for a reopened element.
      return wasMounted && !untrack(enableIdleStateProp) ? prev : 'starting';
    }

    if (isMounted) {
      return prev !== 'ending' && !deferEnding ? 'ending' : prev;
    }

    return prev === 'ending' ? undefined : prev;
  });

  function createEffects() {
    // One node for both frame-scheduling effects; each keeps its own deps and cleanup.
    createEffectGroup([
      {
        deps: () => [openProp(), mounted(), transitionStatus(), deferEndingStateProp()] as const,
        apply([isOpen, isMounted, status, deferEnding]) {
          if (!isOpen && isMounted && status !== 'ending' && deferEnding) {
            const frame = AnimationFrame.request(() => setTransitionStatus('ending'));
            return () => AnimationFrame.cancel(frame);
          }
          return undefined;
        },
      },
      {
        deps: () => [openProp(), enableIdleStateProp()] as const,
        apply([isOpen, idleEnabled]) {
          if (!isOpen) {
            return undefined;
          }

          return requestAfterPaint(() => setTransitionStatus(idleEnabled ? 'idle' : undefined));
        },
      },
    ]);
  }

  // The initial status is computed above; an element that starts open or mounted has its effects
  // already. One that starts closed creates them from the status computation when it first opens.
  initialized = true;
  if (untrack(() => openProp() || mounted())) {
    ensureEffects();
  }

  return {
    mounted,
    setMounted: ((value: Parameters<typeof setMounted>[0]) => {
      if (value === true) {
        mountedExplicitly = true;
      }
      return setMounted(value as never);
    }) as typeof setMounted,
    transitionStatus,
  };
}
