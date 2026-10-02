
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import type { PopupTriggerMap } from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import type { FloatingUIOpenChangeDetails } from '../../utils/types';
import type { ContextData, FloatingEvents, ReferenceType } from '../types';
import { createEventEmitter } from '../utils/createEventEmitter';
import { isClickLikeEvent } from '../utils/event';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export interface FloatingRootState {
  open: boolean;
  domReferenceElement: Element | null | undefined;
  referenceElement: ReferenceType | null | undefined;
  floatingElement: HTMLElement | null | undefined;
  positionReference: ReferenceType | null | undefined;
  /** The ID of the floating element. */
  floatingId: string | undefined;
}

export interface FloatingRootStoreContext {
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
  readonly dataRef: ContextData;
  readonly events: FloatingEvents;
  nested: boolean;
  syncOnly: boolean;
  readonly triggerElements: PopupTriggerMap;
}

const selectors = {
  domReferenceElement: (state: FloatingRootState) => state.domReferenceElement,
  floatingElement: (state: FloatingRootState) => state.floatingElement,
  floatingId: (state: FloatingRootState) => state.floatingId,
  open: (state: FloatingRootState) => state.open,
  referenceElement: (state: FloatingRootState) => state.positionReference ?? state.referenceElement,
};

interface FloatingRootStoreOptions {
  open: boolean;
  referenceElement: ReferenceType | null | undefined;
  floatingElement: HTMLElement | null | undefined;
  floatingId: string | undefined;
  /** Non-reactive */
  triggerElements: PopupTriggerMap;
  /** Non-reactive */
  nested: boolean;
  /** Non-reactive */
  syncOnly: boolean;
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
}

export function FloatingRootStore(options: FloatingRootStoreOptions) {
  const store = SolidStore<FloatingRootState, FloatingRootStoreContext, typeof selectors>(
    {
      domReferenceElement: options.referenceElement as Element | null | undefined,
      floatingElement: options.floatingElement,
      floatingId: options.floatingId,
      open: options.open,
      positionReference: options.referenceElement,
      referenceElement: options.referenceElement,
    },
    {
      dataRef: {},
      events: createEventEmitter(),
      nested: options.nested,
      onOpenChange: options.onOpenChange,
      syncOnly: options.syncOnly,
      triggerElements: options.triggerElements,
    },
    selectors,
  );

  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  function setOpen(newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) {
    if (
      !newOpen ||
      !store.state.open ||
      // Prevent a pending hover-open from overwriting a click-open event, while allowing
      // click events to upgrade a hover-open.
      isClickLikeEvent(eventDetails.event)
    ) {
      store.context.dataRef.openEvent = newOpen ? eventDetails.event : undefined;
    }
    if (!store.context.syncOnly) {
      const details: FloatingUIOpenChangeDetails = {
        nativeEvent: eventDetails.event,
        nested: store.context.nested,
        open: newOpen,
        reason: eventDetails.reason,
        triggerElement: eventDetails.trigger,
      };

      store.context.events.emit('openchange', details);
    }

    store.context.onOpenChange?.(newOpen, eventDetails);
  }

  const merged = solidMergeProps(store, { setOpen });
  return merged;
}

export type FloatingRootStore = ReturnType<typeof FloatingRootStore>;
