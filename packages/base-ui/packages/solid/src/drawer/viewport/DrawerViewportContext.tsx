import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface DrawerViewportContextValue {
  // Solid: render-time values are accessors so consumers track them.
  swiping: Accessor<boolean>;
  getDragStyles: () => JSX.CSSProperties;
  swipeStrength: Accessor<number | null>;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = createContext<DrawerViewportContextValue | null>(null);

export function useDrawerViewportContext() {
  return useContext(DrawerViewportContext);
}
