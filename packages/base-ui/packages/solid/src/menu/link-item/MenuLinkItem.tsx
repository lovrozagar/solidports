import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useButton } from '../../internals/use-button';
import { mergeProps } from '../../merge-props';
import { splitComponentProps, useRef } from '../../solid-helpers';
import type { BaseUIComponentProps, BaseUIHTMLProps, HTMLProps } from '../../utils/types';
import type { JSX } from '@solidjs/web';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { REGULAR_ITEM } from '../item/useMenuItem';
import { useMenuItemCommonProps } from '../item/useMenuItemCommonProps';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuLinkItem(componentProps: MenuLinkItem.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'id',
    'label',
    'closeOnClick',
  ]);
  const idProp = () => local.id;
  const closeOnClick = () => local.closeOnClick ?? false;

  const linkRef = useRef<HTMLAnchorElement | null | undefined>(null);

  const listItem = useCompositeListItem({ label: () => local.label });
  const menuPositionerContext = useMenuPositionerContext(true);
  const nodeId = () => menuPositionerContext?.context.nodeId();

  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');
  const typingRef = store.context.typingRef;

  const { getButtonProps, buttonRef } = useButton({
    native: false,
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    get closeOnClick() {
      return closeOnClick();
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return id();
    },
    itemRef: linkRef,
    get nodeId() {
      return nodeId();
    },
    store,
    typingRef,
    itemMetadata: REGULAR_ITEM,
  });

  function getItemProps(externalProps?: HTMLProps | BaseUIHTMLProps) {
    return mergeProps<'a'>([commonProps, externalProps, getButtonProps]);
  }

  const state: MenuLinkItem.State = {
    get highlighted() {
      return highlighted();
    },
  };

  const element = useRenderElement('a', componentProps, {
    get props() {
      return [itemProps(), elementProps, getItemProps];
    },
    ref: (el) => {
      linkRef.current = el;
      buttonRef(el);
      listItem.setRef(el);
    },
    state,
  });

  return <>{element()}</>;
}

export interface MenuLinkItemState {
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuLinkItemProps extends BaseUIComponentProps<
  'a',
  MenuLinkItem.State,
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>
> {
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

export namespace MenuLinkItem {
  export type State = MenuLinkItemState;
  export type Props = MenuLinkItemProps;
}
