import type { JSX } from '@solidjs/web';
import { provideContext } from '../../solid-helpers';
import type { FilterDropdownRoot } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { MenuFilterRoot } from '../filter-root/MenuFilterRoot';
import { MenuFilterSubmenuRoot } from '../filter-submenu-root/MenuFilterSubmenuRoot';
import type { MenuFilterProviderOptions } from './MenuFilterProviderOptions';
import { MenuFilterProviderContext } from './MenuFilterProviderContext';

/**
 * Enables filtering for the menu or submenu it wraps. Add `Menu.Input` to the popup and place
 * its items in `Menu.List`.
 * Wrap each searchable submenu in its own provider.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuFilterProvider(props: MenuFilterProvider.Props): JSX.Element {
  const options: MenuFilterProviderOptions = {
    get filter() {
      return props.filter;
    },
    get value() {
      return props.value;
    },
    get defaultValue() {
      return props.defaultValue;
    },
    get onValueChange() {
      return props.onValueChange;
    },
    get autoHighlight() {
      return props.autoHighlight;
    },
    get locale() {
      return props.locale;
    },
  };

  const contextValue: MenuFilterProviderContext = {
    Root: MenuFilterRoot,
    SubmenuRoot: MenuFilterSubmenuRoot,
    options,
  };

  return provideContext(MenuFilterProviderContext, contextValue, () => props.children);
}

export interface MenuFilterProviderState {}

export interface MenuFilterProviderProps extends MenuFilterProviderOptions {
  /**
   * The `<Menu.Root>` or `<Menu.SubmenuRoot>` to make filterable.
   */
  children?: JSX.Element;
}

export type MenuFilterProviderChangeEventReason = FilterDropdownRoot.ChangeEventReason;
export type MenuFilterProviderChangeEventDetails = FilterDropdownRoot.ChangeEventDetails;

export namespace MenuFilterProvider {
  export type State = MenuFilterProviderState;
  export type Props = MenuFilterProviderProps;
  export type ChangeEventReason = MenuFilterProviderChangeEventReason;
  export type ChangeEventDetails = MenuFilterProviderChangeEventDetails;
}
