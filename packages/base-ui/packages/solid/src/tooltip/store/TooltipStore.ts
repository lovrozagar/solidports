import { untrack } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { NOOP } from '../../utils/empty';
import { NullStore } from '../../utils/NullStore';
import {
  applyPopupOpenChange,
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  type PopupTriggerStoreKeys,
} from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type TooltipRoot } from '../root/TooltipRoot';
import type { AdaptiveOriginMiddleware } from '../../utils/adaptiveOriginConstants';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: 'delay' | 'dismiss' | 'focus' | undefined;
  isInstantPhase: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
  disableHoverablePopup: boolean;
  openChangeReason: TooltipRoot.ChangeEventReason | null;
  closeOnClick: boolean;
  closeDelay: number;
  // Solid: the viewport flags itself here; the positioner derives the adaptive-origin middleware.
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type Context = PopupStoreContext<TooltipRoot.ChangeEventDetails> & {
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
};

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: State<unknown>) => state.disabled,
  instantType: (state: State<unknown>) => state.instantType,
  isInstantPhase: (state: State<unknown>) => state.isInstantPhase,
  trackCursorAxis: (state: State<unknown>) => state.trackCursorAxis,
  disableHoverablePopup: (state: State<unknown>) => state.disableHoverablePopup,
  lastOpenChangeReason: (state: State<unknown>) => state.openChangeReason,
  closeOnClick: (state: State<unknown>) => state.closeOnClick,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
};

type Selectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `TooltipStore` and
 * the inert fallback store satisfy it, so a trigger can read from whichever store the handle
 * currently exposes. Narrowed to the members a trigger actually uses — the trigger-data members plus
 * `setOpen`/`cancelPendingOpen` (called directly by the trigger) and `useSyncedValue` — so the
 * exposed surface can't bypass the open-change pipeline; on the detached fallback store every one of
 * these mutations is a no-op.
 */
export type TooltipHandleStore<Payload> = Pick<
  TooltipStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen' | 'cancelPendingOpen' | 'useSyncedValue'
>;

export function TooltipStore<Payload>(
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
    eventDetails: Omit<TooltipRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => {
    applyPopupOpenChange(store, nextOpen, eventDetails as TooltipRoot.ChangeEventDetails, {
      extraState: { openChangeReason: eventDetails.reason },
    });
  };

  // Used by trigger clicks to clear a delayed hover open without reporting a public open-state change.
  const cancelPendingOpen = (event: MouseEvent | PointerEvent) => {
    store.context.floatingRootContext.dispatchOpenChange(
      false,
      createChangeEventDetails(REASONS.triggerPress, event),
    );
  };

  return { ...store, setOpen, cancelPendingOpen };
}

export type TooltipStore<Payload> = ReturnType<typeof TooltipStore<Payload>>;

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no `Tooltip.Root`
 * is attached. It preserves a tooltip-specific trigger registry in context so detached triggers can
 * register before migrating to the live root store. `setOpen`/`cancelPendingOpen` are no-ops
 * (matching the inert reads/writes of `NullStore`), so a trigger can call them from hover/click
 * handlers while detached without any effect.
 */
export function createNullTooltipStore<Payload>(): TooltipHandleStore<Payload> {
  const triggerElements = new PopupTriggerMap();

  // Solid: the state is not frozen because Solid stores mark their source object.
  const store = NullStore<State<Payload>, Context, Selectors>(
    createInitialStateSnapshot<Payload>(),
    Object.freeze(createInitialContext(triggerElements)),
    selectors,
  );
  return { ...store, setOpen: NOOP, cancelPendingOpen: NOOP };
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  floatingId?: string | undefined,
) {
  // Initial values: the spread reads the caller's getters once.
  return untrack(() =>
    createInitialPopupStoreState<Payload, State<Payload>>({
      disabled: false,
      instantType: undefined,
      isInstantPhase: false,
      trackCursorAxis: 'none',
      disableHoverablePopup: false,
      openChangeReason: null,
      closeOnClick: true,
      closeDelay: 0,
      adaptiveOrigin: undefined,
      floatingId,
      ...initialState,
    }),
  );
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
    // Solid keeps the store-owned floating root in context (React keeps it in state).
    floatingRootContext: createPopupFloatingRootContext(triggerElements, floatingId, nested),
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    popupRef: { current: null },
    triggerElements,
  };
}
