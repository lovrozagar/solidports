import { untrack } from 'solid-js';

import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import type { PopupTriggerMap } from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import type { FloatingUIOpenChangeDetails } from '../../utils/types';
import type { ContextData, FloatingEvents, ReferenceType } from '../types';
import { createEventEmitter } from '../utils/createEventEmitter';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { isClickLikeEvent } from '../utils/event';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export interface FloatingRootState {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  domReferenceElement: Element | null | undefined;
  referenceElement: ReferenceType | null | undefined;
  floatingElement: HTMLElement | null | undefined;
  positionReference: ReferenceType | null | undefined;
  /** The ID of the floating element. */
  floatingId: string | undefined;
  /**
   * Whether the floating element is mounted. While it is not, the element selectors read `null`.
   * Solid: React clears the elements once the popup unmounts; deriving it keeps them in sync.
   */
  elementsMounted: boolean;
}

export interface FloatingRootStoreContext {
  onOpenChange:
    ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void) | undefined;
  readonly dataRef: ContextData;
  readonly events: FloatingEvents;
  nested: boolean;
  syncOnly: boolean;
  readonly triggerElements: PopupTriggerMap;
}

const selectors = {
  domReferenceElement: (state: FloatingRootState) =>
    state.elementsMounted ? state.domReferenceElement : null,
  floatingElement: (state: FloatingRootState) =>
    state.elementsMounted ? state.floatingElement : null,
  floatingId: (state: FloatingRootState) => state.floatingId,
  open: (state: FloatingRootState) => state.open,
  referenceElement: (state: FloatingRootState) =>
    state.elementsMounted ? (state.positionReference ?? state.referenceElement) : null,
  transitionStatus: (state: FloatingRootState) => state.transitionStatus,
};

interface FloatingRootStoreOptions {
  open: boolean;
  transitionStatus?: TransitionStatus | undefined;
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
    ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void) | undefined;
}

export function FloatingRootStore(options: FloatingRootStoreOptions) {
  // Options are initial values (callers keep them in sync afterwards), so read them untracked.
  const [initialState, initialContext] = untrack(
    () =>
      [
        {
          domReferenceElement: options.referenceElement as Element | null | undefined,
          elementsMounted: true,
          floatingElement: options.floatingElement,
          floatingId: options.floatingId,
          open: options.open,
          positionReference: options.referenceElement,
          referenceElement: options.referenceElement,
          transitionStatus: options.transitionStatus,
        },
        {
          dataRef: {},
          events: createEventEmitter(),
          nested: options.nested,
          onOpenChange: options.onOpenChange,
          syncOnly: options.syncOnly,
          triggerElements: options.triggerElements,
        },
      ] as const,
  );
  const store = SolidStore<FloatingRootState, FloatingRootStoreContext, typeof selectors>(
    initialState,
    initialContext,
    selectors,
  );

  /**
   * Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
   */
  function syncOpenEvent(newOpen: boolean, event: Event | undefined) {
    if (
      !newOpen ||
      !store.state.open ||
      // Prevent a pending hover-open from overwriting a click-open event, while allowing
      // click events to upgrade a hover-open.
      (event != null && isClickLikeEvent(event))
    ) {
      store.context.dataRef.openEvent = newOpen ? event : undefined;
    }
  }

  /**
   * Runs the root-owned side effects for an open state change.
   */
  function dispatchOpenChange(newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) {
    syncOpenEvent(newOpen, eventDetails.event);

    const details: FloatingUIOpenChangeDetails = {
      open: newOpen,
      reason: eventDetails.reason,
      nativeEvent: eventDetails.event,
      nested: store.context.nested,
      triggerElement: eventDetails.trigger,
    };

    store.context.events.emit('openchange', details);
  }

  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  function setOpen(newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) {
    // A popup-synced root only forwards: the popup store owns `dispatchOpenChange(...)`.
    if (store.context.syncOnly) {
      store.context.onOpenChange?.(newOpen, eventDetails);
      return;
    }

    dispatchOpenChange(newOpen, eventDetails);

    store.context.onOpenChange?.(newOpen, eventDetails);
  }

  const merged = solidMergeProps(store, { dispatchOpenChange, setOpen, syncOpenEvent });
  return merged;
}

export type FloatingRootStore = ReturnType<typeof FloatingRootStore>;
