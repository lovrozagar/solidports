import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { omitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceMemo } from '../../utils/propsView';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { REGULAR_ITEM, useMenuItem } from './useMenuItem';

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuItem(componentProps: MenuItem.Props) {
  const elementProps = omitComponentProps(componentProps, [
    'id',
    'label',
    'nativeButton',
    'disabled',
    'closeOnClick',
  ] as const);
  const idProp = () => componentProps.id;
  const nativeButton = () => Boolean(componentProps.nativeButton);
  const disabledProp = () => Boolean(componentProps.disabled);
  const closeOnClick = () => componentProps.closeOnClick ?? true;

  const listItem = useCompositeListItem({
    get label() {
      return componentProps.label;
    },
  });
  const menuPositionerContext = useMenuPositionerContext(true);
  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const rootDisabled = store.useState('disabled');
  const disabled = () => disabledProp() || rootDisabled();
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');

  const { itemSources, setItemRef } = useMenuItem({
    closeOnClick,
    disabled,
    highlighted,
    id,
    itemMetadata: REGULAR_ITEM,
    nativeButton,
    nodeId: () => menuPositionerContext?.context.nodeId(),
    store,
  });

  const state: MenuItem.State = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
  };

  const element = useRenderElement('div', componentProps, {
    // Built once: the root's item props as an accessor source between the item's own sources.
    props: [
      ...itemSources.attributes,
      propsSourceMemo(itemProps),
      elementProps,
      itemSources.handlers,
    ],
    ref: (el) => {
      setItemRef(el);
      listItem.setRef(el);
    },
    state,
  });

  return <>{element()}</>;
}

export interface MenuItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuItemProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuItem.State> {
  /**
   * The click handler for the menu item.
   */
  onClick?: BaseUIComponentProps<'div', MenuItemState>['onClick'] | undefined;
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
   *
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuItem {
  export type State = MenuItemState;
  export type Props = MenuItemProps;
}
