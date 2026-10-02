/* eslint-disable typescript/no-explicit-any -- popup utils accept arbitrary State extends PopupStoreState; carrying generic Payload through every helper would balloon signatures */
import { createTrackedEffect, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFloatingParentNodeId } from '../../floating-ui-solid/components/FloatingTree';
import { FOCUSABLE_ATTRIBUTE } from '../../floating-ui-solid/utils/constants';
import { EMPTY_OBJECT } from '../empty';
import { SolidStore } from '../store/SolidStoreV2';
import type { HTMLProps } from '../types';
import { useId } from '../useId';
import type { InteractionType } from '../useEnhancedClickHandler';
import { useOpenChangeComplete } from '../useOpenChangeComplete';
import { useTransitionStatus } from '../useTransitionStatus';
import type { ReactLikeRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../createBaseUIEventDetails';
import { REASONS } from '../reasons';
import {
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreSelectors,
  PopupStoreState,
} from './store';

export const FOCUSABLE_POPUP_PROPS = {
  tabindex: -1,
  [FOCUSABLE_ATTRIBUTE]: '',
} satisfies HTMLProps<HTMLElement> & Record<typeof FOCUSABLE_ATTRIBUTE, string>;

/**
 * Returns the default `initialFocus` resolver for a popup. When opened by touch it focuses the
 * popup element itself to prevent the virtual keyboard from opening (required for Android
 * specifically; iOS handles this automatically). Otherwise it falls back to the default behavior.
 */
export function createDefaultInitialFocus(popupRef: ReactLikeRef<HTMLElement | null | undefined>) {
  return (interactionType: InteractionType) =>
    interactionType === 'touch' ? popupRef.current : true;
}

/**
 * The subset of a popup handle that a Root needs to bind its store to. Both the real handle classes
 * and any test double satisfy it.
 */
export interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

/**
 * Creates and owns a popup store on behalf of a Root part. The store is created exactly once, with
 * controlled props and root state synced separately after creation.
 *
 * Solid floating-root sync stays in the component's interaction hook (`useDialogRoot`, etc.) rather
 * than here, because Solid popup stores keep `floatingRootContext` on `store.context` instead of
 * constructing it in the store factory.
 *
 * @param createStore Factory that builds the store. Called exactly once, receiving the floating id
 * and whether the popup is nested inside another floating element, both resolved on the first render.
 */
export function usePopupRootStore<Store>(
  createStore: (floatingId: string | undefined, nested: boolean) => Store,
  _treatPopupAsFloatingElement = false,
): Store {
  const floatingId = useId();
  const nested = useFloatingParentNodeId() != null;
  return untrack(() => createStore(floatingId(), nested));
}

/**
 * Attaches a Root's store to a handle for this component's committed lifetime. Popup Roots render
 * it before their interactions and user children so its effect runs before descendant effects.
 */
export function PopupHandleAttachment<Store>(props: {
  handle: PopupRootStoreHandle<Store>;
  store: Store;
}) {
  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const handle = props.handle;
    const store = props.store;
    const cleanup = handle.attachStore(store);
    _c.push(cleanup);
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  return null;
}

type PopupOpenState = Pick<
  PopupStoreState<unknown>,
  'open' | 'preventUnmountingOnClose' | 'activeTriggerId' | 'activeTriggerElement'
>;

export function createPopupOpenState(
  state: PopupOpenState,
  open: boolean,
  trigger: Element | undefined,
  preventUnmountOnClose = false,
): PopupOpenState {
  let preventUnmountingOnClose = state.preventUnmountingOnClose;
  if (open) {
    preventUnmountingOnClose = false;
  } else if (preventUnmountOnClose) {
    preventUnmountingOnClose = true;
  }

  const triggerId = trigger?.id ?? null;
  let activeTriggerId = state.activeTriggerId;
  let activeTriggerElement = state.activeTriggerElement;

  if (triggerId || open) {
    activeTriggerId = triggerId;
    activeTriggerElement = trigger ?? null;
  }

  return {
    open,
    preventUnmountingOnClose,
    activeTriggerId,
    activeTriggerElement,
  };
}

export function attachPreventUnmountOnClose(eventDetails: { preventUnmountOnClose(): void }) {
  let preventUnmountOnClose = false;

  eventDetails.preventUnmountOnClose = () => {
    preventUnmountOnClose = true;
  };

  return () => preventUnmountOnClose;
}

/**
 * Runs the shared open-change sequence for a popup store: notifies `onOpenChange`, honors
 * cancellation, and commits the state update.
 */
export function applyPopupOpenChange<
  State extends PopupStoreState<unknown> & {
    instantType?: 'delay' | 'dismiss' | 'focus' | undefined;
  },
  EventDetails extends BaseUIChangeEventDetails<string>,
  ExtraKey extends keyof State = never,
>(
  store: {
    readonly context: Pick<PopupStoreContext<EventDetails>, 'onOpenChange'>;
    readonly state: State;
    update<const Key extends keyof State>(state: Pick<State, Key>): void;
  },
  nextOpen: boolean,
  eventDetails: EventDetails & { preventUnmountOnClose(): void },
  options: {
    onBeforeDispatch?: (() => void) | undefined;
    extraState?: Pick<State, ExtraKey> | undefined;
  } = {},
): void {
  const reason = eventDetails.reason;
  const isFocusOpen = nextOpen && reason === REASONS.triggerFocus;
  const isDismissClose =
    !nextOpen && (reason === REASONS.triggerPress || reason === REASONS.escapeKey);

  const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);

  store.context.onOpenChange?.(nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  options.onBeforeDispatch?.();

  const popupOpenState = createPopupOpenState(
    store.state,
    nextOpen,
    eventDetails.trigger,
    shouldPreventUnmountOnClose(),
  );

  const updatedState = { ...options.extraState, ...popupOpenState } as Pick<
    State,
    keyof PopupOpenState | ExtraKey | 'instantType'
  >;

  if (isFocusOpen) {
    updatedState.instantType = 'focus';
  } else if (isDismissClose) {
    updatedState.instantType = 'dismiss';
  }

  store.update(updatedState);
}

type PopupInteractionPropKey = 'activeTriggerProps' | 'inactiveTriggerProps' | 'popupProps';

export function usePopupInteractionProps<
  State extends PopupStoreState<unknown>,
  const Key extends keyof State,
>(
  store: SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>,
  statePart: Pick<State, Key | PopupInteractionPropKey>,
) {
  store.useSyncedValues(statePart);

  onCleanup(() => {
    store.update({
      activeTriggerProps: EMPTY_OBJECT,
      inactiveTriggerProps: EMPTY_OBJECT,
      popupProps: EMPTY_OBJECT,
    } as Partial<State>);
  });
}

export function usePopupRootSync<
  State extends PopupStoreState<unknown> & {
    openMethod: InteractionType | null;
  },
>(
  store: SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>,
  open: Accessor<boolean>,
) {
  createTrackedEffect(() => {
    if (!open() && store.state.openMethod !== null) {
      store.set('openMethod' as any, null);
    }
  });

  onCleanup(() => {
    if (store.state.openMethod !== null) {
      store.set('openMethod' as any, null);
    }
  });
}

/**
 * Returns a callback ref that registers/unregisters the trigger element in the store.
 *
 * @param store The Store instance where the trigger should be registered.
 */
export function useTriggerRegistration<State extends PopupStoreState<any>>(props: {
  id: string | undefined;
  store: SolidStore<State, PopupStoreContext<any>, PopupStoreSelectors>;
}) {
  const store = untrack(() => props.store);
  // Keep track of the currently registered element to unregister it on unmount or id change.
  let registeredElementIdRef = null as string | null;
  let registeredElementRef = null as Element | null;

  function registerTrigger(element: Element | null | undefined) {
    const id = props.id;
    if (id === undefined) {
      return;
    }

    if (registeredElementIdRef !== null) {
      const registeredId = registeredElementIdRef;
      const registeredElement = registeredElementRef;
      const currentElement = store.context.triggerElements.getById(registeredId);

      if (registeredElement && currentElement === registeredElement) {
        store.context.triggerElements.delete(registeredId);
      }

      registeredElementIdRef = null;
      registeredElementRef = null;
    }

    if (element != null) {
      registeredElementIdRef = id;
      registeredElementRef = element;
      store.context.triggerElements.add(id, element);
    }
  }

  return registerTrigger;
}

/**
 * Sets up trigger data forwarding to the store.
 *
 * @param triggerId Id of the trigger.
 * @param triggerElement The trigger DOM element.
 * @param store The Store instance managing the popup state.
 * @param stateUpdates An object with state updates to apply when the trigger is active.
 */
export function useTriggerDataForwarding<State extends PopupStoreState<any>>(props: {
  triggerId: string | undefined;
  triggerElement: Element | null | undefined;
  store: SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>;
  stateUpdates: Record<string, unknown>;
}) {
  const store = untrack(() => props.store);
  const isMountedByThisTrigger = store.useState('isMountedByTrigger', () => props.triggerId);

  const baseRegisterTrigger = useTriggerRegistration({
    get id() {
      return props.triggerId;
    },
    get store() {
      return store;
    },
  });

  const registerTrigger = (element: Element | null | undefined) => {
    baseRegisterTrigger(element);

    if (!element || !store.select('open')) {
      return;
    }

    const activeTriggerId = store.select('activeTriggerId');

    if (activeTriggerId === props.triggerId) {
      store.update({
        activeTriggerElement: element,
        ...props.stateUpdates,
      } as Partial<State>);
      return;
    }

    if (activeTriggerId == null) {
      // This runs when popup is open, but no active trigger is set.
      // It can happen when using controlled mode and the trigger is mounted after opening or if `triggerId` prop is not set explicitly.
      // In such cases the first trigger to run this code becomes the active trigger (store.select('activeTriggerId') should not return null after that).
      // This is mostly for compatibility with contained triggers where no explicit `triggerId` was required in controlled mode.
      store.update({
        activeTriggerElement: element,
        activeTriggerId: props.triggerId,
        ...props.stateUpdates,
      } as Partial<State>);
    }
  };

  createTrackedEffect(() => {
    if (isMountedByThisTrigger()) {
      store.update({
        activeTriggerElement: props.triggerElement,
        ...props.stateUpdates,
      } as Partial<State>);
    }
  });

  return { isMountedByThisTrigger, registerTrigger };
}

export type PayloadChildRenderFunction<Payload> = (arg: {
  payload: Payload | undefined;
}) => JSX.Element;

/**
 * Ensures that when there's only one trigger element registered, it is set as the active trigger.
 * This allows controlled popups to work correctly without an explicit triggerId, maintaining compatibility
 * with the contained triggers.
 *
 * This should be called on the Root part.
 *
 * @param open Whether the popup is open.
 * @param store The Store instance managing the popup state.
 */
export function useImplicitActiveTrigger<State extends PopupStoreState<any>>(props: {
  store: SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>;
}) {
  const store = untrack(() => props.store);
  const open = store.useState('open');

  createTrackedEffect(() => {
    if (open() && !store.select('activeTriggerId') && store.context.triggerElements.size === 1) {
      const iteratorResult = store.context.triggerElements.entries().next();
      if (!iteratorResult.done) {
        const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
        store.update({
          activeTriggerElement: implicitTriggerElement,
          activeTriggerId: implicitTriggerId,
        } as Partial<State>);
      }
    }
  });
}

/**
 * Mangages the mounted state of the popup.
 * Sets up the transition status listeners and handles unmounting when needed.
 * Updates the `mounted` and `transitionStatus` states in the store.
 *
 * @param open Whether the popup is open.
 * @param store The Store instance managing the popup state.
 * @param onUnmount Optional callback to be called when the popup is unmounted.
 *
 * @returns A function to forcibly unmount the popup.
 */
export function useOpenStateTransitions<State extends PopupStoreState<any>>(props: {
  open: boolean;
  store: SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>;
  onUnmount?: () => void;
}) {
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(() => props.open);
  const store = untrack(() => props.store);

  store.useSyncedValues({ mounted, transitionStatus });

  const forceUnmount = () => {
    setMounted(false);
    store.update({
      activeTriggerElement: null,
      activeTriggerId: null,
      mounted: false,
    } as Partial<State>);
    props.onUnmount?.();
    store.context.onOpenChangeComplete?.(false);
  };

  const preventUnmountingOnClose = store.useState('preventUnmountingOnClose');

  useOpenChangeComplete({
    get enabled() {
      return !preventUnmountingOnClose();
    },
    onComplete() {
      if (!props.open) {
        forceUnmount();
      }
    },
    get open() {
      return props.open;
    },
    get ref() {
      return store.context.popupRef.current;
    },
  });

  return { forceUnmount, transitionStatus };
}
