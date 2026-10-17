import { untrack } from 'solid-js';
import type { Accessor } from 'solid-js';

import type { FloatingRootContext } from '../../floating-ui-solid';
import type { ReactLikeRef } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../constants';
import { createStoreState, keyedSelector } from '../store/SolidStoreV2';
import type { SolidStore } from '../store/SolidStoreV2';
import type { HTMLProps } from '../types';
import type { TransitionStatus } from '../useTransitionStatus';
import type { PopupTriggerMap } from './popupTriggerMap';
import type { SetStoreFunction } from '../../solid-1-compat';

/**
 * State common to all popup stores.
 */
export type PopupStoreState<Payload> = {
  /**
   * Whether the popup is open (internal state).
   */
  open: boolean;
  /**
   * Whether the popup is open (external prop).
   */
  readonly openProp: boolean | undefined;
  /**
   * Whether the popup should be mounted in the DOM.
   * This usually follows `open` but can be different during exit transitions.
   */
  mounted: boolean;
  /**
   * The current enter/exit transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  floatingId: string | undefined;
  /**
   * Number of trigger elements currently registered for this popup.
   */
  triggerCount: number;
  /**
   * Whether to prevent unmounting the popup when closed.
   * Useful for interacting with JS animation libraries that control unmounting themselves.
   */
  preventUnmountingOnClose: boolean;

  /**
   * Optional payload set by the trigger.
   */
  payload: Payload | undefined;

  /**
   * ID of the currently active trigger.
   */
  activeTriggerId: string | null;
  /**
   * The currently active trigger DOM element.
   */
  activeTriggerElement: Element | null | undefined;
  /**
   * Whether the popup is open because of a request that deliberately carried no trigger, such as a
   * handle's `open(null)` or `openWithPayload()`. While set, a lone registered trigger is not
   * implicitly associated with the popup, so its trigger-owned state (such as `payload`) is not
   * forwarded. Reset by the Root once the popup is effectively closed.
   */
  openedWithoutTrigger: boolean;
  /**
   * ID of the trigger (external prop).
   */
  readonly triggerIdProp: string | null | undefined;
  /**
   * The popup DOM element.
   */
  popupElement: HTMLElement | null | undefined;
  /**
   * The positioner DOM element.
   */
  positionerElement: HTMLElement | null | undefined;

  /**
   * Props to spread onto the active trigger element.
   */
  activeTriggerProps: HTMLProps;
  /**
   * Props to spread onto inactive trigger elements.
   */
  inactiveTriggerProps: HTMLProps;
  /**
   * Props to spread onto the popup element.
   */
  popupProps: HTMLProps;
  /**
   * Delay before closing on hover-out, in ms. Optional on stores that do not hover-open.
   */
  closeDelay?: number | undefined;
};

export function createInitialPopupStoreState<Payload, State extends PopupStoreState<Payload>>(
  initialState: Partial<State> = {},
) {
  // Initial values: the spread reads the caller's getters once.
  const [state, setState] = createStoreState(
    untrack(() => ({
      activeTriggerElement: null,
      activeTriggerId: null,
      activeTriggerProps: EMPTY_OBJECT,
      floatingId: undefined,
      inactiveTriggerProps: EMPTY_OBJECT,
      mounted: false,
      open: false,
      openProp: undefined,
      openedWithoutTrigger: false,
      payload: undefined,
      popupElement: null,
      popupProps: EMPTY_OBJECT,
      positionerElement: null,
      preventUnmountingOnClose: false,
      transitionStatus: undefined,
      triggerCount: 0,
      triggerIdProp: undefined,
      ...initialState,
    })),
  );
  return [state, setState] as unknown as [State, SetStoreFunction<State>];
}

export type PopupStoreContext<ChangeEventDetails> = {
  /**
   * Map of registered trigger elements.
   */
  readonly triggerElements: PopupTriggerMap;
  /**
   * Reference to the popup element.
   */
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  floatingRootContext: FloatingRootContext;
  /**
   * Callback fired when the open state changes.
   */
  onOpenChange?: ((open: boolean, eventDetails: ChangeEventDetails) => void) | undefined;
  /**
   * Callback fired when the open state change animation completes.
   */
  onOpenChangeComplete: ((open: boolean) => void) | undefined;
  /**
   * Creates the root's interactions, which a closed root defers. Triggers call it on the first
   * intent; it is cleared once they exist.
   */
  activateInteractions?: (() => void) | undefined;
};

