import { Show, untrack } from 'solid-js';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { NOOP } from '../../utils/empty';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceMemo } from '../../utils/propsView';
import { REGULAR_ITEM, useMenuItem } from '../item/useMenuItem';
import { createItemDiv, NativeMenuItemState, renderNativeMenuItem } from '../item/nativeMenuItem';
import type { NativeMenuItemKind, NativeMenuItemModel } from '../item/nativeMenuItem';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { provideNativeContext } from '../../utils/native/context';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import {
  useMenuFilterImpl,
  useMenuFilterItem,
  withFilterChildren,
} from '../filter-root/MenuFilterContext';
import { itemMapping } from '../utils/stateAttributesMapping';
import { MenuCheckboxItemContext } from './MenuCheckboxItemContext';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;

/** A checkbox item's state: the item's, plus its checked state. */
class NativeMenuCheckboxItemState extends NativeMenuItemState {
  get checked() {
    return this.item.checked();
  }
}

/** `useControlled` over `checked`/`defaultChecked`; the click toggles it unless canceled. */
function initCheckboxItem(item: NativeMenuItemModel) {
  const props = item.props as MenuCheckboxItem.Props;
  const [checked, setChecked] = useControlled({
    controlled: () => props.checked,
    default: () => props.defaultChecked ?? false,
    name: 'MenuCheckboxItem',
    state: 'checked',
  });
  item.checked = checked;
  item.setChecked = setChecked;
}

/** The checkbox item's click: `onCheckedChange`, then the toggle unless the details are canceled. */
function toggleCheckboxItem(item: NativeMenuItemModel, event: MouseEvent) {
  const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
    preventUnmountOnClose: NOOP,
  });
  const next = !untrack(item.checked);
  (item.props as MenuCheckboxItem.Props).onCheckedChange?.(next, details);
  if (details.isCanceled) {
    return;
  }
  item.setChecked(next);
}

function writeCheckboxItemAttributes(w: SetAttribute, item: NativeMenuItemModel) {
  w.set('aria-checked', item.checked() ? 'true' : 'false');
}

/**
 * A checkbox item's native kind: `role="menuitemcheckbox"`, stays open on click by default, and
 * provides its state to its indicator. The model is the context value (`checked`, `disabled` and
 * `highlighted`).
 */
const CHECKBOX_ITEM_KIND = Object.freeze<NativeMenuItemKind>({
  own: new Set([
    'id',
    'label',
    'nativeButton',
    'disabled',
    'closeOnClick',
    'checked',
    'defaultChecked',
    'onCheckedChange',
  ]),
  literal: Object.freeze({ role: 'menuitemcheckbox' }),
  stateWriter: compileStateWriter(['checked', 'disabled', 'highlighted'], itemMapping),
  closeOnClick: false,
  element: createItemDiv,
  link: false,
  State: NativeMenuCheckboxItemState,
  init: initCheckboxItem,
  click: toggleCheckboxItem,
  attributes: writeCheckboxItemAttributes,
  provide: (item, render) =>
    provideNativeContext(
      MenuCheckboxItemContext,
      item as unknown as MenuCheckboxItemContext,
      render,
    ),
});

/**
 * A menu item that toggles a setting on or off.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItem(componentProps: MenuCheckboxItem.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): as Menu.Item's, with the
  // checkbox kind (D32's sweep). A filtered menu keeps the slow path's visibility branch.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton) !== true &&
    // Read without registering: the slow path registers its item under the item's context.
    useMenuFilterImpl() === null
  ) {
    return renderNativeMenuItem(componentProps, CHECKBOX_ITEM_KIND);
  }
  return SlowMenuCheckboxItem(componentProps);
}

function SlowMenuCheckboxItem(componentProps: MenuCheckboxItem.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'id',
    'label',
    'nativeButton',
    'disabled',
    'closeOnClick',
    'checked',
    'defaultChecked',
    'onCheckedChange',
  ]);
  const idProp = () => local.id;
  const nativeButton = () => Boolean(local.nativeButton);
  const disabledProp = () => Boolean(local.disabled);
  const closeOnClick = () => local.closeOnClick ?? false;
  const checkedProp = () => local.checked;
  const defaultChecked = () => local.defaultChecked;

  const listItem = useCompositeListItem({ label: () => local.label });
  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const rootDisabled = store.useState('disabled');
  const disabled = () => disabledProp() || rootDisabled();
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');

  const [checked, setChecked] = useControlled({
    controlled: checkedProp,
    default: () => defaultChecked() ?? false,
    name: 'MenuCheckboxItem',
    state: 'checked',
  });

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

  const state: MenuCheckboxItem.State = {
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

  const contextValue: MenuCheckboxItemContext = {
    checked,
    disabled,
    highlighted,
  };

  const handleClick = (event: MouseEvent) => {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: NOOP,
    });

    local.onCheckedChange?.(!checked(), details);

    if (details.isCanceled) {
      return;
    }

    setChecked(() => !checked());
  };

  // The filter resolves the item's children once (to read their text): under the item's context,
  // where its parts (the indicator) read it.
  const renderItem = () => {
    const filterItem = useMenuFilterItem({
      get label() {
        return local.label;
      },
      get children() {
        return componentProps.children;
      },
      get render() {
        return componentProps.render;
      },
    });
    const element = useRenderElement('div', withFilterChildren(componentProps, filterItem), {
      props: [
        ...itemSources.attributes,
        propsSourceMemo(itemProps),
        {
          role: 'menuitemcheckbox' as const,
          get 'aria-checked'() {
            return checked() ? 'true' : 'false';
          },
          onClick: handleClick,
        },
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
      stateAttributesMapping: itemMapping,
    });
    return <Show when={filterItem.visible()}>{element()}</Show>;
  };

  return provideContext(MenuCheckboxItemContext, contextValue, renderItem);
}

export type MenuCheckboxItemState = {
  /**
   * Whether the checkbox item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the checkbox item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
};

export interface MenuCheckboxItemProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuCheckboxItem.State> {
  /**
   * Whether the checkbox item is currently ticked.
   *
   * To render an uncontrolled checkbox item, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox item is initially ticked.
   *
   * To render a controlled checkbox item, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Event handler called when the checkbox item is ticked or unticked.
   */
  onCheckedChange?:
    ((checked: boolean, eventDetails: MenuCheckboxItem.ChangeEventDetails) => void) | undefined;
  /**
   * The click handler for the menu item.
   */
  onClick?: BaseUIComponentProps<'div', MenuCheckboxItemState>['onClick'] | undefined;
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
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export type MenuCheckboxItemChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuCheckboxItemChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuCheckboxItem {
  export type State = MenuCheckboxItemState;
  export type Props = MenuCheckboxItemProps;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}
