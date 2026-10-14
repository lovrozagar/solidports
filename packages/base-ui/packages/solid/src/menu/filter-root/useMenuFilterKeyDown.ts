import type { Accessor } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerWindow } from '../../utils/owner';
import { EMPTY_ARRAY } from '../../utils/empty';
import { useDirection } from '../../direction-provider/DirectionContext';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { stopEvent, isCompositionKeyDown } from '../../floating-ui-solid/utils/event';
import { getMaxListIndex, getMinListIndex } from '../../floating-ui-solid/utils/composite';
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from '../../floating-ui-solid/hooks/useListNavigation';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import type { MenuRoot } from '../root/MenuRoot';

export type MenuFilterKeyAction =
  /** Native text editing in the input; list navigation and parent handlers stay out of it. */
  | 'edit'
  /** The menu's list navigation handles the key. */
  | 'navigate'
  /** A horizontal list is entered from the input with a vertical arrow. */
  | 'enter-list'
  /** The highlighted item handles the key, which opens or closes its submenu. */
  | 'submenu'
  /** The highlighted item is activated. */
  | 'activate'
  /** The popup closes and focus returns to where it came from. */
  | 'close'
  /** The key belongs to an IME composition or leaves the popup (Tab). */
  | 'ignore';

export interface MenuFilterKeyContext {
  orientation: MenuRoot.Orientation;
  rtl: boolean;
  /** Whether an item is highlighted. */
  hasActiveItem: boolean;
  /** Whether the highlighted item opens a submenu. */
  activeItemOpensSubmenu: boolean;
  /** Whether the input has text. */
  hasValue: boolean;
}

/**
 * Decides what a key does while the filter input owns the keyboard.
 */
export function getMenuFilterKeyAction(
  event: KeyboardEvent,
  context: MenuFilterKeyContext,
): MenuFilterKeyAction {
  const { orientation, rtl, hasActiveItem, activeItemOpensSubmenu, hasValue } = context;
  const { key } = event;
  // Enter that commits an IME composition belongs to the input, not the list.
  if (isCompositionKeyDown(event)) {
    return 'ignore';
  }
  if (key === 'Tab') {
    return event.shiftKey ? 'close' : 'ignore';
  }
  if (key === 'Enter') {
    return hasActiveItem ? 'activate' : 'navigate';
  }

  const isArrow = key.startsWith('Arrow');
  const isBoundary = key === 'Home' || key === 'End';

  // Modified arrows and boundary keys are text-editing commands.
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    return isArrow || isBoundary || key.length === 1 ? 'edit' : 'navigate';
  }
  if (key.length === 1) {
    return 'edit';
  }
  if (isBoundary) {
    return hasActiveItem && !hasValue ? 'navigate' : 'edit';
  }
  if (!isArrow) {
    return 'navigate';
  }

  if (isMainOrientationKey(key, orientation)) {
    return orientation === 'horizontal' && !hasActiveItem && hasValue ? 'edit' : 'navigate';
  }

  if (
    activeItemOpensSubmenu &&
    (isCrossOrientationOpenKey(key, orientation, rtl) ||
      isCrossOrientationCloseKey(key, orientation, rtl, false))
  ) {
    return 'submenu';
  }
  if (orientation === 'horizontal' && !hasActiveItem) {
    return 'enter-list';
  }
  return hasValue ? 'edit' : 'navigate';
}

/**
 * Routes keys for a filterable menu's input, which holds real focus while the list is navigated
 * with `aria-activedescendant`. Keys reaching the input, and those an item that received real
 * focus from assistive technology hands back, go through here; the trigger relays only the
 * vertical arrows while the popup is open. Navigation runs the menu's own `useListNavigation`
 * handler directly.
 */
export function useMenuFilterKeyDown(hasValue: Accessor<boolean>) {
  const { orientation, store } = useMenuRootContext();
  const submenuContext = useMenuSubmenuRootContext();
  const direction = useDirection();

  return (event: KeyboardEvent) => {
    if (!store.select('open')) {
      return;
    }
    const activeItem = store.select('highlightedItem') as HTMLElement | undefined;
    const action = getMenuFilterKeyAction(event, {
      orientation: orientation(),
      rtl: direction() === 'rtl',
      hasActiveItem: activeItem != null,
      activeItemOpensSubmenu: activeItem?.hasAttribute('aria-haspopup') ?? false,
      hasValue: hasValue(),
    });

    switch (action) {
      case 'edit':
        event.stopPropagation();
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const handleKeyDown = store.select('inputProps').onKeyDown;
          if (typeof handleKeyDown === 'function') {
            handleKeyDown(event as never);
          }
        }
        break;
      case 'navigate': {
        if (isMainOrientationKey(event.key, orientation())) {
          event.stopPropagation();
        }
        const handleKeyDown = store.select('inputProps').onKeyDown;
        if (typeof handleKeyDown === 'function') {
          handleKeyDown(event as never);
        }
        break;
      }
      case 'enter-list': {
        event.stopPropagation();
        const items = store.context.itemDomElements.current;
        const index =
          event.key === 'ArrowDown'
            ? getMinListIndex(items, EMPTY_ARRAY)
            : getMaxListIndex(items, EMPTY_ARRAY);
        if (items[index]) {
          event.preventDefault();
          store.setActiveIndex(index, REASONS.keyboard, event);
        }
        break;
      }
      case 'submenu': {
        stopEvent(event);
        const KeyboardEventConstructor = ownerWindow(activeItem).KeyboardEvent;
        activeItem!.dispatchEvent(new KeyboardEventConstructor(event.type, event));
        break;
      }
      case 'activate':
        event.preventDefault();
        dispatchClickWithModifiers(activeItem!, event);
        break;
      case 'close': {
        stopEvent(event);
        const returnElement =
          (store.select('parent').type === 'menu' && submenuContext?.getReturnElement?.()) ||
          store.select('activeTriggerElement');
        const details = createChangeEventDetails(REASONS.focusOut, event);
        store.setOpen(false, details);
        if (!details.isCanceled && isHTMLElement(returnElement)) {
          returnElement.focus();
        }
        break;
      }
      default:
        break;
    }
  };
}
