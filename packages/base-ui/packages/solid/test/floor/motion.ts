/*
 * The transition mechanism the disclosure floors hand-write (D19): a floor models every observable
 * branch its component supports, not only the one the bench's CSS takes.
 * - An opening part holds `data-starting-style` for the frame and the task after.
 * - An opening panel reads its motion once, before paint. Without motion it drops the attribute
 *   at once, as upstream's panel forces itself idle (`open && transitionStatus === 'starting'`
 *   with `getAnimationType` 'none'), and its size variables stay `auto`.
 * - With motion it measures itself once (`scrollHeight`, `scrollWidth`, under upstream's layout
 *   reset until the next frame) and holds the measured size until its animations finish after
 *   `'starting'` ends, then releases it to `auto`.
 */
import { AnimationFrame, queueAfterFrame } from '../../src/utils/useAnimationFrame';

export interface PanelSize {
  height: number;
  width: number;
}

/** Runs `callback` in the task after the next frame (the shared one); returns its cancel. */
export function afterNextFrame(callback: () => void) {
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

const nonZero = (durations: string) => durations.split(',').some((d) => parseFloat(d) > 0);

/** Whether `element` has authored motion: one computed-style read, as the panel's opening pass. */
export function hasMotion(element: HTMLElement) {
  const style = getComputedStyle(element);
  return nonZero(style.transitionDuration) || nonZero(style.animationDuration);
}

const LAYOUT_STYLES = ['justify-content', 'align-items', 'align-content', 'justify-items'];

/**
 * An opening panel's single pass before paint (a microtask, after the flush that inserted it):
 * `settle` without motion; with motion, the measured size to `measured`, read under the layout
 * reset that is lifted on the next frame. `element` is the panel, set by its ref.
 */
export function openPanel(
  element: () => HTMLElement | undefined,
  settle: () => void,
  measured: (size: PanelSize) => void,
) {
  queueMicrotask(() => {
    const panel = element();
    if (!panel?.isConnected) {
      return;
    }
    if (!hasMotion(panel)) {
      settle();
      return;
    }
    for (const name of LAYOUT_STYLES) {
      panel.style.setProperty(name, 'initial', 'important');
    }
    measured({ height: panel.scrollHeight, width: panel.scrollWidth });
    AnimationFrame.request(() => {
      for (const name of LAYOUT_STYLES) {
        panel.style.removeProperty(name);
      }
    });
  });
}

/**
 * Calls `release` once the panel's animations finish. Called where `'starting'` ends, so the
 * flush that removes the attribute runs first and the transition it starts is among them.
 */
export function releaseAfterAnimations(
  element: () => HTMLElement | undefined,
  release: () => void,
) {
  queueMicrotask(() => {
    const panel = element();
    if (!panel?.isConnected) {
      return;
    }
    const running = panel.getAnimations?.() ?? [];
    void Promise.all(running.map((animation) => animation.finished)).then(
      () => panel.isConnected && release(),
      () => {},
    );
  });
}

/** A size variable's value: the measured pixels, or `auto` once released. */
export const sizeVar = (size: PanelSize | undefined, key: keyof PanelSize) =>
  size ? `${size[key]}px` : 'auto';
