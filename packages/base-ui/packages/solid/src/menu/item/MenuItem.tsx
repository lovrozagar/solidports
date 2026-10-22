import { Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import type { ContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { isStaticKey, omitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps, BaseUIEvent, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceMemo } from '../../utils/propsView';
import { canRenderNative, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import {
  compileStateWriter,
  currentWritePass,
  renderNativeElement,
} from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import { platform } from '../../utils/platform';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { REASONS } from '../../utils/reasons';
import {
  isUnfilteredItem,
  useMenuFilterItem,
  withFilterChildren,
} from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRootContext } from '../root/MenuRootContext';
import { REGULAR_ITEM, useMenuItem } from './useMenuItem';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'id',
  'label',
  'nativeButton',
  'disabled',
  'closeOnClick',
]);
const MENU_ITEM: Record<string, unknown> = { role: 'menuitem' };

type ItemEvent<T extends Event> = BaseUIEvent<T>;

/**
 * The item's state, as `class`/`style` functions and its `data-*` attributes read it: prototype
 * getters over the item, the keyed highlight read once per write pass (a keyed read registers a
 * release per read, and the attribute write reads it too).
 */
class NativeMenuItemState implements MenuItem.State {
  declare private readonly item: NativeMenuItemModel;
  declare private pass: number;
  declare private cachedHighlighted: boolean;

  constructor(item: NativeMenuItemModel) {
    this.item = item;
    this.pass = -1;
    this.cachedHighlighted = false;
  }

  get disabled() {
    return this.item.disabled();
  }

  get highlighted() {
    const pass = currentWritePass();
    if (this.pass !== pass) {
      this.pass = pass;
      this.cachedHighlighted = this.item.highlighted();
    }
    return this.cachedHighlighted;
  }
}

/**
 * A native open menu item: its model, the target of its module-level handlers and attribute
 * write. One object per item; `useMenuItem`, `useMenuItemCommonProps` and `useButton` inlined.
 */
class NativeMenuItemModel {
  declare readonly props: MenuItem.Props;
  declare readonly root: MenuRootContext;
  declare readonly contextMenu: ContextMenuRootContext | null;
  declare readonly index: Accessor<number>;
  declare readonly id: Accessor<string | undefined>;
  declare readonly state: NativeMenuItemState;
  declare element: HTMLElement | null;

  constructor(
    props: MenuItem.Props,
    root: MenuRootContext,
    contextMenu: ContextMenuRootContext | null,
    index: Accessor<number>,
    id: Accessor<string | undefined>,
  ) {
    this.props = props;
    this.root = root;
    this.contextMenu = contextMenu;
    this.index = index;
    this.id = id;
    this.state = new NativeMenuItemState(this);
    this.element = null;
  }

  disabled() {
    return Boolean(this.props.disabled) || this.root.store.select('disabled');
  }

  highlighted() {
    return this.root.store.select('isActive', this.index);
  }

  /** The root's list navigation handler for `key` (none until the interactions are created). */
  callListNavigation(key: string, event: Event) {
    const handler = readHandler(this.root.store.state.itemProps, key);
    if (handler) {
      handler(event);
    }
  }

  mouseDown(event: MouseEvent) {
    this.callListNavigation('onMouseDown', event);
    // Real focus stays on the input or list that owns virtual navigation.
    if (this.root.virtualFocus()) {
      event.preventDefault();
    }
  }

  keyDown(event: ItemEvent<KeyboardEvent>) {
    this.callListNavigation('onKeyDown', event);
    if (event.key === ' ' && this.root.store.context.typingRef.current) {
      event.preventDefault();
    }
  }

  mouseMove(event: MouseEvent) {
    this.callListNavigation('onMouseMove', event);
    const nodeId = this.root.store.state.floatingNodeId;
    if (!nodeId) {
      return;
    }
    // Inform the floating tree that a menu item within this menu was hovered/moved over so
    // unrelated descendant submenus can be closed.
    this.root.store.select('floatingTreeRoot').events.emit('itemhover', {
      nodeId,
      target: event.currentTarget,
    });
  }

  click(event: MouseEvent) {
    this.callListNavigation('onClick', event);
    if (this.props.closeOnClick ?? true) {
      this.root.store
        .select('floatingTreeRoot')
        .events.emit('close', { domEvent: event, reason: REASONS.itemPress });
    }
  }

  mouseUp(event: MouseEvent) {
    this.callListNavigation('onMouseUp', event);
    const contextMenu = this.contextMenu;
    if (contextMenu) {
      const initialCursorPoint = contextMenu.initialCursorPointRef.current;
      contextMenu.initialCursorPointRef.current = null;
      if (
        initialCursorPoint &&
        Math.abs(event.clientX - initialCursorPoint.x) <= 1 &&
        Math.abs(event.clientY - initialCursorPoint.y) <= 1
      ) {
        return;
      }
      // On non-macOS platforms, this mouseup belongs to the right-click gesture that opened the
      // context menu, so it must not activate an item.
      if (!platform.os.mac && event.button === 2) {
        return;
      }
    }
    const itemElement = this.element;
    if (
      itemElement &&
      this.root.store.context.allowMouseUpTriggerRef.current &&
      (!contextMenu || event.button === 2)
    ) {
      // The user pressed the trigger, moved the cursor and released it over the item: click it,
      // marked as a mouse gesture so MenuRoot and FloatingFocusManager don't read a keyboard
      // activation.
      dispatchClickWithModifiers(itemElement, event, { detail: 1, pointerType: 'mouse' });
    }
  }
}

