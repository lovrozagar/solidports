import { createEffect, onCleanup, untrack } from 'solid-js';
import { contains, getTarget, stopEvent } from '../../floating-ui-solid/utils';
import { useMenuRootContext } from '../../menu/root/MenuRootContext';
import { findRootOwnerId } from '../../menu/utils/findRootOwnerId';
import { splitComponentProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { addEventListener } from '../../utils/addEventListener';
import { ownerDocument } from '../../utils/owner';
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { useContextMenuRootContext } from '../root/ContextMenuRootContext';

const LONG_PRESS_DELAY = 500;

/**
 * An area that opens the menu on right click or long press.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Context Menu](https://base-ui.com/react/components/context-menu)
 */
export function ContextMenuTrigger(componentProps: ContextMenuTrigger.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const {
    setAnchor,
    backdropRef,
    internalBackdropRef,
    actionsRef,
    positionerRef,
    allowMouseUpTriggerRef,
    initialCursorPointRef,
    rootId,
  } = useContextMenuRootContext(false);

  const { store } = useMenuRootContext(false);
  const open = store.useState('open');
  const disabled = store.useState('disabled');

  let triggerRef = null as HTMLDivElement | null | undefined;
  let touchPositionRef = null as { x: number; y: number } | null;
  const longPressTimeout = useTimeout();
  const allowMouseUpTimeout = useTimeout();
  let allowMouseUpRef = false;
  let mouseUpAbortControllerRef = null as AbortController | null;

  function handleLongPress(x: number, y: number, event: MouseEvent | TouchEvent) {
    const isTouchEvent = event.type.startsWith('touch');

    initialCursorPointRef.current = { x, y };

    setAnchor({
      getBoundingClientRect() {
        return DOMRect.fromRect({
          width: isTouchEvent ? 10 : 0,
          height: isTouchEvent ? 10 : 0,
          x,
          y,
        });
      },
    });

    allowMouseUpRef = false;
    actionsRef.current?.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));

    allowMouseUpTimeout.start(LONG_PRESS_DELAY, () => {
      allowMouseUpRef = true;
    });
  }

  function handleContextMenu(event: MouseEvent) {
    if (untrack(disabled)) {
      return;
    }
    allowMouseUpTriggerRef.current = true;
    stopEvent(event);
    handleLongPress(event.clientX, event.clientY, event);
    const doc = ownerDocument(triggerRef ?? null);

    // Abort a listener from a previous trigger that never saw its mouseup, and scope this
    // one to a fresh controller so it's removed on unmount if the mouseup never arrives.
    mouseUpAbortControllerRef?.abort();
    const mouseUpAbortController = new AbortController();
    mouseUpAbortControllerRef = mouseUpAbortController;
    doc.addEventListener(
      'mouseup',
      (mouseEvent: MouseEvent) => {
        allowMouseUpTriggerRef.current = false;

        if (!allowMouseUpRef) {
          return;
        }

        allowMouseUpTimeout.clear();
        allowMouseUpRef = false;

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;

        if (contains(positionerRef.current, mouseUpTarget)) {
          return;
        }

        const currentRootId = untrack(rootId);
        if (currentRootId && mouseUpTarget && findRootOwnerId(mouseUpTarget) === currentRootId) {
          return;
        }

        actionsRef.current?.setOpen(
          false,
          createChangeEventDetails(REASONS.cancelOpen, mouseEvent),
        );
      },
      { once: true, signal: mouseUpAbortController.signal },
    );
  }

  function cancelLongPress() {
    longPressTimeout.clear();
    touchPositionRef = null;
  }

  function handleTouchStart(event: TouchEvent) {
    if (untrack(disabled)) {
      cancelLongPress();
      return;
    }
    allowMouseUpTriggerRef.current = false;
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }

    event.stopPropagation();
    const touch = event.touches[0];
    const touchPosition = { x: touch.clientX, y: touch.clientY };
    touchPositionRef = touchPosition;
    longPressTimeout.start(LONG_PRESS_DELAY, () => {
      handleLongPress(touchPosition.x, touchPosition.y, event);
    });
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }

    if (longPressTimeout.isStarted() && touchPositionRef) {
      const touch = event.touches[0];
      const moveThreshold = 10;

      const deltaX = Math.abs(touch.clientX - touchPositionRef.x);
      const deltaY = Math.abs(touch.clientY - touchPositionRef.y);

      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        cancelLongPress();
      }
    }
  }

  onCleanup(() => {
    // Abort a pending mouseup listener if the trigger unmounts before it fires.
    mouseUpAbortControllerRef?.abort();
  });

  createEffect(disabled, (isDisabled) => {
    function handleDocumentContextMenu(event: MouseEvent) {
      if (isDisabled) {
        return;
      }

      const target = getTarget(event);
      const targetElement = target as HTMLElement | null;
      if (
        contains(triggerRef, targetElement) ||
        contains(internalBackdropRef.current, targetElement) ||
        contains(backdropRef.current, targetElement)
      ) {
        event.preventDefault();
      }
    }

    const doc = ownerDocument(triggerRef ?? null);
    return addEventListener(doc, 'contextmenu', handleDocumentContextMenu);
  });

  const state: ContextMenuTrigger.State = {
    get open() {
      return open();
    },
  };

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        onContextMenu: handleContextMenu,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: cancelLongPress,
        onTouchCancel: cancelLongPress,
        style: {
          '-webkit-touch-callout': 'none',
        },
      },
      elementProps,
    ],
    ref: (el) => {
      triggerRef = el;
    },
    state,
    stateAttributesMapping: pressableTriggerOpenStateMapping,
  });

  return <>{element()}</>;
}

export type ContextMenuTriggerState = {
  /**
   * Whether the context menu is currently open.
   */
  open: boolean;
};

export interface ContextMenuTriggerProps extends BaseUIComponentProps<
  'div',
  ContextMenuTrigger.State
> {}

export namespace ContextMenuTrigger {
  export type State = ContextMenuTriggerState;
  export type Props = ContextMenuTriggerProps;
}
