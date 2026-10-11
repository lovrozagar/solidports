import { getTabbableNearElement, isOutsideEvent } from '../../floating-ui-solid/utils';
import type { ReactLikeRef } from '../../solid-helpers';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../createBaseUIEventDetails';
import { flushSync } from '../flushSync';
import { REASONS } from '../reasons';

/**
 * Minimal store interface required by the focus guard hook.
 * Both PopoverStore and MenuStore satisfy this interface.
 */
interface TriggerFocusGuardStore {
  setOpen(open: boolean, eventDetails: BaseUIChangeEventDetails<typeof REASONS.focusOut>): void;
  select(key: 'positionerElement'): HTMLElement | null | undefined;
  context: {
    /**
     * Shared with the focus manager through `getInsideElements` so that blurring the trigger
     * onto this guard does not close the popup before the guard's own focus handler runs.
     */
    readonly beforeTriggerFocusGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
    readonly beforeContentFocusGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
    readonly triggerFocusTargetRef: ReactLikeRef<HTMLElement | null | undefined>;
  };
}

/**
 * Provides focus guard handlers for popup triggers (Popover, Menu).
 *
 * When the popup is open, invisible focus guard elements are placed before and after
 * the trigger. These handlers close the popup and move focus to the appropriate
 * tabbable element when the guards receive focus (i.e. when the user tabs out).
 */
export function useTriggerFocusGuards(
  store: () => TriggerFocusGuardStore,
  triggerElementRef: ReactLikeRef<HTMLElement | null | undefined>,
) {
  function closeAndFocus(
    event: FocusEvent,
    direction: 1 | -1,
    positionerElement: HTMLElement | null | undefined,
  ) {
    const guard = event.currentTarget as HTMLElement;

    flushSync(() => {
      store().setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));
    });

    // The close commits before this read, so the guard may have unmounted or lost its
    // tabindex. Anchor on the trigger, which still finds the next tab stop when its
    // own tabIndex is -1. Solid keeps the trailing guard node mounted.
    getTabbableNearElement(
      triggerElementRef.current,
      direction,
      positionerElement,
    )?.focus();
  }

  function handlePreFocusGuardFocus(event: FocusEvent) {
    closeAndFocus(event, -1, store().select('positionerElement'));
  }

  function handleFocusTargetFocus(event: FocusEvent) {
    const currentStore = store();
    const positionerElement = currentStore.select('positionerElement');
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      currentStore.context.beforeContentFocusGuardRef.current?.focus();
    } else {
      closeAndFocus(event, 1, positionerElement);
    }
  }

  return { handlePreFocusGuardFocus, handleFocusTargetFocus };
}
