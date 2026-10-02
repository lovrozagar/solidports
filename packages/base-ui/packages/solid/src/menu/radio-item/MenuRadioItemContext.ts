import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface MenuRadioItemContext {
  checked: Accessor<boolean>;
  highlighted: Accessor<boolean>;
  disabled: Accessor<boolean>;
}

export const MenuRadioItemContext = createContext<MenuRadioItemContext | null>(null);

export function useMenuRadioItemContext() {
  const context = useContext(MenuRadioItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.',
    );
  }

  return context;
}
