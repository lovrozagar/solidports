import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { KeyedSelector } from '../../utils/createKeyedSelector';
import type { MenuRoot } from '../root/MenuRoot';

export interface MenuRadioGroupContext {
  value: Accessor<any>;
  /**
   * Whether `value` is the group's value (tracked): one keyed membership the group creates on the
   * first read, so a change re-runs only the radio items that became or stopped being checked.
   */
  isChecked: KeyedSelector;
  setValue: (newValue: any, eventDetails: MenuRoot.ChangeEventDetails) => void;
  disabled: Accessor<boolean>;
}

export const MenuRadioGroupContext = createContext<MenuRadioGroupContext | null>(null);

export function useMenuRadioGroupContext() {
  const context = useContext(MenuRadioGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuRadioGroupContext is missing. MenuRadioGroup parts must be placed within <Menu.RadioGroup>.',
    );
  }

  return context;
}
