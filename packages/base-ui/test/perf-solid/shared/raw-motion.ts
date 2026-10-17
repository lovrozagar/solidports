// The transition mechanism the raw disclosure floors hand-write in each framework (D19), with no
// library code. An opening part holds `data-starting-style` for the frame and the task after.
// An opening panel reads its motion once, before paint: without it, it drops the attribute at once
// and keeps its size variables at `auto`; with it, it measures itself once under the layout reset
// upstream uses (lifted on the next frame) and keeps that size until its animations finish after
// `'starting'` ends.

let queued: (() => void)[] | undefined;

/** Runs `callback` in the task after the next frame, one task for every callback of a frame. */
export function afterNextFrame(callback: () => void) {
  let cancelled = false;
  const frame = requestAnimationFrame(() => {
    if (!queued) {
      const batch: (() => void)[] = [];
      queued = batch;
      setTimeout(() => {
        queued = undefined;
        batch.forEach((run) => run());
      });
    }
    queued.push(() => {
      if (!cancelled) {
        callback();
      }
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

const nonZero = (durations: string) => durations.split(',').some((d) => parseFloat(d) > 0);

/** Whether `element` has authored motion: one computed-style read, as the panel's opening pass. */
export function hasMotion(element: Element) {
  const style = getComputedStyle(element);
  return nonZero(style.transitionDuration) || nonZero(style.animationDuration);
}

export interface PanelSize {
  height: number;
  width: number;
}

const LAYOUT_STYLES = ['justify-content', 'align-items', 'align-content', 'justify-items'];

/**
 * An opening panel's single pass, run before paint: `settle` without motion; with motion, the
 * size measured under the layout reset to `measured`, the reset lifted on the next frame.
 */
export function openPanelPass(
  panel: HTMLElement,
  settle: () => void,
  measured: (size: PanelSize) => void,
) {
  if (!hasMotion(panel)) {
    settle();
    return;
  }
  for (const name of LAYOUT_STYLES) {
    panel.style.setProperty(name, 'initial', 'important');
  }
  measured({ height: panel.scrollHeight, width: panel.scrollWidth });
  requestAnimationFrame(() => {
    for (const name of LAYOUT_STYLES) {
      panel.style.removeProperty(name);
    }
  });
}

/** Calls `release` once the panel's animations finish; call it after `'starting'` is removed. */
export function releaseAfterAnimations(panel: HTMLElement, release: () => void) {
  const running = panel.getAnimations?.() ?? [];
  void Promise.all(running.map((animation) => animation.finished)).then(
    () => panel.isConnected && release(),
    () => {},
  );
}

/** A size variable's value: the measured pixels, or `auto` once released. */
export const sizeVar = (size: PanelSize | undefined, key: keyof PanelSize) =>
  size ? `${size[key]}px` : 'auto';
