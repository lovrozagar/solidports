import { ownerWindow } from '../../utils/owner';

// Calculates the viewport rect for the virtual cursor.
export function getViewportRect(teleportDistance: number | undefined, scrubAreaEl: HTMLElement) {
  const win = ownerWindow(scrubAreaEl);
  const rect = scrubAreaEl.getBoundingClientRect();

  if (rect && teleportDistance != null) {
    return {
      height: rect.bottom + teleportDistance / 2,
      width: rect.right + teleportDistance / 2,
      x: rect.left - teleportDistance / 2,
      y: rect.top - teleportDistance / 2,
    };
  }

  const vV = win.visualViewport;

  if (vV) {
    return {
      height: vV.offsetTop + vV.height,
      width: vV.offsetLeft + vV.width,
      x: vV.offsetLeft,
      y: vV.offsetTop,
    };
  }

  return {
    height: win.document.documentElement.clientHeight,
    width: win.document.documentElement.clientWidth,
    x: 0,
    y: 0,
  };
}
