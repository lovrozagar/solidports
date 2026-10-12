import { children, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createLayoutEffect } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useEnhancedClickHandler } from '../../utils/useEnhancedClickHandler';
import { isVirtualPointerEvent } from '../../floating-ui-solid/utils/event';
import { useFilterDropdownItem } from '../../filter-dropdown/item/useFilterDropdownItem';
import { useFilterContextForList } from '../../filter-dropdown/root/FilterDropdownRootContext';
import type { ReactLikeRef } from '../../solid-helpers';
import type { HTMLProps } from '../../utils/types';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuFilterItemParams, MenuFilterItemResult } from './MenuFilterContext';

/**
 * Registers a submenu trigger with the parent menu's filter and adapts it to a filterable submenu.
 */
export function useMenuFilterSubmenuTrigger(params: MenuFilterItemParams): MenuFilterItemResult {
  const { store, virtualFocus } = useMenuRootContext();
  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const parent = store.useState('parent');

  const parentListRef = untrack(() => {
    const current = parent();
    return current.type === 'menu' ? current.store.context.itemDomElements : null;
  });
  const parentContext = useFilterContextForList(
    parentListRef as ReactLikeRef<Array<HTMLElement | null>> | null,
  );

  // Resolved once in the trigger's owner, as filtered items do.
  const resolvedChildren = children(() => params.children as JSX.Element);
  const item = useFilterDropdownItem({
    // One read each: reading JSX children creates them.
    get label() {
      const label = params.label;
      return typeof label === 'function' ? label() : label;
    },
    get children() {
      return resolvedChildren();
    },
    get render() {
      return params.render;
    },
    context: parentContext,
    get retainGroup() {
      return mounted();
    },
  });

  createLayoutEffect(
    () => ({ visible: item.visible(), open: open() }),
    (state) => {
      if (state.visible || !state.open) {
        return;
      }
      store.setOpen(false, createChangeEventDetails(REASONS.none));
    },
  );

  const clickProps = useEnhancedClickHandler((event, interactionType) => {
    if (
      event.type === 'click' &&
      store.select('open') &&
      (interactionType === 'keyboard' ||
        (interactionType === 'mouse' &&
          store.select('lastOpenChangeReason') === REASONS.triggerPress))
    ) {
      store.context.virtualFocusRef?.current?.focus({ preventScroll: true });
    }
  });

  const props: HTMLProps = {
    ...(untrack(virtualFocus) ? { 'aria-haspopup': 'dialog' as const } : undefined),
    ...clickProps,
    onPointerDown(event: PointerEvent) {
      clickProps.onPointerDown(event);
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onFocus(event: FocusEvent & { preventBaseUIHandler?: () => void }) {
      const focusOwner = store.context.virtualFocusRef?.current;
      if (focusOwner && store.select('open') && event.relatedTarget === focusOwner) {
        event.preventBaseUIHandler?.();
        focusOwner.focus({ preventScroll: true });
      }
    },
  };

  if (parentContext === null) {
    return { visible: () => true, ref: null, props };
  }

  return {
    visible: () => item.visible() || mounted(),
    ref: item.ref,
    props,
    children: resolvedChildren,
  };
}