type S = PopupStoreState<unknown>;

const activeTriggerIdSelector = (state: S) => state.triggerIdProp ?? state.activeTriggerId;

const openSelector = (state: S) => state.openProp ?? state.open;

const popupIdSelector = (state: S) => {
  // Solid: read the id state before the element: the element's DOM id is not reactive, so a
  // selector that short-circuits past `floatingId` would never update when it changes.
  const floatingId = state.floatingId;
  const popupId = state.popupElement?.id ?? floatingId;
  return popupId || undefined;
};

function triggerOwnsOpenPopup(state: S, triggerId: string | undefined) {
  return (
    triggerId !== undefined && openSelector(state) && activeTriggerIdSelector(state) === triggerId
  );
}

function triggerOwnsOpenPopupOrIsOnlyTrigger(state: S, triggerId: string | undefined) {
  if (triggerOwnsOpenPopup(state, triggerId)) {
    return true;
  }

  return (
    triggerId !== undefined &&
    openSelector(state) &&
    activeTriggerIdSelector(state) == null &&
    !state.openedWithoutTrigger &&
    state.triggerCount === 1
  );
}

export const popupStoreSelectors = {
  open: openSelector,
  mounted: (state: S) => state.mounted,
  // `open` is written synchronously on an open change; `mounted`/`transitionStatus` sync in a
  // layout effect. Match useTransitionStatus so a retained popup does not miss its starting phase.
  transitionStatus: (state: S) =>
    openSelector(state) && !state.mounted ? 'starting' : state.transitionStatus,
  triggerCount: (state: S) => state.triggerCount,
  preventUnmountingOnClose: (state: S) => state.preventUnmountingOnClose,
  payload: (state: S) => state.payload,

  activeTriggerId: activeTriggerIdSelector,
  activeTriggerElement: (state: S) => (state.mounted ? state.activeTriggerElement : null),
  popupId: popupIdSelector,
  /**
   * Whether the trigger with the given ID was used to open the popup.
   */
  // Solid: keyed, so a change of the active trigger re-runs only the old and the new trigger's
  // readers, not every detached trigger's. The three trigger selectors share the active trigger id
  // as their key, so they share one projection; `open` and `mounted` are read by the active
  // trigger's readers only.
  isTriggerActive: keyedSelector(activeTriggerIdSelector),
  /**
   * Whether the popup is open and was activated by a trigger with the given ID.
   */
  isOpenedByTrigger: keyedSelector(activeTriggerIdSelector, openSelector),
  /**
   * Whether the popup is mounted and was activated by a trigger with the given ID.
   */
  isMountedByTrigger: keyedSelector(activeTriggerIdSelector, (state: S) => state.mounted),
  triggerProps: (state: S, isActive: Accessor<boolean>) =>
    isActive() ? state.activeTriggerProps : state.inactiveTriggerProps,
  /**
   * Popup id for the trigger that currently owns the open popup.
   */
  triggerPopupId: (state: S, triggerId: Accessor<string | undefined>) =>
    triggerOwnsOpenPopupOrIsOnlyTrigger(state, triggerId()) ? popupIdSelector(state) : undefined,
  popupProps: (state: S) => state.popupProps,

  popupElement: (state: S) => state.popupElement,
  positionerElement: (state: S) => state.positionerElement,
};

export type PopupStoreSelectors = typeof popupStoreSelectors;

/**
 * Store members a detached handle-backed trigger reads or invokes for trigger registration and data
 * forwarding. `set`/`update` are included only for trigger-count and trigger-data bookkeeping; on a
 * detached (inert) store they are intentionally no-ops, so a write through them is not guaranteed to
 * be durable.
 */
export type PopupTriggerStoreKeys = 'context' | 'select' | 'set' | 'state' | 'update' | 'useState';

/**
 * The subset of a popup store that trigger registration and data forwarding rely on. Narrow enough
 * that an inert store can be passed while detached.
 */
export type PopupTriggerDataStore<State extends PopupStoreState<unknown>> = Pick<
  SolidStore<State, PopupStoreContext<never>, PopupStoreSelectors>,
  PopupTriggerStoreKeys
>;
