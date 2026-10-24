/*
 * The native element of a plain menu's `Menu.SubmenuTrigger` (D32's sweep): a `<div
 * role="menuitem">` rendered with direct JSX, its handlers module-level over one model per
 * trigger, with `useMenuItem`, `useMenuItemCommonProps` and `useButton` inlined. The trigger's
 * logic (registration, hover and click, the focus-guard listener) stays in `MenuSubmenuTrigger`;
 * this is its element. The submenu's trigger props (`triggerProps`, a merged props object whose
 * keys come and go as the submenu opens and the VoiceOver branch drops `aria-expanded`) are read
 * where they are used: their handlers when an event fires, their attributes in the write.
 */
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isHandlerKey, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { platform } from '../../utils/platform';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import type { BaseUIEvent } from '../../utils/types';
import { compositeItemKeyDownAfter } from '../item/nativeMenuItem';
import type { MenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { MenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';
import type { MenuSubmenuTrigger } from './MenuSubmenuTrigger';

type TriggerEvent<T extends Event> = BaseUIEvent<T>;

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'label',
  'id',
  'nativeButton',
  'openOnHover',
  'delay',
  'closeDelay',
  'disabled',
]);
const MENU_ITEM: Record<string, unknown> = { role: 'menuitem' };
const ALWAYS = () => true;

/**
 * A native submenu trigger: its model, the target of its module-level handlers and attribute
 * write, and its state (`class`/`style` functions and the `data-*` attributes read it). One object
 * per trigger.
 */
export class NativeSubmenuTriggerModel implements MenuSubmenuTrigger.State {
  declare readonly props: MenuSubmenuTrigger.Props;
  declare readonly context: MenuRootContext;
  declare readonly contextMenu: ContextMenuRootContext | null;
  declare readonly index: Accessor<number>;
  declare readonly id: Accessor<string | undefined>;
  declare private readonly disabledAccessor: Accessor<boolean>;
  declare readonly omitExpanded: Accessor<boolean>;
  declare private readonly hover: object | undefined;
  declare private readonly click: { reference?: object | undefined };
  declare private readonly positioner: MenuPositionerContext | null;
  declare private readonly focusGuard: { returned: boolean };
  declare element: HTMLElement | null;

  constructor(
    props: MenuSubmenuTrigger.Props,
    context: MenuRootContext,
    contextMenu: ContextMenuRootContext | null,
    index: Accessor<number>,
    id: Accessor<string | undefined>,
    disabled: Accessor<boolean>,
    omitExpanded: Accessor<boolean>,
    hover: object | undefined,
    click: { reference?: object | undefined },
    positioner: MenuPositionerContext | null,
    focusGuard: { returned: boolean },
  ) {
    this.props = props;
    this.context = context;
    this.contextMenu = contextMenu;
    this.index = index;
    this.id = id;
    this.disabledAccessor = disabled;
    this.omitExpanded = omitExpanded;
    this.hover = hover;
    this.click = click;
    this.positioner = positioner;
    this.focusGuard = focusGuard;
    this.element = null;
  }

  /** The submenu's store. */
  get store(): MenuStore<any> {
    return this.context.store;
  }

  /** The parent menu's store: this trigger is one of its items. */
  get parentStore(): MenuStore<any> {
    return (this.context.parent as { store: MenuStore<any> }).store;
  }

  get disabled() {
    return this.disabledAccessor();
  }

  get highlighted() {
    return this.parentStore.select('isActive', this.index);
  }

  get open() {
    return this.store.select('open');
  }

  /** The submenu's trigger props, without the `id` the trigger writes itself. */
  triggerProps(): Record<string, unknown> {
    return this.store.select('triggerProps', ALWAYS) as Record<string, unknown>;
  }

