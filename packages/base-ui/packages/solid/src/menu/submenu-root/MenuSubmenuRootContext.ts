import { createContext, useContext, type Accessor } from 'solid-js';
import { MenuStore } from '../store/MenuStore';

export const MenuSubmenuRootContext = createContext<MenuSubmenuRootContext | null>(null);

export interface MenuSubmenuRootContext {
  parentMenu: MenuStore<unknown>;
  /** The element that receives focus when the submenu closes. */
  getReturnElement?: (() => HTMLElement | null | false) | undefined;
  onTriggerKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  onPopupKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  /** Whether the parent menu keeps real focus on an input. */
  parentVirtualFocus?: Accessor<boolean> | undefined;
}

export function useMenuSubmenuRootContext(): MenuSubmenuRootContext | null {
  return useContext(MenuSubmenuRootContext);
}
