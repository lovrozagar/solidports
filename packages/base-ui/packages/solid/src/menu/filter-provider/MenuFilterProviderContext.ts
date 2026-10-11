import { createContext, useContext } from 'solid-js';
import type { MenuFilterRoot } from '../filter-root/MenuFilterRoot';
import type { MenuFilterSubmenuRoot } from '../filter-submenu-root/MenuFilterSubmenuRoot';
import type { MenuFilterProviderOptions } from './MenuFilterProviderOptions';

/**
 * What `Menu.FilterProvider` hands to the root directly inside it: the filterable root
 * implementations (the provider is their only importer) and the filter props.
 */
export interface MenuFilterProviderContext {
  Root: typeof MenuFilterRoot;
  SubmenuRoot: typeof MenuFilterSubmenuRoot;
  options: MenuFilterProviderOptions;
}

/**
 * Non-null only directly below a provider. The root that consumes it resets it, so a plain
 * `Menu.SubmenuRoot` inside a filterable menu stays plain.
 */
export const MenuFilterProviderContext = createContext<MenuFilterProviderContext | null>(null);

export function useMenuFilterProviderContext(optional?: false): MenuFilterProviderContext;
export function useMenuFilterProviderContext(optional: true): MenuFilterProviderContext | null;
export function useMenuFilterProviderContext(optional?: boolean) {
  const context = useContext(MenuFilterProviderContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: MenuFilterProviderContext is missing. Filter parts must be placed within <Menu.FilterProvider>.',
    );
  }
  return context;
}
