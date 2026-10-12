import { useFilterDropdownItem } from '../../filter-dropdown/item/useFilterDropdownItem';
import type { MenuFilterImpl } from './MenuFilterContext';
import { MenuFilterGroup, MenuFilterRadioGroup } from './MenuFilterGroup';
import { MenuFilterList } from './MenuFilterList';
import { MenuFilterPopup } from './MenuFilterPopup';
import { useMenuFilterSubmenuTrigger } from './useMenuFilterSubmenuTrigger';
import { useVirtualFocusParentHandoff } from './useVirtualFocusParentHandoff';
import type { MenuFilterItemParams, MenuFilterItemResult } from './MenuFilterContext';

function useItem(params: MenuFilterItemParams): MenuFilterItemResult {
  const item = useFilterDropdownItem({
    // One read each: reading JSX children creates them.
    get label() {
      const label = params.label;
      return typeof label === 'function' ? label() : label;
    },
    get children() {
      return params.children;
    },
    get render() {
      return params.render;
    },
  });
  return { visible: item.visible, ref: item.ref };
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
