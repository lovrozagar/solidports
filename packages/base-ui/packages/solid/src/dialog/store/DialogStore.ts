
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import type { ReactLikeRef } from '../../solid-helpers';
import {
  createInitialPopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
} from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type InteractionType } from '../../utils/useEnhancedClickHandler';
import { type DialogRoot } from '../root/DialogRoot';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export type State<Payload> = PopupStoreState<Payload> & {
  modal: boolean | 'trap-focus';
  disablePointerDismissal: boolean;
  openMethod: InteractionType | null;
  nested: boolean;
  nestedOpenDialogCount: number;
  nestedOpenDrawerCount: number;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  viewportElement: HTMLElement | null | undefined;
  role: 'dialog' | 'alertdialog';
};

type Context = PopupStoreContext<DialogRoot.ChangeEventDetails> & {
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly backdropRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  readonly internalBackdropRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  readonly outsidePressEnabledRef: ReactLikeRef<boolean>;
  readonly onNestedDialogOpen?: ((dialogCount: number, drawerCount: number) => void) | undefined;
  readonly onNestedDialogClose?: (() => void) | undefined;
};

const selectors = {
  ...popupStoreSelectors,
  descriptionElementId: (state: State<unknown>) => state.descriptionElementId,
  disablePointerDismissal: (state: State<unknown>) => state.disablePointerDismissal,
  modal: (state: State<unknown>) => state.modal,
  nested: (state: State<unknown>) => state.nested,
  nestedOpenDialogCount: (state: State<unknown>) => state.nestedOpenDialogCount,
  nestedOpenDrawerCount: (state: State<unknown>) => state.nestedOpenDrawerCount,
  openMethod: (state: State<unknown>) => state.openMethod,
  role: (state: State<unknown>) => state.role,
  titleElementId: (state: State<unknown>) => state.titleElementId,
  viewportElement: (state: State<unknown>) => state.viewportElement,
};

export function DialogStore<Payload>(initialState?: Partial<State<Payload>>) {
  const [state, setState] = createInitialState<Payload>(initialState);
  const store = SolidStore<State<Payload>, Context, typeof selectors>(
    [state, setState],
    {
      backdropRef: { current: null },
      floatingRootContext: getEmptyRootContext(),
      internalBackdropRef: { current: null },
      onOpenChange: undefined,
      onOpenChangeComplete: undefined,
      outsidePressEnabledRef: { current: true },
      popupRef: { current: null },
      triggerElements: new PopupTriggerMap(),
    },
    selectors,
  );

  function setOpen(
    nextOpen: boolean,
    eventDetails: Omit<DialogRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    (eventDetails as DialogRoot.ChangeEventDetails).preventUnmountOnClose = () => {
      store.set('preventUnmountingOnClose', true);
    };

    if (!nextOpen && eventDetails.trigger == null && store.state.activeTriggerId != null) {
      // When closing the dialog, pass the old trigger to the onOpenChange event
      // so it's not reset too early (potentially causing focus issues in controlled scenarios).
      eventDetails.trigger = store.state.activeTriggerElement ?? undefined;
    }

    store.context.onOpenChange?.(nextOpen, eventDetails as DialogRoot.ChangeEventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    /* Notify floating-ui interaction hooks of the open change. */
    if (!store.context.floatingRootContext.context.syncOnly) {
      store.context.floatingRootContext.context.events.emit('openchange', {
        nativeEvent: eventDetails.event,
        nested: store.state.nested,
        open: nextOpen,
        reason: eventDetails.reason,
      });
    }

    const updatedState: Partial<State<Payload>> = {
      open: nextOpen,
    };

    // If a popup is closing, the `trigger` may be null.
    // We want to keep the previous value so that exit animations are played and focus is returned correctly.
    const newTriggerId = eventDetails.trigger?.id ?? null;
    if (newTriggerId || nextOpen) {
      updatedState.activeTriggerId = newTriggerId;
      updatedState.activeTriggerElement = eventDetails.trigger ?? null;
    }

    store.update(updatedState);
  }

  const merged = solidMergeProps(store, { setOpen });
  return merged;
}

function createInitialState<Payload>(initialState: Partial<State<Payload>> = {}) {
  return createInitialPopupStoreState<Payload, State<Payload>>({
    descriptionElementId: undefined,
    disablePointerDismissal: false,
    modal: true,
    nested: false,
    nestedOpenDialogCount: 0,
    nestedOpenDrawerCount: 0,
    openMethod: null,
    popupElement: null,
    role: 'dialog',
    titleElementId: undefined,
    viewportElement: null,
    ...initialState,
  });
}

export type DialogStore<Payload> = ReturnType<typeof DialogStore<Payload>>;
