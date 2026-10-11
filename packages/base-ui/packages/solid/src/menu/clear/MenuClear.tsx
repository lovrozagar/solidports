import { FilterDropdownClear } from '../../filter-dropdown/clear/FilterDropdownClear';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';

/**
 * A button that clears the input text.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders a `<button>` element when the input has text.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuClear(props: MenuClear.Props) {
  useMenuFilterPart('Clear');
  return <FilterDropdownClear {...props} />;
}

export namespace MenuClear {
  export type State = FilterDropdownClear.State;
  export type Props = FilterDropdownClear.Props;
}
