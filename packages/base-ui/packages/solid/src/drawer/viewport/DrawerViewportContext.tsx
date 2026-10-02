import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface DrawerViewportContextValue {
  swiping: Accessor<boolean>;
  getDragStyles: () => JSX.CSSProperties;
  swipeStrength: Accessor<number | null>;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = createContext<DrawerViewportContextValue | null>(null);

export function useDrawerViewportContext(optional?: false): DrawerViewportContextValue;
export function useDrawerViewportContext(optional: true): DrawerViewportContextValue | null;
export function useDrawerViewportContext(optional?: boolean) {
  const context = useContext(DrawerViewportContext);

  if (!optional && context == null) {
    throw new Error(
      'Base UI: DrawerViewportContext is missing. Drawer parts must be placed within <Drawer.Viewport>.',
    );
  }

  return context;
}
