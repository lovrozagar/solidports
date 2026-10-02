/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */

import { FloatingTreeStore } from '../../floating-ui-solid/components/FloatingTreeStore';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import { type ReactLikeRef } from '../../solid-helpers';
import { PATIENT_CLICK_THRESHOLD } from '../../utils/constants';
import {
  createInitialPopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
} from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type InteractionType } from '../../utils/useEnhancedClickHandler';
import { Timeout, useTimeout } from '../../utils/useTimeout';
import type { PopoverRoot } from '../root/PopoverRoot';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: 'dismiss' | 'click' | undefined;
  modal: boolean | 'trap-focus';
  focusManagerModal: boolean;
  openMethod: InteractionType | null;
  openChangeReason: PopoverRoot.ChangeEventReason | null;
  stickIfOpen: boolean;
  nested: boolean;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  openOnHover: boolean;
  closeDelay: number;
  hasViewport: boolean;
};

type Context = PopupStoreContext<PopoverRoot.ChangeEventDetails> & {
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly backdropRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  readonly internalBackdropRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  readonly triggerFocusTargetRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly beforeContentFocusGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly stickIfOpenTimeout: Timeout;
  floatingTreeRoot: FloatingTreeStore;
};

function createInitialState<Payload>(initialState?: Partial<State<Payload>>) {
  return createInitialPopupStoreState<Payload, State<Payload>>({
    disabled: false,
    modal: false,
    focusManagerModal: false,
    instantType: undefined,
    openMethod: null,
    openChangeReason: null,
    titleElementId: undefined,
    descriptionElementId: undefined,
    stickIfOpen: true,
    nested: false,
    openOnHover: false,
    closeDelay: 0,
    hasViewport: false,
    ...initialState,
    mounted:
      initialState?.open && initialState?.mounted === undefined ? true : initialState?.mounted,
  });
}

const selectors = {
  ...popupStoreSelectors,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  descriptionElementId: (state: State<unknown>) => state.descriptionElementId,
  disabled: (state: State<unknown>) => state.disabled,
  focusManagerModal: (state: State<unknown>) => state.focusManagerModal,
  hasViewport: (state: State<unknown>) => state.hasViewport,
  instantType: (state: State<unknown>) => state.instantType,
  modal: (state: State<unknown>) => state.modal,
  nested: (state: State<unknown>) => state.nested,
  openChangeReason: (state: State<unknown>) => state.openChangeReason,
  openMethod: (state: State<unknown>) => state.openMethod,
  openOnHover: (state: State<unknown>) => state.openOnHover,
  stickIfOpen: (state: State<unknown>) => state.stickIfOpen,
  titleElementId: (state: State<unknown>) => state.titleElementId,
};

export function PopoverStore<Payload>(initialState?: Partial<State<Payload>>) {
  const [state, setState] = createInitialState(initialState);
  const store = SolidStore<State<Payload>, Context, typeof selectors>(
    [state, setState],
    {
      backdropRef: { current: null },
      beforeContentFocusGuardRef: { current: null },
      floatingRootContext: getEmptyRootContext(),
      floatingTreeRoot: new FloatingTreeStore(),
      internalBackdropRef: { current: null },
      onOpenChange: undefined,
      onOpenChangeComplete: undefined,
      popupRef: { current: null },
      stickIfOpenTimeout: useTimeout(),
      triggerElements: new PopupTriggerMap(),
      triggerFocusTargetRef: { current: null },
    },
    selectors,
  );

  function setOpen(
    nextOpen: boolean,
    eventDetails: Omit<PopoverRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    const isHover = eventDetails.reason === REASONS.triggerHover;
    const isKeyboardClick =
      eventDetails.reason === REASONS.triggerPress &&
      (eventDetails.event as MouseEvent).detail === 0;
    const isDismissClose =
      !nextOpen && (eventDetails.reason === REASONS.escapeKey || eventDetails.reason == null);

    (eventDetails as PopoverRoot.ChangeEventDetails).preventUnmountOnClose = () => {
      store.set('preventUnmountingOnClose', true);
    };

    store.context.onOpenChange?.(nextOpen, eventDetails as PopoverRoot.ChangeEventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (!store.context.floatingRootContext.context.syncOnly) {
      store.context.floatingRootContext.context.events.emit('openchange', {
        nativeEvent: eventDetails.event,
        nested: store.state.nested,
        open: nextOpen,
        reason: eventDetails.reason,
        triggerElement: eventDetails.trigger,
      });
    }

    const changeState = () => {
      const updatedState: Partial<State<Payload>> = {
        open: nextOpen,
        openChangeReason: eventDetails.reason,
      };

      // If a popup is closing, the `trigger` may be null.
      // We want to keep the previous value so that exit animations are played and focus is returned correctly.
      const newTriggerId = eventDetails.trigger?.id ?? null;
      if (newTriggerId || nextOpen) {
        updatedState.activeTriggerId = newTriggerId;
        updatedState.activeTriggerElement = eventDetails.trigger ?? null;
      }

      store.update(updatedState);
    };

    if (isHover) {
      // Only allow "patient" clicks to close the popover if it's open.
      // If they clicked within 500ms of the popover opening, keep it open.
      store.set('stickIfOpen', true);
      store.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        store.set('stickIfOpen', false);
      });

      changeState();
    } else {
      changeState();
    }

    if (isKeyboardClick || isDismissClose) {
      store.set('instantType', isKeyboardClick ? 'click' : 'dismiss');
    } else if (eventDetails.reason === REASONS.focusOut) {
      store.set('instantType', 'focus' as any);
    } else {
      store.set('instantType', undefined);
    }
  }

  function disposeEffect() {
    return store.context.stickIfOpenTimeout.clear();
  }

  const merged = solidMergeProps(store, { disposeEffect, setOpen });
  return merged;
}

export type PopoverStore<Payload> = ReturnType<typeof PopoverStore<Payload>>;
