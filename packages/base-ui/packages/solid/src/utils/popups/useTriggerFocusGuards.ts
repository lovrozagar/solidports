import {
  contains,
  type FocusableElement,
  getNextTabbable,
  getTabbableAfterElement,
  getTabbableBeforeElement,
  isOutsideEvent,
} from '../../floating-ui-solid/utils';
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
  const preFocusGuardRef: ReactLikeRef<HTMLElement | null> = { current: null };

  function handlePreFocusGuardFocus(event: FocusEvent) {
    flushSync(() => {
      store().setOpen(
        false,
        createChangeEventDetails(REASONS.focusOut, event, event.currentTarget as HTMLElement),
      );
    });

    const previousTabbable: FocusableElement | null = getTabbableBeforeElement(
      preFocusGuardRef.current,
    );
    previousTabbable?.focus();
  }

  function handleFocusTargetFocus(event: FocusEvent) {
    const currentStore = store();
    const positionerElement = currentStore.select('positionerElement');
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      currentStore.context.beforeContentFocusGuardRef.current?.focus();
    } else {
      flushSync(() => {
        currentStore.setOpen(
          false,
          createChangeEventDetails(REASONS.focusOut, event, event.currentTarget as HTMLElement),
        );
      });

      let nextTabbable = getTabbableAfterElement(
        currentStore.context.triggerFocusTargetRef.current || triggerElementRef.current,
      );

      while (nextTabbable !== null && contains(positionerElement, nextTabbable)) {
        const prevTabbable = nextTabbable;
        nextTabbable = getNextTabbable(nextTabbable);
        if (nextTabbable === prevTabbable) {
          break;
        }
      }

      nextTabbable?.focus();
    }
  }

  return { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus };
}
