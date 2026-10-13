import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import { useBaseUiId } from '../src/utils/useBaseUiId';
import { resolvePopupLabel } from '../src/utils/resolvePopupLabel';
import { mergeProps } from '../src/merge-props';
import { useMenuFilterPopup } from '../src/menu/filter-root/useMenuFilterPopup';
import { useFilterDropdownRootContext } from '../src/filter-dropdown/root/FilterDropdownRootContext';
import { FilterDropdownList } from '../src/filter-dropdown/list/FilterDropdownList';

export { FilterDropdownRoot as Root } from '../src/filter-dropdown/root/FilterDropdownRoot';
export { FilterDropdownInput as Input } from '../src/filter-dropdown/input/FilterDropdownInput';
export { FilterDropdownClear as Clear } from '../src/filter-dropdown/clear/FilterDropdownClear';
export { FilterDropdownEmpty as Empty } from '../src/filter-dropdown/empty/FilterDropdownEmpty';

// Menu-shaped hosts for testing the filter engine without a floating popup or navigation.
export function Popup(props: ComponentProps<'div'>) {
  const id = useBaseUiId(() => props.id);
  const context = useFilterDropdownRootContext();
  const interactionProps = useMenuFilterPopup(() => 'vertical');
  return (
    <div
      {...mergeProps(
        {
          get id() {
            return id();
          },
          role: 'dialog',
          get 'aria-labelledby'() {
            return context.triggerId();
          },
        },
        interactionProps,
        omit(props, 'id'),
      )}
    />
  );
}

export function List(props: FilterDropdownList.Props) {
  const context = useFilterDropdownRootContext();
  return (
    <FilterDropdownList
      {...mergeProps<typeof FilterDropdownList>(
        {
          role: 'menu',
          get 'aria-labelledby'() {
            return resolvePopupLabel(
              {
                'aria-label': typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined,
                'aria-labelledby':
                  typeof props['aria-labelledby'] === 'string' ? props['aria-labelledby'] : undefined,
                render: props.render,
              },
              null,
              context.triggerId() ?? null,
            );
          },
        },
        props,
      )}
    />
  );
}
