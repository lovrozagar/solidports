import { children } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFilterDropdownItem } from '../../filter-dropdown/item/useFilterDropdownItem';
import type {
  MenuFilterImpl,
  MenuFilterItemParams,
  MenuFilterItemResult,
} from './MenuFilterContext';
import { MenuFilterGroup, MenuFilterRadioGroup } from './MenuFilterGroup';
import { MenuFilterList } from './MenuFilterList';
import { MenuFilterPopup } from './MenuFilterPopup';
import { useMenuFilterSubmenuTrigger } from './useMenuFilterSubmenuTrigger';
import { useVirtualFocusParentHandoff } from './useVirtualFocusParentHandoff';

function useItem(params: MenuFilterItemParams): MenuFilterItemResult {
  // Resolved once in the item's owner: the item renders these nodes, so a filtered-out item's
  // text is read from them without creating its children again.
  const resolvedChildren = children(() => params.children as JSX.Element);
  const item = useFilterDropdownItem({
    // One read each: reading JSX children creates them.
    get label() {
      const label = params.label;
      return typeof label === 'function' ? label() : label;
    },
    get children() {
      return resolvedChildren();
    },
    get render() {
      return params.render;
    },
  });
  return { visible: item.visible, ref: item.ref, children: resolvedChildren };
}

export const MENU_FILTER_IMPL: MenuFilterImpl = {
  Popup: MenuFilterPopup,
  List: MenuFilterList,
  Group: MenuFilterGroup,
  RadioGroup: MenuFilterRadioGroup,
  useItem,
  useSubmenuTrigger: useMenuFilterSubmenuTrigger,
  useParentHandoff: useVirtualFocusParentHandoff,
};
