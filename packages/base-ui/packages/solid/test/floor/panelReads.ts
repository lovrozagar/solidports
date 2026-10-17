/*
 * The layout reads one open makes on its panel (D19): `getComputedStyle`, `scrollHeight` and
 * `scrollWidth` calls on the `div` with an id, from the open through the task after the next
 * frame. The floors read 1/0/0 without motion and 1/1/1 with it; the parts may not read more.
 */
import { flush } from 'solid-js';

export interface PanelReads {
  getComputedStyle: number;
  scrollHeight: number;
  scrollWidth: number;
}

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
const task = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/** Opens with `open()` and counts the panel's layout reads; motion as in `startingTimeline`. */
export async function panelReads(container: HTMLElement, open: () => void, motion: boolean) {
  const reads: PanelReads = { getComputedStyle: 0, scrollHeight: 0, scrollWidth: 0 };
  const isPanel = (el: unknown) =>
    el instanceof HTMLDivElement && el.id !== '' && container.contains(el);
  const restore: (() => void)[] = [];
  for (const key of ['scrollHeight', 'scrollWidth'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, key)!;
    Object.defineProperty(Element.prototype, key, {
      configurable: true,
      get(this: Element) {
        if (isPanel(this)) {
          reads[key] += 1;
        }
        return descriptor.get!.call(this);
      },
    });
    restore.push(() => Object.defineProperty(Element.prototype, key, descriptor));
  }
  const computed = window.getComputedStyle;
  window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
    if (isPanel(el)) {
      reads.getComputedStyle += 1;
    }
    return computed.call(window, el, pseudo);
  }) as typeof window.getComputedStyle;
  restore.push(() => {
    window.getComputedStyle = computed;
  });
  const style = document.createElement('style');
  style.textContent = '[data-motion] div[id] { transition-duration: 200ms; }';
  document.head.append(style);
  if (motion) {
    container.setAttribute('data-motion', '');
  }
  try {
    open();
    flush();
    await Promise.resolve();
    flush();
    await frame();
    flush();
    await task();
    flush();
    return reads;
  } finally {
    restore.forEach((undo) => undo());
    style.remove();
    container.removeAttribute('data-motion');
  }
}
