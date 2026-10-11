import type { JSX } from '@solidjs/web';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { useDirection } from '../../direction-provider/DirectionContext';
import { createLayoutEffect, useRef } from '../../solid-helpers';
import { activeElement, contains } from '../../utils/shadowDom';
import { ownerDocument } from '../../utils/owner';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { stopEvent } from '../../floating-ui-solid/utils/event';
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from '../../floating-ui-solid/hooks/useListNavigation';
import { MenuRootInternal } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuSubmenuRoot } from '../submenu-root/MenuSubmenuRoot';
import type { MenuSubmenuRootProps } from '../submenu-root/MenuSubmenuRoot';
import { MenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import { MenuFilterDropdown } from '../filter-root/MenuFilterDropdown';
import { useMenuFilterRoot } from '../filter-root/useMenuFilterRoot';
import { moveHighlightFrom } from '../filter-root/moveHighlightFrom';
import { isKeyboardOpen } from '../utils/isKeyboardOpen';
import type { MenuStore } from '../store/MenuStore';

type ParentReference = { reference: HTMLElement; trigger: HTMLElement };

/**
 * The filterable implementation of `Menu.SubmenuRoot`.
 */
export function MenuFilterSubmenuRoot(props: MenuFilterSubmenuRootProps): JSX.Element {
  const parent = useMenuRootContext();
  const parentStore = parent.store;
  const parentDisabled = parentStore.useState('disabled');
  const filter = useMenuFilterRoot(props);
  const parentReferenceRef = useRef<ParentReference | null>(null);

  function handleSubmenuEnter(trigger: HTMLElement, event: KeyboardEvent | undefined) {
    const focusedElement = parent.virtualFocus()
      ? parentStore.context.virtualFocusRef?.current
      : activeElement(ownerDocument(trigger));

    if (isHTMLElement(focusedElement)) {
      parentReferenceRef.current = { reference: focusedElement, trigger };
      parentStore.setActiveIndex(null, event ? REASONS.keyboard : REASONS.none, event);
    }
  }

  function highlightTrigger(trigger: HTMLElement, event: KeyboardEvent) {
    parentStore.highlightItem(trigger, REASONS.keyboard, event);
  }

  function handleSubmenuExit(event: KeyboardEvent) {
    const parentReference = parentReferenceRef.current;
    if (!parentReference) {
      return;
    }
    parentReference.reference.focus({ preventScroll: true });
    highlightTrigger(parentReference.trigger, event);
  }

  function handleOpenChange(nextOpen: boolean, details: MenuSubmenuRoot.ChangeEventDetails) {
    props.onOpenChange?.(nextOpen, details);
    if (details.isCanceled) {
      return;
    }

    if (!nextOpen) {
      if (details.reason === REASONS.escapeKey && isHTMLElement(details.trigger)) {
        highlightTrigger(details.trigger, details.event as KeyboardEvent);
        parentReferenceRef.current = {
          reference: parent.virtualFocus()
            ? (parentStore.context.virtualFocusRef?.current ?? details.trigger)
            : details.trigger,
          trigger: details.trigger,
        };
      }
      return;
    }

    parentReferenceRef.current = null;
    if (isHTMLElement(details.trigger) && isKeyboardOpen(details.reason, details.event)) {
      handleSubmenuEnter(
        details.trigger,
        details.reason === REASONS.listNavigation ? (details.event as KeyboardEvent) : undefined,
      );
    }
  }

  return (
    <MenuSubmenuRootContext value={{ parentMenu: parentStore }}>
      <MenuRootInternal
        {...props}
        virtualFocus
        virtualFocusRef={filter.virtualFocusRef}
        allowEscape={filter.allowEscape}
        resetOnPointerLeave={filter.resetOnPointerLeave}
        disabled={parentDisabled() || props.disabled}
        onOpenChange={handleOpenChange}
      >
        {(payload) => (
          <MenuFilterSubmenuNavigation
            parentStore={parentStore}
            parentVirtualFocus={parent.virtualFocus}
            parentAllowEscape={() => parent.virtualFocus() && parent.allowEscape()}
            parentOrientation={parent.orientation}
            parentLoopFocus={parent.loopFocus}
            getReturnElement={() =>
              parentReferenceRef.current?.reference ??
              (parent.virtualFocus() ? parentStore.context.virtualFocusRef?.current : null) ??
              null
            }
            onSubmenuEnter={handleSubmenuEnter}
            onSubmenuExit={handleSubmenuExit}
          >
            <MenuFilterDropdown
              value={filter.value}
              defaultValue={filter.defaultValue}
              onValueChange={filter.onValueChange}
              filter={filter.filter}
              autoHighlight={filter.autoHighlight}
              locale={filter.locale}
            >
              {typeof props.children === 'function'
                ? (props.children as (payload: unknown) => JSX.Element)(payload)
                : props.children}
            </MenuFilterDropdown>
          </MenuFilterSubmenuNavigation>
        )}
      </MenuRootInternal>
    </MenuSubmenuRootContext>
  );
}

function MenuFilterSubmenuNavigation(props: {
  children: JSX.Element;
  parentStore: MenuStore<unknown>;
  parentVirtualFocus: () => boolean;
  parentAllowEscape: () => boolean;
  parentOrientation: () => 'horizontal' | 'vertical';
  parentLoopFocus: () => boolean;
  onSubmenuEnter: (trigger: HTMLElement, event: KeyboardEvent) => void;
  onSubmenuExit: (event: KeyboardEvent) => void;
  getReturnElement: () => HTMLElement | null;
}) {
  const { store, orientation } = useMenuRootContext();
  const direction = useDirection();
  const mounted = store.useState('mounted');
  const wasMounted = useRef(false);

  const handleReturnFocus = () => {
    const [ownTrigger] = store.context.triggerElements.elements();
    return props.getReturnElement() ?? (isHTMLElement(ownTrigger) ? ownTrigger : null);
  };

  createLayoutEffect(mounted, (isMounted) => {
    const previous = wasMounted.current;
    wasMounted.current = isMounted;
    if (isMounted || !previous) {
      return;
    }
    const returnElement = handleReturnFocus();
    if (!returnElement || !props.parentStore.select('open')) {
      return;
    }
    const doc = ownerDocument(returnElement);
    const activeEl = activeElement(doc);
    if (activeEl === doc.body || contains(store.select('popupElement'), activeEl)) {
      returnElement.focus({ preventScroll: true });
    }
  });

  function moveInParent(from: HTMLElement, event: KeyboardEvent) {
    const item = moveHighlightFrom(props.parentStore, from, event, {
      orientation: props.parentOrientation(),
      rtl: direction() === 'rtl',
      loopFocus: props.parentLoopFocus(),
      allowEscape: props.parentAllowEscape(),
    });
    if (!props.parentVirtualFocus()) {
      item?.focus({ preventScroll: true });
    }
  }

  function close(event: KeyboardEvent) {
    if (!store.select('open')) {
      return;
    }
    stopEvent(event);
    const trigger = store.select('activeTriggerElement');
    const eventDetails = createChangeEventDetails(
      REASONS.listNavigation,
      event,
      isHTMLElement(trigger) ? trigger : undefined,
    );
    store.setOpen(false, eventDetails);
    if (!eventDetails.isCanceled) {
      props.onSubmenuExit(event);
    }
    const returnElement = props.getReturnElement() ?? store.select('activeTriggerElement');
    if (
      !store.select('open') &&
      isHTMLElement(returnElement) &&
      activeElement(ownerDocument(returnElement)) !== returnElement
    ) {
      returnElement.focus();
    }
    if (
      !store.select('open') &&
      isHTMLElement(trigger) &&
      isMainOrientationKey(event.key, props.parentOrientation())
    ) {
      moveInParent(trigger, event);
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent) {
    const currentTarget = event.currentTarget as HTMLElement;
    if (isMainOrientationKey(event.key, props.parentOrientation())) {
      moveInParent(currentTarget, event);
      (event as KeyboardEvent & { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();
      stopEvent(event);
      return;
    }

    const open = store.select('open');
    const isRtl = direction() === 'rtl';
    if (open && isCrossOrientationCloseKey(event.key, orientation(), isRtl, false)) {
      close(event);
      return;
    }
    if (!isCrossOrientationOpenKey(event.key, props.parentOrientation(), isRtl)) {
      return;
    }
    stopEvent(event);
    if (open) {
      props.onSubmenuEnter(currentTarget, event);
      store.context.virtualFocusRef?.current?.focus({ preventScroll: true });
      return;
    }
    store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, currentTarget));
  }

  function handlePopupKeyDown(event: KeyboardEvent) {
    if (event.which === 229) {
      return;
    }
    if (isCrossOrientationCloseKey(event.key, orientation(), direction() === 'rtl', false)) {
      close(event);
    }
  }

  return (
    <MenuSubmenuRootContext
      value={{
        parentMenu: props.parentStore,
        getReturnElement: handleReturnFocus,
        onTriggerKeyDown: handleTriggerKeyDown,
        onPopupKeyDown: handlePopupKeyDown,
        parentVirtualFocus: props.parentVirtualFocus,
      }}
    >
      {props.children}
    </MenuSubmenuRootContext>
  );
}

export type MenuFilterSubmenuRootProps = MenuSubmenuRootProps & MenuFilterProviderOptions;
