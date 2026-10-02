import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { ElementProps } from '../../floating-ui-solid';

/** The list's dismiss props, which follow whether a floating root context is active. */
export const NavigationMenuDismissContext = createContext<Accessor<
  ElementProps | undefined
> | null>(null);

export function useNavigationMenuDismissContext() {
  return useContext(NavigationMenuDismissContext);
}
