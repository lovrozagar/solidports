import type { JSX } from '@solidjs/web';
import { useMenubarContext } from '../../menubar/MenubarContext';
import { isVirtualPointerEvent } from '../../floating-ui-solid/utils/event';
import { FilterDropdownRoot } from '../../filter-dropdown/root/FilterDropdownRoot';
import { useFilterDropdownCloseQuery } from '../../filter-dropdown/root/useFilterDropdownCloseQuery';
import type { FilterDropdownFilter } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { provideContext } from '../../solid-helpers';
import { useControlled } from '../../utils/useControlled';
import { REASONS } from '../../utils/reasons';
import type { HTMLProps } from '../../utils/types';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuFilterProvider } from '../filter-provider/MenuFilterProvider';
import { MenuFilterImplContext } from './MenuFilterContext';
import { MENU_FILTER_IMPL } from './MenuFilterImpl';
import { useMenuFilterKeyDown } from './useMenuFilterKeyDown';

export interface MenuFilterDropdownProps {
  value: string | undefined;
  defaultValue: string | undefined;
  onValueChange: MenuFilterProvider.Props['onValueChange'];
  filter: FilterDropdownFilter | null | undefined;
  autoHighlight: boolean | 'always';
  locale: Intl.LocalesArgument | undefined;
  children?: JSX.Element;
}

/**
 * Reads the menu store, which is only available below the menu root, and hands the filter
 * engine the list the menu navigates and the command that moves its highlight.
 */
export function MenuFilterDropdown(props: MenuFilterDropdownProps) {
  const { store } = useMenuRootContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const keyboardOpen = store.useState('keyboardOpen');
  const activeTriggerId = store.useState('activeTriggerId');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const disabled = store.useState('disabled');

  const [value, setValue] = useControlled({
    controlled: () => props.value,
    default: () => props.defaultValue ?? '',
    name: 'MenuFilterProvider',
    state: 'value',
  });

  const handleValueChange = (
    nextValue: string,
    eventDetails: MenuFilterProvider.ChangeEventDetails,
  ) => {
    props.onValueChange?.(nextValue, eventDetails);
    if (!eventDetails.isCanceled) {
      setValue(nextValue);
    }
  };

  const query = useFilterDropdownCloseQuery({
    open,
    mounted,
    value,
    onValueChange: handleValueChange,
  });

  const filterTriggerProps = useFilterTriggerProps(() => value() !== '');
  store.useSyncedValue('filterTriggerProps', () => filterTriggerProps);

  const triggerId = () => {
    const element = activeTriggerElement();
    // Trust the rendered element's id once it exists: an explicitly empty id must not fall back
    // to a registered id that no element carries.
    return element ? element.id || null : activeTriggerId();
  };

  return provideContext(MenuFilterImplContext, MENU_FILTER_IMPL, () => (
    <FilterDropdownRoot
      open={open()}
      openedByKeyboard={keyboardOpen()}
      disabled={disabled()}
      value={value()}
      query={query()}
      onValueChange={handleValueChange}
      filter={props.filter}
      autoHighlight={props.autoHighlight}
      locale={props.locale}
      triggerId={triggerId()}
      listRef={store.context.itemDomElements as { current: Array<HTMLElement | null> }}
      getActiveIndex={() => store.select('activeIndex')}
      setActiveIndex={(index) => {
        store.setActiveIndex(index, REASONS.none);
      }}
      focusOwnerRef={store.context.virtualFocusRef}
    >
      {props.children}
    </FilterDropdownRoot>
  ));
}

/**
 * The props a filterable menu adds to its triggers: dialog semantics and a relay of list
 * navigation typed on the trigger to the input.
 */
function useFilterTriggerProps(hasValue: () => boolean): HTMLProps {
  const { store } = useMenuRootContext();
  const isInMenubar = useMenubarContext(true) != null;
  const handleInputKeyDown = useMenuFilterKeyDown(hasValue);

  return {
    'aria-haspopup': 'dialog',
    onPointerDown(event: PointerEvent) {
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onKeyDown(event: KeyboardEvent & { preventBaseUIHandler?: () => void }) {
      const focusOwner = store.context.virtualFocusRef?.current;
      if (!store.select('open') || !focusOwner || isInMenubar) {
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        focusOwner.focus({ preventScroll: true });
        handleInputKeyDown(event);
        event.preventDefault();
        event.preventBaseUIHandler?.();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventBaseUIHandler?.();
      } else if (isTypeaheadKey(event)) {
        focusOwner.focus({ preventScroll: true });
      }
    },
  };
}

function isTypeaheadKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}
