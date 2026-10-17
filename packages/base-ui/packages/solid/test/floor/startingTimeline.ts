/*
 * The `data-starting-style` timeline of one open (D19): which parts carry it before paint, after
 * the next frame and in the task after it. The floors must match the parts on every observable
 * branch, so the cost tests read it with and without motion.
 */
import { flush } from 'solid-js';

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
const task = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/**
 * The tags of the elements under `container` that carry `data-starting-style`, in tree order, then
 * the panel's (the `div` with an id) inline style, property by property.
 */
function starting(container: Element) {
  const tags = [...container.querySelectorAll('[data-starting-style]')]
    .map((el) => el.tagName.toLowerCase())
    .join(' ');
  const panel = container.querySelector<HTMLElement>('div[id]');
  const style = panel
    ? [...panel.style]
        .map((name) => `${name}:${panel.style.getPropertyValue(name)}`)
        .sort()
        .join(';')
    : 'none';
  return `${tags} | ${style}`;
}

/**
 * Opens with `open()` and samples the parts holding `data-starting-style` at each step. Motion is a
 * transition duration on the panel (the `div` with an id), authored in a stylesheet.
 */
export async function startingTimeline(container: HTMLElement, open: () => void, motion: boolean) {
  const style = document.createElement('style');
  style.textContent = '[data-motion] div[id] { transition-duration: 200ms; }';
  document.head.append(style);
  if (motion) {
    container.setAttribute('data-motion', '');
  }
  try {
    open();
    flush();
    // Nothing paints before the microtasks drain, so the first sample is taken after them.
    await Promise.resolve();
    flush();
    const beforePaint = starting(container);
    await frame();
    flush();
    const afterFrame = starting(container);
    await task();
    flush();
    const afterTask = starting(container);
    return { beforePaint, afterFrame, afterTask };
  } finally {
    style.remove();
    container.removeAttribute('data-motion');
  }
}

/** The samples with every measured size as `Npx`: jsdom measures 0, a browser the real size. */
export function withoutSizes(samples: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(samples).map(([step, sample]) => [
      step,
      sample.replace(/\d+(?:\.\d+)?px/g, 'Npx'),
    ]),
  );
}
