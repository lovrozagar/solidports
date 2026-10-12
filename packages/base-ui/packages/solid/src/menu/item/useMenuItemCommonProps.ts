/* eslint-disable typescript/no-explicit-any -- the store's payload type is erased for shared item logic, as in the React port */
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { type ReactLikeRef } from '../../solid-helpers';
import { isMac } from '../../utils/detectBrowser';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { REASONS } from '../../utils/reasons';
import { HTMLProps } from '../../utils/types';
import { MenuStore } from '../store/MenuStore';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { UseMenuItemMetadata } from './useMenuItem';

function preventMouseDownDefault(event: MouseEvent) {
  event.preventDefault();
}

export interface UseMenuItemCommonPropsParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: boolean;
  /**
   * The id of the menu item.
   */
  id: string | undefined;
  /**
   * The node id of the menu positioner.
   */
  nodeId: string | undefined;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   */
  typingRef?: ReactLikeRef<boolean> | undefined;
  /**
   * Ref to the item element.
   */
  itemRef: ReactLikeRef<HTMLElement | null | undefined>;
  /**
   * Metadata for checking item type before triggering click.
   */
  itemMetadata: UseMenuItemMetadata;
}

/**
 * Returns common props shared by all menu item types.
 * This hook extracts the shared logic for id, role, tabIndex, and interaction handlers.
 *
 * Solid: `params` is read through getters, so the returned props stay live.
 */
export function useMenuItemCommonProps(params: UseMenuItemCommonPropsParameters): HTMLProps {
  const rootContext = useMenuRootContext();
  const contextMenuContext = useContextMenuRootContext(true);

  // A submenu trigger is an item of the parent menu's list, so it follows that list's focus model.
  // The item type is fixed for the item's lifetime.
  const isSubmenuTrigger = params.itemMetadata.type === 'submenu-trigger';
  const virtualFocus = isSubmenuTrigger ? rootContext.parentVirtualFocus : rootContext.virtualFocus;
  const parent = rootContext.parent;
  const selectionStore =
    isSubmenuTrigger && parent.type === 'menu' ? parent.store : rootContext.store;
  const ariaSelected = selectionStore.useState('webkitAriaSelected', () => params.highlighted);

  const floatingTreeRoot = params.store.useState('floatingTreeRoot');
  const open = params.store.useState('open');

  const isContextMenu = contextMenuContext != null;

  return {
    get id() {
      return params.id;
    },
    role: 'menuitem',
    // `-1` rather than omitting it, which leaves links and buttons in the tab order.
    get tabindex() {
      return !virtualFocus() && open() && params.highlighted ? 0 : -1;
    },
    get 'aria-selected'() {
      return ariaSelected() ? ('true' as const) : undefined;
    },
    // Real focus stays on the input or list that owns virtual navigation.
    get onMouseDown() {
      return virtualFocus() ? preventMouseDownDefault : undefined;
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === ' ' && params.typingRef?.current) {
        event.preventDefault();
      }
    },
    onMouseMove(event: MouseEvent) {
      const nodeId = params.nodeId;
      if (!nodeId) {
        return;
      }

      // Inform the floating tree that a menu item within this menu was hovered/moved over
      // so unrelated descendant submenus can be closed.
      floatingTreeRoot().events.emit('itemhover', {
        nodeId,
        target: event.currentTarget,
      });
    },
    onClick(event: MouseEvent) {
      if (params.closeOnClick) {
        floatingTreeRoot().events.emit('close', { domEvent: event, reason: REASONS.itemPress });
      }
    },
    onMouseUp(event: MouseEvent) {
      if (contextMenuContext) {
        const initialCursorPoint = contextMenuContext.initialCursorPointRef.current;
        contextMenuContext.initialCursorPointRef.current = null;
        if (
          isContextMenu &&
          initialCursorPoint &&
          Math.abs(event.clientX - initialCursorPoint.x) <= 1 &&
          Math.abs(event.clientY - initialCursorPoint.y) <= 1
        ) {
          return;
        }

        // On non-macOS platforms, this mouseup belongs to the right-click gesture
        // that opened the context menu, so it must not activate an item.
        // Solid: React reads `platform.os.mac`.
        if (isContextMenu && !isMac && event.button === 2) {
          return;
        }
      }

      const itemElement = params.itemRef.current;
      if (
        itemElement &&
        params.store.context.allowMouseUpTriggerRef.current &&
        (!isContextMenu || event.button === 2)
      ) {
        // This fires whenever the user clicks on the trigger, moves the cursor, and releases it over the item.
        // We trigger the click and override the `closeOnClick` preference to always close the menu.
        if (params.itemMetadata.type === 'regular-item') {
          // `detail: 1` and `pointerType: 'mouse'` mark this as a mouse-gesture click so
          // MenuRoot and FloatingFocusManager don't treat it as a keyboard activation.
          dispatchClickWithModifiers(itemElement, event, {
            detail: 1,
            pointerType: 'mouse',
          });
        }
      }
    },
  };
}

export namespace useMenuItemCommonProps {
  export type Parameters = UseMenuItemCommonPropsParameters;
}
