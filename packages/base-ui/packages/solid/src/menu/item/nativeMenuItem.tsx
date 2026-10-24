/*
 * The native path shared by Menu's items (D32's sweep): one model per item, the target of
 * module-level handlers and attribute write, with `useMenuItem`, `useMenuItemCommonProps` and
 * `useButton` inlined. What differs between item kinds (the role, the `closeOnClick` default, the
 * state keys, the kind's own click and attributes) lives in one frozen module-level
 * `NativeMenuItemKind` per kind, which every item of that kind references: no per-item flags or
 * closures.
 */
import { untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isStaticKey } from '../../solid-helpers';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import type { ContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import type { BaseUIEvent } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { currentWritePass, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute, StateWriter } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import { platform } from '../../utils/platform';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { REASONS } from '../../utils/reasons';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRootContext } from '../root/MenuRootContext';
import type { MenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';

type ItemEvent<T extends Event> = BaseUIEvent<T>;

/** The `<div>` every item kind but the link renders. */
export const createItemDiv = (): Element => (<div />) as unknown as Element;

/** The props every native item kind reads. */
export interface NativeMenuItemProps {
  id?: string | undefined;
  label?: string | undefined;
  disabled?: boolean | undefined;
  closeOnClick?: boolean | undefined;
}

/** One item kind's fixed part of the native path, created once at module level and frozen. */
export interface NativeMenuItemKind {
  /** The part's own props: never forwarded to the element. */
  readonly own: ReadonlySet<string>;
  /** Literal part attributes (`role`). */
  readonly literal: Readonly<Record<string, unknown>>;
  /** The item state's `data-*` attributes, precompiled (`compileStateWriter`). */
  readonly stateWriter: StateWriter;
  /** `closeOnClick` when the prop is absent. */
  readonly closeOnClick: boolean;
  /** The element: compiled JSX, one per item. */
  readonly element: () => Element;
  /**
   * A link item (`useButton` with `native: false` over an `<a>`): never disabled, and Enter on a
   * link with an `href` is left to the browser.
   */
  readonly link: boolean;
  /** The item's state class: `class`/`style` functions and the state writer read it. */
  readonly State: new (item: NativeMenuItemModel) => NativeMenuItemHighlightState;
  /** Sets the kind's per-item fields up, in the item's owner (it may read context). */
  readonly init: ((item: NativeMenuItemModel) => void) | undefined;
  /** The kind's own click, after the consumer's and before the root's list navigation. */
  readonly click: ((item: NativeMenuItemModel, event: MouseEvent) => void) | undefined;
  /** The kind's attributes beside the item's, in the same write. */
  readonly attributes: ((w: SetAttribute, item: NativeMenuItemModel) => void) | undefined;
  /** Renders the element under the kind's context, which its parts (an indicator) read. */
  readonly provide: ((item: NativeMenuItemModel, render: () => Element) => Element) | undefined;
}

/**
 * A link item's state, and every item state's base, as `class`/`style` functions and its `data-*`
 * attributes read it: prototype getters over the item, the keyed highlight read once per write
 * pass (a keyed read registers a release per read, and the attribute write reads it too).
 */
export class NativeMenuItemHighlightState {
  declare protected readonly item: NativeMenuItemModel;
  declare private pass: number;
  declare private cachedHighlighted: boolean;

  constructor(item: NativeMenuItemModel) {
    this.item = item;
    this.pass = -1;
    this.cachedHighlighted = false;
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

/** An item's state: its highlight and whether it is disabled. */
export class NativeMenuItemState extends NativeMenuItemHighlightState {
  get disabled() {
    return this.item.disabled();
  }
}

/** A native open menu item: its model, the target of its module-level handlers and attribute write. */
export class NativeMenuItemModel {
  declare readonly props: NativeMenuItemProps;
  declare readonly kind: NativeMenuItemKind;
  declare readonly root: MenuRootContext;
  declare readonly contextMenu: ContextMenuRootContext | null;
  declare readonly index: Accessor<number>;
  declare readonly id: Accessor<string | undefined>;
  declare readonly state: NativeMenuItemHighlightState;
  declare element: HTMLElement | null;
  /** A checkbox or radio item's checked state (set by its kind's `init`). */
  declare checked: Accessor<boolean>;
  /** A checkbox item's `useControlled` setter (set by its kind's `init`). */
  declare setChecked: (checked: boolean) => void;
  /** A radio item's group (set by its kind's `init`). */
  declare group: MenuRadioGroupContext | undefined;

  constructor(
    props: NativeMenuItemProps,
    kind: NativeMenuItemKind,
    root: MenuRootContext,
    contextMenu: ContextMenuRootContext | null,
    index: Accessor<number>,
    id: Accessor<string | undefined>,
  ) {
    this.props = props;
    this.kind = kind;
    this.root = root;
    this.contextMenu = contextMenu;
    this.index = index;
    this.id = id;
    this.state = new kind.State(this);
    this.element = null;
  }

  disabled() {
    return (
      (!this.kind.link && Boolean(this.props.disabled)) ||
      this.group?.disabled() === true ||
      (!this.kind.link && this.root.store.select('disabled'))
    );
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
    this.kind.click?.(this, event);
    this.callListNavigation('onClick', event);
    if (this.props.closeOnClick ?? this.kind.closeOnClick) {
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
 * `useButton`'s keydown after the lower-priority handlers, for a non-native composite item: Space
 * and Enter click the item (Space unless typeahead prevented it); a link item with an `href`
 * leaves Enter to the browser.
 */
function compositeItemKeyDownAfter(item: NativeMenuItemModel, event: ItemEvent<KeyboardEvent>) {
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
  if (item.kind.link && (currentTarget as HTMLAnchorElement).href) {
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
      compositeItemKeyDownAfter(item, event);
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

/** The item's own attributes below the consumer's: one write per pass. */
function writeItemAttributes(w: SetAttribute, item: NativeMenuItemModel) {
  const { root } = item;
  const highlighted = item.state.highlighted;
  w.set('id', item.id());
  // `-1` rather than omitting it, which leaves links and buttons in the tab order.
  w.set('tabindex', !root.virtualFocus() && root.store.select('open') && highlighted ? 0 : -1);
  w.set(
    'aria-selected',
    root.store.select('webkitAriaSelected', () => highlighted) ? 'true' : undefined,
  );
  // `useFocusableWhenDisabled` for a non-native composite item.
  w.set('aria-disabled', item.disabled() ? 'true' : undefined);
  item.kind.attributes?.(w, item);
}

const itemState = (item: NativeMenuItemModel) => item.state;

/** Renders one native item of `kind` for `props`: a `<div>` registered with the menu's list. */
export function renderNativeMenuItem(
  props: NativeMenuItemProps,
  kind: NativeMenuItemKind,
): JSX.Element {
  const root = useMenuRootContext();
  const contextMenu = useContextMenuRootContext(true) ?? null;
  const listItem = createNativeListItem<null>(null, { label: () => props.label });
  // A static `id` (absent or literal) is read once: a constant accessor, no memo.
  const idIsStatic = !('id' in props) || isStaticKey(props, 'id');
  const id = useBaseUiId(idIsStatic ? untrack(() => props.id) : () => props.id);
  const model = new NativeMenuItemModel(props, kind, root, contextMenu, listItem.index, id);
  kind.init?.(model);
  const render = () => renderElement(props, model, listItem.setRef);
  return (kind.provide ? kind.provide(model, render) : render()) as unknown as JSX.Element;
}

function renderElement(
  props: NativeMenuItemProps,
  model: NativeMenuItemModel,
  setListRef: (node: HTMLElement | null | undefined) => void,
): Element {
  const kind = model.kind;
  return renderNativeElement(kind.element(), props, {
    own: kind.own,
    state: itemState,
    stateWriter: kind.stateWriter,
    stateView: model.state,
    reactive: true,
    literal: kind.literal as Record<string, unknown>,
    attributes: writeItemAttributes,
    handlers: ITEM_HANDLERS,
    handlersIfPassed: ITEM_HANDLERS_IF_PASSED,
    handlerTarget: model,
    refs: [
      setListRef,
      (node: HTMLElement | null) => {
        model.element = node;
      },
    ],
  });
}
