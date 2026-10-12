import type { JSX } from '@solidjs/web';
import { provideContext } from '../../solid-helpers';
import { useFilterDropdownGroup } from '../../filter-dropdown/group/useFilterDropdownGroup';
import { FilterDropdownGroupContext } from '../../filter-dropdown/group/FilterDropdownGroupContext';
import { MenuGroupPlain } from '../group/MenuGroup';
import type { MenuGroup } from '../group/MenuGroup';
import { MenuRadioGroupPlain } from '../radio-group/MenuRadioGroup';
import type { MenuRadioGroup } from '../radio-group/MenuRadioGroup';

/**
 * `Menu.Group` in a filterable menu: hidden, label included, once the query filters out all of
 * its items.
 *
 * @internal
 */
export function MenuFilterGroup(props: MenuGroup.Props): JSX.Element {
  const { hidden, context } = useFilterDropdownGroup();

  return provideContext(FilterDropdownGroupContext, context, () => (
    <MenuGroupPlain {...props} hidden={hidden() || props.hidden || undefined} />
  ));
}

/**
 * `Menu.RadioGroup` in a filterable menu, hidden like `MenuFilterGroup`.
 *
 * @internal
 */
export function MenuFilterRadioGroup(props: MenuRadioGroup.Props): JSX.Element {
  const { hidden, context } = useFilterDropdownGroup();

  return provideContext(FilterDropdownGroupContext, context, () => (
    <MenuRadioGroupPlain {...props} hidden={hidden() || props.hidden || undefined} />
  ));
}