  /**
   * Calls each source's handler for `key` in the slow path's `mergeProps` order below the
   * consumer's (the trigger's own, the parent's list navigation, the submenu's trigger props, hover,
   * click, the item's hover activation, then the item's common props) until one prevents the rest.
   */
  dispatch(key: string, event: TriggerEvent<Event>) {
    this.own(key, event);
    const sources = [
      this.parentStore.state.itemProps,
      this.triggerProps(),
      this.hover,
      this.click.reference,
    ];
    for (const source of sources) {
      if (event.baseUIHandlerPrevented) {
        return;
      }
      const handler = source ? readHandler(source, key) : undefined;
      if (handler) {
        handler(event);
      }
    }
    if (event.baseUIHandlerPrevented) {
      return;
    }
    if (key === 'onMouseEnter') {
      // `useMenuItem`'s hover activation for a submenu trigger.
      const parentStore = this.parentStore;
      if (parentStore.select('highlightItemOnHover')) {
        parentStore.setActiveIndex(this.index(), REASONS.pointer, event as unknown as MouseEvent);
      }
    }
    this.common(key, event);
  }

  /** The trigger's own handlers. */
  private own(key: string, event: Event) {
    if (key === 'onFocus') {
      // Close when focus returns through the submenu's guard to its trigger. This also lets screen
      // reader users move past the trigger in the parent menu. Direct focus from a submenu item,
      // such as on hover, leaves the submenu open.
      if (this.store.select('open') && this.focusGuard.returned) {
        this.focusGuard.returned = false;
        this.store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event as FocusEvent));
      }
    } else if (key === 'onBlur') {
      if (this.highlighted) {
        this.parentStore.setActiveIndex(null, REASONS.none);
      }
    }
  }

  /** `useMenuItemCommonProps`'s handlers for a submenu trigger (`closeOnClick` is false). */
  private common(key: string, event: Event) {
    if (key === 'onMouseDown') {
      // Real focus stays on the input or list that owns virtual navigation.
      if (this.context.parentVirtualFocus()) {
        event.preventDefault();
      }
    } else if (key === 'onKeyDown') {
      if ((event as KeyboardEvent).key === ' ' && this.parentStore.context.typingRef.current) {
        event.preventDefault();
      }
    } else if (key === 'onMouseMove') {
      const nodeId = this.positioner?.context.nodeId();
      if (nodeId) {
        // Inform the floating tree that a menu item within this menu was hovered/moved over so
        // unrelated descendant submenus can be closed.
        this.store.select('floatingTreeRoot').events.emit('itemhover', {
          nodeId,
          target: event.currentTarget,
        });
      }
    } else if (key === 'onMouseUp') {
      // A submenu trigger dispatches no click on mouseup; a context menu still consumes the
      // gesture's initial cursor point.
      const contextMenu = this.contextMenu;
      if (contextMenu) {
        const initialCursorPoint = contextMenu.initialCursorPointRef.current;
        contextMenu.initialCursorPointRef.current = null;
        if (
          initialCursorPoint &&
          Math.abs((event as MouseEvent).clientX - initialCursorPoint.x) <= 1 &&
          Math.abs((event as MouseEvent).clientY - initialCursorPoint.y) <= 1
        ) {
          return;
        }
        if (!platform.os.mac && (event as MouseEvent).button === 2) {
          return;
        }
      }
    }
  }
}

type Model = NativeSubmenuTriggerModel;

