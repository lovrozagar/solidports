import type { JSX } from '@solidjs/web';

export function clearStyles(
  element: HTMLElement | null | undefined,
  originalStyles: JSX.CSSProperties,
) {
  if (element) {
    Object.assign(element.style, originalStyles);
  }
}

export const LIST_FUNCTIONAL_STYLES = {
  'max-height': '100%',
  'overflow-x': 'hidden',
  'overflow-y': 'auto',
  position: 'relative',
} as const;
