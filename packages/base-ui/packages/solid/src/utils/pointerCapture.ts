/**
 * Sets or releases pointer capture, ignoring the `NotFoundError` browsers throw for a pointer that
 * is no longer active.
 */
export function safelyChangePointerCapture(
  element: HTMLElement,
  pointerId: number,
  method: 'setPointerCapture' | 'releasePointerCapture',
) {
  const pointerCaptureMethod = element[method];
  if (typeof pointerCaptureMethod !== 'function') {
    return;
  }

  try {
    pointerCaptureMethod.call(element, pointerId);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError') {
      return;
    }
    throw error;
  }
}
