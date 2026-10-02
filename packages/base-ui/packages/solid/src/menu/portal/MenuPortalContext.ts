import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export const MenuPortalContext = createContext<Accessor<boolean | undefined> | null>(null);

export function useMenuPortalContext() {
  const value = useContext(MenuPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Menu.Portal> is missing.');
  }
  return value;
}
