import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useButton } from '../../internals/use-button';
import { omitComponentProps, useRef } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceMemo } from '../../utils/propsView';
import { REGULAR_ITEM } from '../item/useMenuItem';
import { useMenuItemCommonProps } from '../item/useMenuItemCommonProps';
import {
  isUnfilteredItem,
  useMenuFilterItem,
  withFilterChildren,
} from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { NativeMenuItemHighlightState, renderNativeMenuItem } from '../item/nativeMenuItem';
import type { NativeMenuItemKind } from '../item/nativeMenuItem';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter } from '../../utils/native/element';

/**
 * A link item's native kind: an `<a role="menuitem">` that is never disabled, stays open on click
 * by default, and leaves Enter to the browser when it has an `href`.
 */
const LINK_ITEM_KIND = Object.freeze<NativeMenuItemKind>({
  own: new Set(['id', 'label', 'closeOnClick']),
  literal: Object.freeze({ role: 'menuitem' }),
  stateWriter: compileStateWriter(['highlighted'], undefined),
  closeOnClick: false,
  // eslint-disable-next-line jsx-a11y/anchor-is-valid -- the template: `href` comes from the consumer's props
  element: () => (<a />) as unknown as Element,
  link: true,
  State: NativeMenuItemHighlightState,
  init: undefined,
  click: undefined,
  attributes: undefined,
  provide: undefined,
});

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuLinkItem(componentProps: MenuLinkItem.Props) {
  const filterItem = useMenuFilterItem({
    get label() {
      return componentProps.label;
    },
    get children() {
      return componentProps.children;
    },
    get render() {
      return componentProps.render;
    },
  });
  // Native fast path (`context/architecture/render-pipeline.md`): as Menu.Item's, with the link
  // kind (D32's sweep). A filtered menu keeps the slow path's visibility branch.
  return isUnfilteredItem(filterItem) && canRenderNative(componentProps)
    ? renderNativeMenuItem(componentProps, LINK_ITEM_KIND)
    : SlowMenuLinkItem(componentProps, filterItem);
}

function SlowMenuLinkItem(
  componentProps: MenuLinkItem.Props,
  filterItem: ReturnType<typeof useMenuFilterItem>,
) {
  const elementProps = omitComponentProps(componentProps, ['id', 'label', 'closeOnClick'] as const);
  const idProp = () => componentProps.id;
  const closeOnClick = () => componentProps.closeOnClick ?? false;

  const linkRef = useRef<HTMLAnchorElement | null | undefined>(null);

  const listItem = useCompositeListItem({ label: () => componentProps.label });

  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const nodeId = store.useState('floatingNodeId');
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');
  const typingRef = store.context.typingRef;

  const { buttonSources, buttonRef } = useButton({
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

  const state: MenuLinkItem.State = {
    get highlighted() {
      return highlighted();
    },
  };

  const element = useRenderElement('a', withFilterChildren(componentProps, filterItem), {
    // Built once: the button's attributes and the item's common props below the
    // part's props, the button's handlers above them (wrapping, as `getButtonProps` did).
    props: [
      ...buttonSources.attributes,
      commonProps,
      propsSourceMemo(itemProps),
      elementProps,
      buttonSources.handlers,
    ],
    ref: (el) => {
      linkRef.current = el;
      buttonRef(el);
      listItem.setRef(el);
      if (filterItem.ref) {
        filterItem.ref.current = el ?? null;
      }
    },
    state,
  });

  return <Show when={filterItem.visible()}>{element()}</Show>;
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
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
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