/**
 * `useButton`'s keydown after the lower-priority handlers, for a non-native composite item that is
 * not a link: Space and Enter click the item (Space unless typeahead prevented it).
 */
function compositeItemKeyDownAfter(event: ItemEvent<KeyboardEvent>) {
  if (event.baseUIHandlerPrevented || event.target !== event.currentTarget) {
    return;
  }
  const currentTarget = event.currentTarget as Element;
  if (event.key === ' ') {
    const role = currentTarget.getAttribute('role');
    const isTextNavigationRole =
      role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';
    if (event.defaultPrevented && isTextNavigationRole) {
      return;
    }
    event.preventDefault();
    event.preventBaseUIHandler();
    dispatchClickWithModifiers(currentTarget, event);
    return;
  }
  if (event.key !== 'Enter' || event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  event.preventBaseUIHandler();
  dispatchClickWithModifiers(currentTarget, event);
}

/** A disabled item cancels the event and runs no handler (`useButton`'s click and pointerdown). */
function preventWhileDisabled(item: NativeMenuItemModel, event: Event) {
  if (item.disabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

const callListNavigation = (key: string) => (item: NativeMenuItemModel, event: Event) =>
  item.callListNavigation(key, event);

/**
 * A native item's handlers, in the slow path's `mergeProps` order (the button's wrappers, then the
 * consumer's, then the root's list navigation, then the item's own), created once.
 */
const ITEM_HANDLERS: Readonly<Record<string, Dispatch<NativeMenuItemModel>>> = {
  onClick: partHandler<NativeMenuItemModel, MouseEvent>(
    'onClick',
    (item, event) => item.click(event),
    preventWhileDisabled,
  ),
  onKeyDown: partHandler<NativeMenuItemModel, KeyboardEvent>(
    'onKeyDown',
    (item, event) => {
      item.keyDown(event);
      compositeItemKeyDownAfter(event);
    },
    (item, event) => {
      // `useFocusableWhenDisabled`: a disabled item keeps Tab and blocks every other key.
      if (item.disabled() && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !item.disabled();
    },
  ),
  onMouseDown: partHandler<NativeMenuItemModel, MouseEvent>(
    'onMouseDown',
    (item, event) => item.mouseDown(event),
    (item) => !item.disabled(),
  ),
  onMouseMove: partHandler<NativeMenuItemModel, MouseEvent>('onMouseMove', (item, event) =>
    item.mouseMove(event),
  ),
  onMouseUp: partHandler<NativeMenuItemModel, MouseEvent>('onMouseUp', (item, event) =>
    item.mouseUp(event),
  ),
  onFocus: partHandler<NativeMenuItemModel, FocusEvent>('onFocus', callListNavigation('onFocus')),
  onPointerLeave: partHandler<NativeMenuItemModel, PointerEvent>(
    'onPointerLeave',
    callListNavigation('onPointerLeave'),
  ),
  onPointerDown: partHandler<NativeMenuItemModel, PointerEvent>(
    'onPointerDown',
    callListNavigation('onPointerDown'),
    preventWhileDisabled,
  ),
};

/** Bound only when the consumer passes them: `useButton`'s gate around the consumer's handler. */
const ITEM_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<NativeMenuItemModel>>> = {
  onKeyUp: partHandler<NativeMenuItemModel>('onKeyUp', undefined, (item) => !item.disabled()),
};

/** The item state's `data-*` attributes in the slow path's key order. */
const writeItemState = compileStateWriter(['disabled', 'highlighted'], undefined);

/** The item's own attributes below the consumer's: one write per pass. */
function writeItemAttributes(w: SetAttribute, item: NativeMenuItemModel) {
  const { root } = item;
  const state = item.state;
  const highlighted = state.highlighted;
  w.set('id', item.id());
  // `-1` rather than omitting it, which leaves links and buttons in the tab order.
  w.set('tabindex', !root.virtualFocus() && root.store.select('open') && highlighted ? 0 : -1);
  w.set(
    'aria-selected',
    root.store.select('webkitAriaSelected', () => highlighted) ? 'true' : undefined,
  );
  // `useFocusableWhenDisabled` for a non-native composite item.
  w.set('aria-disabled', state.disabled ? 'true' : undefined);
}

const itemState = (item: NativeMenuItemModel) => item.state;

function NativeMenuItem(props: MenuItem.Props): JSX.Element {
  const root = useMenuRootContext();
  const contextMenu = useContextMenuRootContext(true) ?? null;
  const listItem = createNativeListItem<null>(null, { label: () => props.label });
  // A static `id` (absent or literal) is read once: a constant accessor, no memo.
  const idIsStatic = !('id' in props) || isStaticKey(props, 'id');
  const id = useBaseUiId(idIsStatic ? untrack(() => props.id) : () => props.id);
  const model = new NativeMenuItemModel(props, root, contextMenu, listItem.index, id);

  const el = (<div />) as unknown as HTMLDivElement;
  return renderNativeElement(el, props, {
    own: OWN_KEYS,
    state: itemState,
    stateWriter: writeItemState,
    stateView: model.state,
    reactive: true,
    literal: MENU_ITEM,
    attributes: writeItemAttributes,
    handlers: ITEM_HANDLERS,
    handlersIfPassed: ITEM_HANDLERS_IF_PASSED,
    handlerTarget: model,
    refs: [
      listItem.setRef,
      (node: HTMLElement | null) => {
        model.element = node;
      },
    ],
  }) as unknown as JSX.Element;
}

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
    ? NativeMenuItem(componentProps)
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
