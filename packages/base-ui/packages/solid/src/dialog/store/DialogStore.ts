import { untrack } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';
import { NullStore } from '../../utils/NullStore';
import {
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  createPopupOpenState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerDataStore,
  PopupTriggerMap,
} from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type InteractionType } from '../../utils/useEnhancedClickHandler';
import { type DialogRoot } from '../root/DialogRoot';

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
};

const selectors = {
  ...popupStoreSelectors,
  modal: (state: State<unknown>) => state.modal,
  nested: (state: State<unknown>) => state.nested,
  nestedOpenDialogCount: (state: State<unknown>) => state.nestedOpenDialogCount,
  nestedOpenDrawerCount: (state: State<unknown>) => state.nestedOpenDrawerCount,
  disablePointerDismissal: (state: State<unknown>) => state.disablePointerDismissal,
  openMethod: (state: State<unknown>) => state.openMethod,
  descriptionElementId: (state: State<unknown>) => state.descriptionElementId,
  titleElementId: (state: State<unknown>) => state.titleElementId,
  viewportElement: (state: State<unknown>) => state.viewportElement,
  role: (state: State<unknown>) => state.role,
};

/**
 * The subset of `DialogStore` that detached handle-backed triggers rely on. Both the real
 * `DialogStore` and the inert fallback store satisfy it, so a trigger can read from whichever
 * store the handle currently exposes.
 */
export type DialogHandleStore<Payload> = PopupTriggerDataStore<State<Payload>>;

export function DialogStore<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  floatingId: string | undefined,
  nested: boolean,
) {
  const triggerElements = new PopupTriggerMap();
  const store = SolidStore<State<Payload>, Context, typeof selectors>(
    createInitialState<Payload>(initialState, floatingId),
    createInitialContext(triggerElements, floatingId, nested),
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

    store.context.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

    store.update(createPopupOpenState(store.state, nextOpen, eventDetails.trigger));
  }

  return Object.assign(store, { setOpen });
}

export type DialogStore<Payload> = ReturnType<typeof DialogStore<Payload>>;

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `Dialog.Root` is attached. It preserves a dialog-specific trigger registry in context so
 * detached triggers can register before migrating to the live root store.
 */
export function createNullDialogStore<Payload>(): DialogHandleStore<Payload> {
  const triggerElements = new PopupTriggerMap();

  // `NullStore` takes a plain state object: snapshot the default state once.
  const [initialState] = createInitialState<Payload>(undefined);

  return NullStore<State<Payload>, Context, typeof selectors>(
    untrack(() => ({ ...initialState })),
    Object.freeze(createInitialContext(triggerElements)),
    selectors,
  );
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  floatingId?: string | undefined,
) {
  // Initial values: the spread reads the caller's getters once.
  return untrack(() =>
    createInitialPopupStoreState<Payload, State<Payload>>({
      floatingId,
      modal: true,
      disablePointerDismissal: false,
      viewportElement: null,
      descriptionElementId: undefined,
      titleElementId: undefined,
      openMethod: null,
      nested: false,
      nestedOpenDialogCount: 0,
      nestedOpenDrawerCount: 0,
      role: 'dialog',
      ...initialState,
    }),
  );
}

function createInitialContext(
  triggerElements: PopupTriggerMap,
  floatingId?: string | undefined,
  nested = false,
): Context {
  return {
    popupRef: { current: null },
    backdropRef: { current: null },
    internalBackdropRef: { current: null },
    outsidePressEnabledRef: { current: true },
    // Solid keeps the floating root in context (React keeps it in state); see `usePopupRootStore`.
    floatingRootContext: createPopupFloatingRootContext(triggerElements, floatingId, nested),
    triggerElements,
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
  };
}
