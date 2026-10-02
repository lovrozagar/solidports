import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export const NavigationMenuPortalContext = createContext<Accessor<boolean> | null>(null);

export function useNavigationMenuPortalContext() {
  const value = useContext(NavigationMenuPortalContext);
  if (value == null) {
    throw new Error('Base UI: <NavigationMenu.Portal> is missing.');
  }
  return value;
}
