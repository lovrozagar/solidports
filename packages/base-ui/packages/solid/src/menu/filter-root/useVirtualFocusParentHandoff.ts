import type { Accessor } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../utils/owner';
import { activeElement, contains } from '../../utils/shadowDom';
import { createLayoutEffect } from '../../solid-helpers';
import { REASONS } from '../../utils/reasons';
import type { MenuParent } from '../root/MenuRoot';
import type { MenuStore } from '../store/MenuStore';
import type { MenuFilterParentHandoff } from './MenuFilterContext';

/**
 * A plain submenu whose parent is filterable. The parent keeps real focus on its input, so its
 * trigger never blurs and its return focus waits for this popup's exit animation. The submenu
 * hands focus and the parent's highlight back itself.
 */
export function useVirtualFocusParentHandoff(
  store: MenuStore<unknown>,
  parent: Accessor<MenuParent>,
  open: Accessor<boolean>,
  virtualFocus: Accessor<boolean>,
): MenuFilterParentHandoff {
  const parentStore = () => {
    const current = parent();
    return current.type === 'menu' ? current.store : null;
  };
  const parentVirtualFocusRef = parentStore()?.context.virtualFocusRef;

  const returnToParent = (trigger: Element | null | undefined, reason: string | null) => {
    const focusOwner = parentVirtualFocusRef?.current;
    const currentParent = parentStore();
    if (virtualFocus() || store.select('open') || !currentParent?.select('open') || !focusOwner) {
      return;
    }

    if (
      contains(
        store.context.popupRef.current ?? null,
        activeElement(ownerDocument(focusOwner)) ?? null,
      )
    ) {
      focusOwner.focus({ preventScroll: true });
    }

    if (
      (reason === REASONS.listNavigation || reason === REASONS.escapeKey) &&
      currentParent.state.activeIndex == null
    ) {
      currentParent.highlightItem(trigger, REASONS.none);
    }
  };

  createLayoutEffect(open, (isOpen) => {
    if (!isOpen) {
      const trigger = store.state.activeTriggerElement;
      const reason = store.select('lastOpenChangeReason');
      queueMicrotask(() => returnToParent(trigger, reason));
    }
  });

  function handleFocus() {
    const currentParent = parentStore();
    if (!virtualFocus() && parentVirtualFocusRef && currentParent?.state.activeIndex != null) {
      currentParent.setActiveIndex(null, REASONS.none);
    }
  }

  return { parentVirtualFocusRef, handleFocus };
}

export function useNoParentHandoff(): MenuFilterParentHandoff {
  return { parentVirtualFocusRef: undefined, handleFocus: undefined };
}
