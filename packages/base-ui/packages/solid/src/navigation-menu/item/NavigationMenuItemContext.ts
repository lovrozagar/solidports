/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface NavigationMenuItemContextValue {
  value: Accessor<any>;
}

export const NavigationMenuItemContext = createContext<NavigationMenuItemContextValue | null>(null);

export function useNavigationMenuItemContext() {
  const value = useContext(NavigationMenuItemContext);
  if (!value) {
    throw new Error(
      'Base UI: NavigationMenuItem parts must be used within a <NavigationMenu.Item>.',
    );
  }
  return value;
}
