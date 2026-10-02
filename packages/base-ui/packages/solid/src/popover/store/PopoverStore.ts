import { untrack } from 'solid-js';
import { type ReactLikeRef } from '../../solid-helpers';
import { PATIENT_CLICK_THRESHOLD } from '../../utils/constants';
import { NOOP } from '../../utils/empty';
import { NullStore } from '../../utils/NullStore';
import {
  attachPreventUnmountOnClose,
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  createPopupOpenState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  type PopupTriggerStoreKeys,
} from '../../utils/popups';
import { flushSync } from '../../utils/flushSync';
import { REASONS } from '../../utils/reasons';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type InteractionType } from '../../utils/useEnhancedClickHandler';
import { useTimeout, type Timeout } from '../../utils/useTimeout';
import type { PopoverRoot } from '../root/PopoverRoot';
import type { AdaptiveOriginMiddleware } from '../../utils/adaptiveOriginConstants';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;
  modal: boolean | 'trap-focus';
  focusManagerModal: boolean;
  openMethod: InteractionType | null;
  openChangeReason: PopoverRoot.ChangeEventReason | null;
  stickIfOpen: boolean;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  openOnHover: boolean;
  closeDelay: number;
  // Solid: the viewport flags itself here; the positioner derives the adaptive-origin middleware.
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

type Context = PopupStoreContext<PopoverRoot.ChangeEventDetails> & {
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly backdropRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  readonly internalBackdropRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  readonly triggerFocusTargetRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly beforeContentFocusGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly stickIfOpenTimeout: Timeout;
};

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: State<unknown>) => state.disabled,
  instantType: (state: State<unknown>) => state.instantType,
  openMethod: (state: State<unknown>) => state.openMethod,
  openChangeReason: (state: State<unknown>) => state.openChangeReason,
  modal: (state: State<unknown>) => state.modal,
  focusManagerModal: (state: State<unknown>) => state.focusManagerModal,
  stickIfOpen: (state: State<unknown>) => state.stickIfOpen,
  titleElementId: (state: State<unknown>) => state.titleElementId,
  descriptionElementId: (state: State<unknown>) => state.descriptionElementId,
  openOnHover: (state: State<unknown>) => state.openOnHover,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
};

type Selectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `PopoverStore` and
 * the inert fallback store satisfy it, so a trigger can read from whichever store the handle
 * currently exposes. Narrowed to the members a trigger actually uses — the trigger-data members plus
 * `setOpen` (called by the focus guards) — so the exposed surface can't bypass the open-change
 * pipeline; on the detached fallback store every one of these mutations is a no-op.
 */
export type PopoverHandleStore<Payload> = Pick<
  PopoverStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen'
>;

export function PopoverStore<Payload>(
  initialState: Partial<State<Payload>>,
  floatingId: string | undefined,
  nested: boolean,
) {
  const triggerElements = new PopupTriggerMap();
  const store = SolidStore<State<Payload>, Context, Selectors>(
    createInitialState<Payload>(initialState, floatingId),
    createInitialContext(triggerElements, floatingId, nested),
    selectors,
  );

  const setOpen = (
    nextOpen: boolean,
    eventDetails: Omit<PopoverRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => {
    const isHover = eventDetails.reason === REASONS.triggerHover;
    const isKeyboardClick =
      eventDetails.reason === REASONS.triggerPress &&
      (eventDetails.event as MouseEvent).detail === 0;
    const isDismissClose =
      !nextOpen && (eventDetails.reason === REASONS.escapeKey || eventDetails.reason == null);

    const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(
      eventDetails as PopoverRoot.ChangeEventDetails,
    );

    const activeTriggerId = store.select('activeTriggerId');

    if (
      !nextOpen &&
      eventDetails.reason === REASONS.closePress &&
      eventDetails.trigger == null &&
      activeTriggerId != null
    ) {
      eventDetails.trigger =
        store.context.triggerElements.getById(activeTriggerId) ??
        store.select('activeTriggerElement') ??
        undefined;
    }

    store.context.onOpenChange?.(nextOpen, eventDetails as PopoverRoot.ChangeEventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    store.context.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

    const changeState = () => {
      store.update({
        ...createPopupOpenState(
          store.state,
          nextOpen,
          eventDetails.trigger,
          shouldPreventUnmountOnClose(),
        ),
        openChangeReason: eventDetails.reason,
      });
    };

    if (isHover) {
      // Only allow "patient" clicks to close the popover if it's open.
      // If they clicked within 500ms of the popover opening, keep it open.
      store.set('stickIfOpen', true);
      store.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        store.set('stickIfOpen', false);
      });

      flushSync(changeState);
    } else {
      changeState();
    }

    let instantType: State<Payload>['instantType'];
    if (isKeyboardClick) {
      instantType = 'click';
    } else if (isDismissClose) {
      instantType = 'dismiss';
    } else if (eventDetails.reason === REASONS.focusOut) {
      instantType = 'focus';
    }
    store.set('instantType', instantType);
  };

  return { ...store, setOpen };
}

export type PopoverStore<Payload> = ReturnType<typeof PopoverStore<Payload>>;

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `Popover.Root` is attached. It preserves a popover-specific trigger registry in context so
 * detached triggers can register before migrating to the live root store. `setOpen` is a no-op
 * (matching the inert reads/writes of `NullStore`), so a trigger can hand the store to focus-guard
 * helpers that expect `setOpen` without it ever taking effect while detached.
 */
export function createNullPopoverStore<Payload>(): PopoverHandleStore<Payload> {
  const triggerElements = new PopupTriggerMap();

  // Solid: the state is not frozen because Solid stores mark their source object.
  const store = NullStore<State<Payload>, Context, Selectors>(
    createInitialStateSnapshot<Payload>(),
    Object.freeze(createInitialContext(triggerElements)),
    selectors,
  );
  return { ...store, setOpen: NOOP };
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  floatingId?: string | undefined,
) {
  // Initial values: the spread reads the caller's getters once.
  return untrack(() => {
    const state = {
      disabled: false,
      modal: false,
      focusManagerModal: false,
      instantType: undefined,
      openMethod: null,
      openChangeReason: null,
      titleElementId: undefined,
      descriptionElementId: undefined,
      stickIfOpen: true,
      openOnHover: false,
      closeDelay: 0,
      adaptiveOrigin: undefined,
      floatingId,
      ...initialState,
    } as Partial<State<Payload>>;

    if (state.open && initialState?.mounted === undefined) {
      state.mounted = true;
    }

    return createInitialPopupStoreState<Payload, State<Payload>>(state);
  });
}

/** A plain copy of the default state, for the inert store (which holds plain values). */
function createInitialStateSnapshot<Payload>(): State<Payload> {
  const [state] = createInitialState<Payload>(undefined);
  return untrack(() => ({ ...state }));
}

function createInitialContext(
  triggerElements: PopupTriggerMap,
  floatingId?: string | undefined,
  nested = false,
): Context {
  return {
    backdropRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    // Solid keeps the store-owned floating root in context (React keeps it in state).
    floatingRootContext: createPopupFloatingRootContext(triggerElements, floatingId, nested),
    internalBackdropRef: { current: null },
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    popupRef: { current: null },
    stickIfOpenTimeout: useTimeout(),
    triggerElements,
    triggerFocusTargetRef: { current: null },
  };
}
