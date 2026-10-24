import { Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { omitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceMemo } from '../../utils/propsView';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter } from '../../utils/native/element';
import {
  isUnfilteredItem,
  useMenuFilterItem,
  withFilterChildren,
} from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { createItemDiv, NativeMenuItemState, renderNativeMenuItem } from './nativeMenuItem';
import type { NativeMenuItemKind } from './nativeMenuItem';
import { REGULAR_ITEM, useMenuItem } from './useMenuItem';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;

/** A plain `Menu.Item`'s native kind: `role="menuitem"`, closes the menu on click by default. */
const ITEM_KIND = Object.freeze<NativeMenuItemKind>({
  own: new Set(['id', 'label', 'nativeButton', 'disabled', 'closeOnClick']),
  literal: Object.freeze({ role: 'menuitem' }),
  /** The item state's `data-*` attributes in the slow path's key order. */
  stateWriter: compileStateWriter(['disabled', 'highlighted'], undefined),
  closeOnClick: true,
  element: createItemDiv,
  link: false,
  State: NativeMenuItemState,
  init: undefined,
  click: undefined,
  attributes: undefined,
  provide: undefined,
});

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuItem(componentProps: MenuItem.Props): JSX.Element {
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

  // Native fast path (`context/architecture/render-pipeline.md`): a plain menu's item renders its
  // `<div role="menuitem">` with direct JSX; `useButton`, `useMenuItem` and the composite list
  // item inlined (D32). `nativeButton` asks for a `<button>`, and a filtered item keeps the slow
  // path's visibility branch and children.
  return isUnfilteredItem(filterItem) &&
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton) !== true
    ? renderNativeMenuItem(componentProps, ITEM_KIND)
    : SlowMenuItem(componentProps, filterItem);
}

function SlowMenuItem(
  componentProps: MenuItem.Props,
  filterItem: ReturnType<typeof useMenuFilterItem>,
): JSX.Element {
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
    nodeId: store.useState('floatingNodeId'),
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

  const element = useRenderElement('div', withFilterChildren(componentProps, filterItem), {
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
      if (filterItem.ref) {
        filterItem.ref.current = el ?? null;
      }
    },
    state,
  });

  return <Show when={filterItem.visible()}>{element()}</Show>;
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
   *
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuItem {
  export type State = MenuItemState;
  export type Props = MenuItemProps;
}
