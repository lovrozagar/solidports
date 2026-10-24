import { Show, untrack } from 'solid-js';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { NOOP } from '../../utils/empty';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceMemo } from '../../utils/propsView';
import { REGULAR_ITEM, useMenuItem } from '../item/useMenuItem';
import { NativeMenuItemState, renderNativeMenuItem } from '../item/nativeMenuItem';
import type { NativeMenuItemKind, NativeMenuItemModel } from '../item/nativeMenuItem';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { provideNativeContext } from '../../utils/native/context';
import { useMenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import {
  useMenuFilterImpl,
  useMenuFilterItem,
  withFilterChildren,
} from '../filter-root/MenuFilterContext';
import { itemMapping } from '../utils/stateAttributesMapping';
import { MenuRadioItemContext } from './MenuRadioItemContext';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;

/** A radio item's state: the item's, plus whether its value is the group's. */
class NativeMenuRadioItemState extends NativeMenuItemState {
  get checked() {
    return this.item.checked();
  }
}

/**
 * The item's group: its disabled state joins the item's, and `checked` reads the group's keyed
 * membership, so a value change re-runs only the items that became or stopped being checked.
 */
function initRadioItem(item: NativeMenuItemModel) {
  const group = useMenuRadioGroupContext();
  const props = item.props as MenuRadioItem.Props;
  item.group = group;
  item.checked = () => group.isChecked(props.value);
}

/** The radio item's click: the group selects its value. */
function selectRadioItem(item: NativeMenuItemModel, event: MouseEvent) {
  const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
    preventUnmountOnClose: NOOP,
  });
  item.group!.setValue((item.props as MenuRadioItem.Props).value, details);
}

function writeRadioItemAttributes(w: SetAttribute, item: NativeMenuItemModel) {
  w.set('aria-checked', item.checked() ? 'true' : 'false');
}

/**
 * A radio item's native kind: `role="menuitemradio"`, stays open on click by default, and provides
 * its state to its indicator. The model is the context value (`checked`, `disabled` and
 * `highlighted`).
 */
const RADIO_ITEM_KIND = Object.freeze<NativeMenuItemKind>({
  own: new Set(['id', 'label', 'nativeButton', 'disabled', 'closeOnClick', 'value']),
  literal: Object.freeze({ role: 'menuitemradio' }),
  stateWriter: compileStateWriter(['checked', 'disabled', 'highlighted'], itemMapping),
  closeOnClick: false,
  State: NativeMenuRadioItemState,
  init: initRadioItem,
  click: selectRadioItem,
  attributes: writeRadioItemAttributes,
  provide: (item, render) =>
    provideNativeContext(MenuRadioItemContext, item as unknown as MenuRadioItemContext, render),
});

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItem(componentProps: MenuRadioItem.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): as Menu.Item's, with the radio
  // kind (D32's sweep). A filtered menu keeps the slow path's visibility branch.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton) !== true &&
    // Read without registering: the slow path registers its item under the item's context.
    useMenuFilterImpl() === null
  ) {
    return renderNativeMenuItem(componentProps, RADIO_ITEM_KIND);
  }
  return SlowMenuRadioItem(componentProps);
}

function SlowMenuRadioItem(componentProps: MenuRadioItem.Props) {
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
  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const rootDisabled = store.useState('disabled');
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');

  const {
    isChecked,
    setValue: setSelectedValue,
    disabled: groupDisabled,
  } = useMenuRadioGroupContext();

  const disabled = () => disabledProp() || groupDisabled() || rootDisabled();
  // Keyed: a value change re-runs only the items that became or stopped being checked.
  const checked = () => isChecked(local.value);

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
          role: 'menuitemradio' as const,
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

  return provideContext(MenuRadioItemContext, contextValue, renderItem);
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

export namespace MenuRadioItem {
  export type State = MenuRadioItemState;
  export type Props = MenuRadioItemProps;
}
