/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { splitComponentProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { NOOP } from '../../utils/empty';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { REGULAR_ITEM, useMenuItem } from '../item/useMenuItem';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { itemMapping } from '../utils/stateAttributesMapping';
import { MenuRadioItemContext } from './MenuRadioItemContext';

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItem(componentProps: MenuRadioItem.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'id',
    'label',
    'nativeButton',
    'disabled',
    'closeOnClick',
    'value',
  ]);
  const idProp = () => local.id;
  const nativeButton = () => Boolean(local.nativeButton);
  const disabledProp = () => Boolean(local.disabled);
  const closeOnClick = () => local.closeOnClick ?? false;

  const listItem = useCompositeListItem({ label: () => local.label });
  const menuPositionerContext = useMenuPositionerContext(true);
  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const rootDisabled = store.useState('disabled');
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');

  const {
    value: selectedValue,
    setValue: setSelectedValue,
    disabled: groupDisabled,
  } = useMenuRadioGroupContext();

  const disabled = () => disabledProp() || groupDisabled() || rootDisabled();
  const checked = () => selectedValue() === local.value;

  const { getItemProps, setItemRef } = useMenuItem({
    closeOnClick,
    disabled,
    highlighted,
    id,
    itemMetadata: REGULAR_ITEM,
    nativeButton,
    nodeId: () => menuPositionerContext?.context.nodeId(),
    store,
  });

  const state: MenuRadioItem.State = {
    get checked() {
      return checked();
    },
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
  };

  const contextValue: MenuRadioItemContext = {
    checked,
    disabled,
    highlighted,
  };

  const handleClick = (event: MouseEvent) => {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: NOOP,
    });
    setSelectedValue(local.value, details);
  };

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [
        itemProps(),
        {
          role: 'menuitemradio' as const,
          get 'aria-checked'() {
            return checked() ? 'true' : 'false';
          },
          onClick: handleClick,
        },
        elementProps,
        getItemProps,
      ];
    },
    ref: (el) => {
      setItemRef(el);
      listItem.setRef(el);
    },
    state,
    stateAttributesMapping: itemMapping,
  });

  return <MenuRadioItemContext value={contextValue}>{element()}</MenuRadioItemContext>;
}

export type MenuRadioItemState = {
  /**
   * Whether the radio item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the radio item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
};

export interface MenuRadioItemProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuRadioItem.State> {
  /**
   * Value of the radio item.
   * This is the value that will be set in the MenuRadioGroup when the item is selected.
   */
  value: any;
  /**
   * The click handler for the menu item.
   */
  onClick?: BaseUIComponentProps<'div', MenuRadioItemState>['onClick'] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Overrides the text label to use when the item is matched during keyboard text navigation.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuRadioItem {
  export type State = MenuRadioItemState;
  export type Props = MenuRadioItemProps;
}