/** A disabled trigger cancels the event and runs no handler (`useButton`'s click and pointerdown). */
function preventWhileDisabled(trigger: Model, event: Event) {
  if (trigger.disabled) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (trigger: Model) => !trigger.disabled;

const dispatchSources = (key: string) => (trigger: Model, event: Event) =>
  trigger.dispatch(key, event as TriggerEvent<Event>);

/**
 * A native trigger's handlers, created once: `useButton`'s gates for a non-native composite item,
 * then the consumer's handler, then the trigger's sources. Every key any source handles is bound.
 */
const TRIGGER_HANDLERS: Readonly<Record<string, Dispatch<Model>>> = {
  onClick: partHandler('onClick', dispatchSources('onClick'), preventWhileDisabled),
  onKeyDown: partHandler<Model, KeyboardEvent>(
    'onKeyDown',
    (trigger, event) => {
      trigger.dispatch('onKeyDown', event);
      compositeItemKeyDownAfter(event, false);
    },
    (trigger, event) => {
      // `useFocusableWhenDisabled`: a disabled item keeps Tab and blocks every other key.
      if (trigger.disabled && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !trigger.disabled;
    },
  ),
  onKeyUp: partHandler('onKeyUp', dispatchSources('onKeyUp'), runWhileEnabled),
  onMouseDown: partHandler('onMouseDown', dispatchSources('onMouseDown'), runWhileEnabled),
  onPointerDown: partHandler(
    'onPointerDown',
    dispatchSources('onPointerDown'),
    preventWhileDisabled,
  ),
  onMouseEnter: partHandler('onMouseEnter', dispatchSources('onMouseEnter')),
  onMouseLeave: partHandler('onMouseLeave', dispatchSources('onMouseLeave')),
  onMouseMove: partHandler('onMouseMove', dispatchSources('onMouseMove')),
  onMouseUp: partHandler('onMouseUp', dispatchSources('onMouseUp')),
  onPointerEnter: partHandler('onPointerEnter', dispatchSources('onPointerEnter')),
  onPointerLeave: partHandler('onPointerLeave', dispatchSources('onPointerLeave')),
  onFocus: partHandler('onFocus', dispatchSources('onFocus')),
  onBlur: partHandler('onBlur', dispatchSources('onBlur')),
};

const writeTriggerState = compileStateWriter(
  ['disabled', 'highlighted', 'open'],
  triggerOpenStateMapping,
);

/**
 * The trigger's attributes below the consumer's, in the slow path's source order (a later write
 * wins): the button's and the item's, the submenu's trigger props, then the trigger's own.
 */
function writeTriggerAttributes(w: SetAttribute, trigger: Model) {
  const { context } = trigger;
  const highlighted = trigger.highlighted;
  const disabled = trigger.disabled;
  // `useFocusableWhenDisabled` for a non-native composite item.
  w.set('aria-disabled', disabled ? 'true' : undefined);
  w.set('id', trigger.id());
  w.set(
    'aria-selected',
    trigger.parentStore.select('webkitAriaSelected', () => highlighted) ? 'true' : undefined,
  );
  const props = trigger.triggerProps();
  // VoiceOver announces the expanded state instead of the submenu's first item while focus moves
  // into it, so the keyboard-opened submenu's trigger drops it (`aria-haspopup` stays).
  const omitExpanded = trigger.omitExpanded();
  for (const key in props) {
    if (key !== 'id' && !isHandlerKey(key) && !(omitExpanded && key === 'aria-expanded')) {
      w.set(key, props[key]);
    }
  }
  w.set('aria-controls', trigger.store.select('triggerPopupId', trigger.id));
  // A virtually focused parent keeps real focus on its input, so the trigger stays out of the tab
  // order.
  w.set(
    'tabindex',
    context.parentVirtualFocus() || !(trigger.store.select('open') || highlighted) ? -1 : 0,
  );
}

const triggerState = (trigger: Model) => trigger;

/** Renders the native trigger element for `props` over `model`. */
export function renderNativeSubmenuTrigger(
  props: MenuSubmenuTrigger.Props,
  model: NativeSubmenuTriggerModel,
  refs: readonly ((node: HTMLElement | null | undefined) => void)[],
): JSX.Element {
  const el = (<div />) as unknown as HTMLDivElement;
  return renderNativeElement(el, props, {
    own: OWN_KEYS,
    state: triggerState,
    stateWriter: writeTriggerState,
    stateView: model,
    reactive: true,
    literal: MENU_ITEM,
    attributes: writeTriggerAttributes,
    handlers: TRIGGER_HANDLERS,
    handlerTarget: model,
    refs: [
      ...refs,
      (node: HTMLElement | null) => {
        model.element = node;
      },
    ],
  }) as unknown as JSX.Element;
}
