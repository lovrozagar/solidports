import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { MenuStore } from '../store/MenuStore';
import type { MenuParent, MenuRoot } from './MenuRoot';

export type InstantType = 'dismiss' | 'click' | 'group';

export interface MenuRootContext<Payload = unknown> {
  store: MenuStore<Payload>;
  parent: MenuParent;
  orientation: Accessor<MenuRoot.Orientation>;
  loopFocus: Accessor<boolean>;
  /** Whether arrow keys can step from either end of the list back to a virtual focus owner. */
  allowEscape: Accessor<boolean>;
  defaultFloatingId: Accessor<string | undefined>;
  /** Records the id the popup rendered with, when it differs from `defaultFloatingId`. */
  setRenderedFloatingId: (id: string | undefined) => void;
  virtualFocus: Accessor<boolean>;
  parentVirtualFocus: Accessor<boolean>;
  /** Re-emits `onItemHighlighted` after the item registry settles. */
  syncHighlightedItem: () => void;
}

export const MenuRootContext = createContext<MenuRootContext | null>(null);

export function useMenuRootContext(optional?: false): MenuRootContext;
export function useMenuRootContext(optional: true): MenuRootContext | null;
export function useMenuRootContext(optional?: boolean) {
  const context = useContext(MenuRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.',
    );
  }

  return context;
}
