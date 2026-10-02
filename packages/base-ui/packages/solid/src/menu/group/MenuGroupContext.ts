import { createContext, useContext } from 'solid-js';
import type { Setter } from 'solid-js';

export interface MenuGroupContext {
  setLabelId: Setter<string | undefined>;
}

export const MenuGroupContext = createContext<MenuGroupContext | null>(null);

export function useMenuGroupRootContext() {
  const context = useContext(MenuGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuGroupRootContext is missing. Menu group parts must be used within <Menu.Group>.',
    );
  }

  return context;
}
