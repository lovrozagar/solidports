import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Store } from 'solid-js';

export interface DrawerProviderContext {
  setDrawerOpen: (drawerId: string, open: boolean) => void;
  removeDrawer: (drawerId: string) => void;
  active: Accessor<boolean>;
  visualStateStore: Store<DrawerVisualState>;
  setVisualState: (state: Partial<DrawerVisualState>) => void;
}

export const DrawerProviderContext = createContext<DrawerProviderContext | null>(null);

export interface DrawerVisualState {
  swipeProgress: number;
  frontmostHeight: number;
}

export function useDrawerProviderContext(optional?: false): DrawerProviderContext;
export function useDrawerProviderContext(optional: true): DrawerProviderContext | null;
export function useDrawerProviderContext(optional?: boolean) {
  const context = useContext(DrawerProviderContext);

  if (!optional && context == null) {
    throw new Error('Base UI: DrawerProviderContext is missing. Use <Drawer.Provider>.');
  }

  return context;
}
