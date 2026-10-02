/**
 * Solid 2 replacement for 1.x `on:event={{ capture: true, handleEvent }}`.
 * Attach capture-phase listeners via a ref factory.
 */
export function withCaptureListeners(
  listeners: Partial<{
    [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void;
  }>,
): (el: HTMLElement) => void | (() => void) {
  return (el) => {
    const entries = Object.entries(listeners) as [
      keyof HTMLElementEventMap,
      ((event: Event) => void) | undefined,
    ][];
    for (const [type, handler] of entries) {
      if (handler) {
        el.addEventListener(type, handler, true);
      }
    }
    return () => {
      for (const [type, handler] of entries) {
        if (handler) {
          el.removeEventListener(type, handler, true);
        }
      }
    };
  };
}
