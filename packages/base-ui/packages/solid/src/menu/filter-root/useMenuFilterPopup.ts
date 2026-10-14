import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { createEffect } from 'solid-js';
import { useDirection } from '../../direction-provider/DirectionContext';
import { ownerDocument } from '../../utils/owner';
import { warn } from '../../utils/warn';
import { activeElement, contains, getTarget } from '../../utils/shadowDom';
import { isTypeableElement } from '../../floating-ui-solid/utils/element';
import { isCrossOrientationCloseKey } from '../../floating-ui-solid/hooks/useListNavigation';
import { useRef } from '../../solid-helpers';
import { useFilterDropdownRootContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { isRefocusingOwner, refocusOwner } from '../../filter-dropdown/utils/refocusOwner';
import type { MenuRoot } from '../root/MenuRoot';
import type { HTMLProps } from '../../utils/types';

export function useMenuFilterPopup(orientation: () => MenuRoot.Orientation): HTMLProps {
  const context = useFilterDropdownRootContext();
  const direction = useDirection();
  const { focusOwnerRef } = context;
  const nestedFocusRef = useRef<Element | null>(null);
  const pointerTypeRef = useRef('mouse');

  if (process.env.NODE_ENV !== 'production') {
    // A user effect runs after the pass that mounts the popup's children, so the input's ref is
    // assigned by then, as after React's commit.
    createEffect(
      () => context.open(),
      (open) => {
        if (open && focusOwnerRef.current === null) {
          warn(
            'A filterable menu opened without a <Menu.Input>. Render the input inside ' +
              '<Menu.Popup>, or drop <Menu.FilterProvider> for a menu that does not filter.',
          );
        }
      },
    );
  }

  function trackPointerType(event: PointerEvent) {
    pointerTypeRef.current = event.pointerType || 'mouse';
  }

  function restoreInputFocus(event: MouseEvent, enteredTrigger: boolean) {
    const focusOwner = focusOwnerRef.current;
    const currentTarget = event.currentTarget as HTMLDivElement;
    if (!context.open() || !focusOwner) {
      return;
    }

    const activeEl = activeElement(ownerDocument(currentTarget));
    if (activeEl === focusOwner || contains(currentTarget, activeEl)) {
      return;
    }

    let submenuTrigger: HTMLElement | null = null;
    const nearestPopup = event.composedPath().find((node) => {
      if (!isHTMLElement(node)) {
        return false;
      }
      if (node.getAttribute('role') === 'dialog' || node.hasAttribute('data-rootownerid')) {
        return true;
      }
      if (node.hasAttribute('aria-haspopup')) {
        submenuTrigger = node;
      }
      return false;
    });
    if (nearestPopup !== currentTarget) {
      return;
    }

    if (nestedFocusRef.current && !(enteredTrigger && submenuTrigger)) {
      return;
    }
    if (
      enteredTrigger &&
      submenuTrigger &&
      isElement(event.relatedTarget) &&
      contains(submenuTrigger, event.relatedTarget)
    ) {
      return;
    }
    refocusOwner(focusOwner);
  }

  return {
    'aria-activedescendant': undefined,
    'aria-orientation': undefined,
    onMouseDown(event: MouseEvent) {
      if (getTarget(event) === event.currentTarget) {
        event.preventDefault();
      }
    },
    onPointerDown: trackPointerType,
    onPointerOver: trackPointerType,
    onPointerMove: trackPointerType,
    onMouseMove(event: MouseEvent) {
      if (pointerTypeRef.current === 'mouse') {
        restoreInputFocus(event, false);
      }
    },
    onMouseOver(event: MouseEvent) {
      if (pointerTypeRef.current === 'mouse' && nestedFocusRef.current) {
        restoreInputFocus(event, true);
      }
    },
    // Solid: React's `onFocus` is `focusin`, which also sees the input and nested popups' focus.
    onFocusIn(event: FocusEvent) {
      const target = getTarget(event);
      const currentTarget = event.currentTarget as HTMLElement;
      if (target === focusOwnerRef.current) {
        nestedFocusRef.current = null;
      } else if (
        isHTMLElement(target) &&
        !contains(currentTarget, target) &&
        !isRefocusingOwner()
      ) {
        nestedFocusRef.current = target;
      }

      if (context.open() && target === currentTarget) {
        focusOwnerRef.current?.focus({ preventScroll: true });
      }
    },
    onKeyDown(event: KeyboardEvent) {
      const target = getTarget(event);
      if (target === focusOwnerRef.current || isTypeableElement(target)) {
        return;
      }

      if (isCrossOrientationCloseKey(event.key, orientation(), direction() === 'rtl', false)) {
        focusOwnerRef.current?.focus({ preventScroll: true });
        event.stopPropagation();
      }
    },
  };
}
