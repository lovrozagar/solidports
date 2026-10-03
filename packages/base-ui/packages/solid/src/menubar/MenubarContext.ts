import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import { type MenuRoot } from '../menu/root/MenuRoot';
import type { ReactLikeRef } from '../solid-helpers';

export interface MenubarContext {
  modal: Accessor<boolean>;
  disabled: Accessor<boolean>;
  contentElement: Accessor<HTMLElement | null | undefined>;
  setContentElement: (element: HTMLElement | null | undefined) => void;
  hasSubmenuOpen: Accessor<boolean>;
  /** Registers a top-level menu (once mounted, until unmounted) so `hasSubmenuOpen` follows it. */
  registerMenu: (menu: MenubarMenu) => void;
  orientation: Accessor<MenuRoot.Orientation>;
  allowMouseUpTriggerRef: ReactLikeRef<boolean>;
  rootId: Accessor<string | undefined>;
}

export interface MenubarMenu {
  open: Accessor<boolean>;
  lastOpenChangeReason: Accessor<string | null | undefined>;
}

export const MenubarContext = createContext<MenubarContext | null>(null);

export function useMenubarContext(optional?: false): MenubarContext;
export function useMenubarContext(optional: true): MenubarContext | null;
export function useMenubarContext(optional?: boolean) {
  const context = useContext(MenubarContext);
  if (context === null && !optional) {
    throw new Error(
      'Base UI: MenubarContext is missing. Menubar parts must be placed within <Menubar>.',
    );
  }

  return context;
}
