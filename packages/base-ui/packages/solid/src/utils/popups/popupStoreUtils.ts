/* eslint-disable typescript/no-explicit-any -- popup utils accept arbitrary State extends PopupStoreState; carrying generic Payload through every helper would balloon signatures */
import { createMemo, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFloatingParentNodeId } from '../../floating-ui-solid/components/FloatingTree';
import { FOCUSABLE_ATTRIBUTE } from '../../floating-ui-solid/utils/constants';
import { useSyncedFloatingRootContext } from '../../floating-ui-solid/hooks/useSyncedFloatingRootContext';
import { EMPTY_OBJECT } from '../empty';
import { SolidStore } from '../store/SolidStoreV2';
import type { HTMLProps } from '../types';
import { useId } from '../useId';
import type { InteractionType } from '../useEnhancedClickHandler';
import { useOpenChangeComplete } from '../useOpenChangeComplete';
import { useTransitionStatus } from '../useTransitionStatus';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../createBaseUIEventDetails';
import { REASONS } from '../reasons';
import { flushSync } from '../flushSync';
import {
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerDataStore,
} from './store';
import {
  access,
  createDepsRenderEffect,
  type MaybeAccessor,
  type ReactLikeRef, createLayoutEffect } from '../../solid-helpers';
import type { FloatingRootStore } from '../../floating-ui-solid/components/FloatingRootStoreV2';

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

type PopupStoreWithOpen<
  State extends PopupStoreState<any>,
  SetOpenEventDetails extends BaseUIChangeEventDetails<string>,
> = PopupTriggerDataStore<State> &
  Pick<SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>, 'useSyncedValue'> & {
    readonly context: { readonly floatingRootContext: FloatingRootStore };
    setOpen(open: boolean, eventDetails: SetOpenEventDetails): void;
  };

/**
 * The subset of a popup handle that a Root needs to bind its store to. Both the real handle classes
 * and any test double satisfy it.
 */
export interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

/**
 * Creates and owns a popup store on behalf of a Root part. The store is created exactly once, with
 * controlled props and root state synced separately after creation. Sets up the synced floating
 * root context and returns the store.
 *
 * Solid popup stores keep the floating root on `store.context.floatingRootContext` (React keeps it
 * in state); it is created with the store and never replaced, so both are equivalent.
 *
 * @param createStore Factory that builds the store. Called exactly once, receiving the floating id
 * and whether the popup is nested inside another floating element, both resolved on the first render.
 * @param treatPopupAsFloatingElement Whether the popup element is passed to Floating UI as the
 * floating element instead of the default positioner.
 */
export function usePopupRootStore<
  State extends PopupStoreState<any>,
  SetOpenEventDetails extends BaseUIChangeEventDetails<string>,
  Store extends PopupStoreWithOpen<State, SetOpenEventDetails>,
>(
  createStore: (floatingId: string | undefined, nested: boolean) => Store,
  treatPopupAsFloatingElement = false,
): Store {
  const floatingId = useId();
  const nested = useFloatingParentNodeId() != null;

  const store = untrack(() => createStore(floatingId(), nested));

  useSyncedFloatingRootContext({
    popupStore: store as any,
    treatPopupAsFloatingElement,
    floatingRootContext: store.context.floatingRootContext,
    floatingId,
    nested,
    onOpenChange: store.setOpen as any,
  });

  return store;
}

/**
 * Attaches a Root's store to a handle for this component's committed lifetime. Popup Roots render
 * it before their interactions and user children so its effect runs before descendant effects.
 */
export function PopupHandleAttachment<Store>(props: {
  handle: PopupRootStoreHandle<Store>;
  store: Store;
}) {
  // Render-effect timing (React's layout effect): the handle is attached before any `onSettled`
  // in the same mount, so `handle.open()` from a mount callback reaches this Root. User effects
  // run after `onSettled`.
  createDepsRenderEffect(
    () => ({ handle: props.handle, store: props.store }),
    ({ handle, store }) => handle.attachStore(store),
  );

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
 * Runs the shared open-change sequence for a popup store: notifies `onOpenChange`,
 * honors cancellation, dispatches the floating root change, maps the reason to an
 * `instantType`, and commits the state update (synchronously for hover so
 * `getAnimations()` observes it). Stores supply their own differences via
 * `extraState` (e.g. the last change reason) and `onBeforeDispatch` (e.g. updating
 * inline-rect coordinates).
 */
export function applyPopupOpenChange<
  State extends PopupStoreState<unknown> & {
    instantType?: 'delay' | 'dismiss' | 'focus' | undefined;
  },
  EventDetails extends BaseUIChangeEventDetails<string>,
  ExtraKey extends keyof State = never,
>(
  store: {
    readonly context: Pick<PopupStoreContext<EventDetails>, 'onOpenChange' | 'floatingRootContext'>;
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
  const isHover = reason === REASONS.triggerHover;
  const isFocusOpen = nextOpen && reason === REASONS.triggerFocus;
  const isDismissClose =
    !nextOpen && (reason === REASONS.triggerPress || reason === REASONS.escapeKey);

  const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);

  store.context.onOpenChange?.(nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  options.onBeforeDispatch?.();

  store.context.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

  const changeState = () => {
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
    } else if (isHover) {
      updatedState.instantType = undefined;
    }

    store.update(updatedState);
  };

  if (isHover) {
    // Flush synchronously for hover so `node.getAnimations()` sees the new state.
    flushSync(changeState);
  } else {
    changeState();
  }
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
  // React clears `openMethod` in a layout effect once closed. Solid derives it: the trigger's write
  // stands while open, and closing resets it in the same flush.
  store.useSyncedValue('openMethod', (prev) => (open() ? prev : null));

  onCleanup(() => {
    if (store.state.openMethod !== null) {
      store.set('openMethod' as any, null);
    }
  });
}

function syncTriggerCount<State extends PopupStoreState<any>>(store: PopupTriggerDataStore<State>) {
  const triggerCount = store.context.triggerElements.size;
  if (store.select('open') && store.state.triggerCount !== triggerCount) {
    store.set('triggerCount', triggerCount as State['triggerCount']);
  }
}

/**
 * Returns a stable callback ref that registers/unregisters the trigger element in the store.
 *
 * Stable so a ref merger that retains the callback it was first given still reaches the trigger's
 * current store. The registration is tracked as a `(store, id, element)` triple, so unregistering
 * targets the store the element was actually registered in.
 *
 * Since the callback never changes, the caller must re-run it from a render effect keyed on
 * `[store, id]` to migrate an already-registered element. That effect is also what registers the
 * element when `id` only resolves after the first render, because the register call made while the
 * id is still `undefined` does nothing.
 *
 * @param id Id of the trigger.
 * @param store The Store instance where the trigger should be registered.
 */
export function useTriggerRegistration<State extends PopupStoreState<any>>(
  id: MaybeAccessor<string | undefined>,
  store: MaybeAccessor<PopupTriggerDataStore<State>>,
) {
  let registration: {
    store: PopupTriggerDataStore<State>;
    id: string;
    element: Element;
  } | null = null;

  return (element: Element | null | undefined) => {
    // A ref callback: it acts on the latest id and store.
    const currentId = untrack(() => access(id));
    const currentStore = untrack(() => access(store));

    if (registration !== null) {
      if (
        registration.element === element &&
        registration.store === currentStore &&
        registration.id === currentId
      ) {
        // Already registered where it belongs, so the caller's migration effect is free on mount.
        return;
      }

      const registered = registration;
      registration = null;
      if (registered.store.context.triggerElements.getById(registered.id) === registered.element) {
        registered.store.context.triggerElements.delete(registered.id);
        syncTriggerCount(registered.store);
      }
    }

    if (element != null && currentId !== undefined) {
      registration = { store: currentStore, id: currentId, element };
      currentStore.context.triggerElements.add(currentId, element);
      syncTriggerCount(currentStore);
    }
  };
}

/**
 * Sets up trigger data forwarding to the store.
 *
 * @param triggerId Id of the trigger.
 * @param triggerElementRef Ref for the trigger DOM element.
 * @param store The Store instance managing the popup state.
 * @param stateUpdates An object with state updates to apply when the trigger is active. Its
 * properties may be getters; they are read when applied.
 */
export function useTriggerDataForwarding<
  State extends PopupStoreState<any>,
  const Key extends keyof Omit<State, 'activeTriggerId' | 'activeTriggerElement'>,
>(
  triggerId: Accessor<string | undefined>,
  triggerElementRef: ReactLikeRef<Element | null | undefined>,
  store: MaybeAccessor<PopupTriggerDataStore<State>>,
  stateUpdates: Pick<State, Key>,
) {
  const currentStore = () => access(store);
  const isMountedByThisTrigger = createMemo(() =>
    currentStore().select('isMountedByTrigger', triggerId),
  );

  const baseRegisterTrigger = useTriggerRegistration(triggerId, store);

  const readStateUpdates = () => ({ ...stateUpdates });

  // Applies trigger-owned state (active-trigger ownership and payload) when the trigger registers.
  // It reads the latest values when invoked.
  const applyTriggerData = (element: Element) =>
    untrack(() => {
      const targetStore = currentStore();
      const open = targetStore.select('open');
      const activeTriggerId = targetStore.select('activeTriggerId');
      const id = triggerId();

      if (activeTriggerId === id) {
        targetStore.update({
          activeTriggerElement: element,
          ...(open ? readStateUpdates() : null),
        } as Partial<State>);
        return;
      }

      if (activeTriggerId == null && open) {
        // If a popup is already open, a detached trigger can mount before any active trigger
        // has been established. Claim the first registered trigger so trigger-owned focus
        // management and ARIA relationships work.
        targetStore.update({
          activeTriggerId: id ?? null,
          activeTriggerElement: element,
          ...readStateUpdates(),
        } as Partial<State>);
      }
    });

  // Stable, so the ref on the rendered element keeps its identity for the trigger's whole lifetime.
  const registerTrigger = (element: Element | null | undefined) => {
    baseRegisterTrigger(element);
    if (element) {
      applyTriggerData(element);
    }
  };

  // A stable ref does not re-fire on a store or id change, so migrate here instead: unregister from
  // the previous store, then register the element the trigger still renders into the current one.
  createDepsRenderEffect(
    () => [currentStore(), triggerId()],
    () => {
      registerTrigger(triggerElementRef.current);
      return () => registerTrigger(null);
    },
  );

  createDepsRenderEffect(
    () => [isMountedByThisTrigger(), currentStore(), ...Object.values(readStateUpdates())],
    ([isMounted, targetStore]) => {
      if (isMounted) {
        (targetStore as PopupTriggerDataStore<State>).update({
          activeTriggerElement: triggerElementRef.current,
          ...untrack(readStateUpdates),
        } as Partial<State>);
      }
    },
  );

  return { registerTrigger, isMountedByThisTrigger };
}

export type PayloadChildRenderFunction<Payload> = (arg: {
  payload: Payload | undefined;
}) => JSX.Element;

/**
 * Keeps trigger registration state synchronized while the popup is open.
 *
 * When a popup opens without an explicit trigger id and exactly one trigger is registered, that
 * trigger is claimed as the active trigger. When the active trigger id is still registered but its
 * element changed, the active element is refreshed. When the active trigger id is missing from the
 * registry but the same element is still registered under a different id (e.g. the rendered trigger
 * carries its own DOM `id` that differs from Base UI's internal trigger id), the active id is
 * reassociated to the registered id instead of being treated as lost. When the active trigger
 * unregisters, the default path preserves existing ownership so non-closing popup families do not
 * silently claim a different trigger while staying open.
 *
 * If `closeOnActiveTriggerUnmount` is enabled, unregistering a previously resolved active trigger
 * requests a close after a microtask so a same-tick replacement trigger with the same id can
 * register first. An active trigger id that has not matched a registered trigger yet is treated as
 * pending and does not request a close.
 *
 * This should be called on the Root part.
 *
 * @param store The Store instance managing the popup state.
 * @param options Options for active trigger unmount behavior.
 */
export function useImplicitActiveTrigger<State extends PopupStoreState<any>>(
  store: PopupStoreWithOpen<State, BaseUIChangeEventDetails<typeof REASONS.none>>,
  options: {
    closeOnActiveTriggerUnmount?: MaybeAccessor<boolean | undefined>;
  } = {},
) {
  // Distinguishes a trigger that unmounted from a new active trigger that has not hydrated yet.
  let resolvedActiveTriggerId: string | null = null;

  // Solid: the open popup's trigger count is derived from the registry. React writes it here and
  // when a trigger registers, and reruns this reconciliation on that write.
  store.useSyncedValue(
    'triggerCount',
    () =>
      (store.select('open')
        ? store.context.triggerElements.trackedSize()
        : 0) as State['triggerCount'],
  );

  createDepsRenderEffect(
    () => ({
      open: store.select('open'),
      // Rerun when the registry size changes, when ownership moves to another trigger while the
      // popup stays open, and when a pending active trigger registers in a commit where the
      // trigger count nets out unchanged.
      triggerCount: store.context.triggerElements.trackedSize(),
      activeTriggerId: store.select('activeTriggerId'),
      activeTriggerElement: store.select('activeTriggerElement'),
      closeOnActiveTriggerUnmount: Boolean(access(options.closeOnActiveTriggerUnmount)),
    }),
    ({ open, closeOnActiveTriggerUnmount }) => {
      if (!open) {
        resolvedActiveTriggerId = null;
        return;
      }

      const triggerCount = store.context.triggerElements.size;
      const stateUpdates = {} as Partial<Pick<State, 'activeTriggerId' | 'activeTriggerElement'>>;

      const currentActiveTriggerId = store.select('activeTriggerId');
      let lostActiveTriggerId: string | null = null;

      if (currentActiveTriggerId) {
        const activeTriggerElement = store.context.triggerElements.getById(currentActiveTriggerId);
        if (!activeTriggerElement) {
          for (const [triggerId, triggerElement] of store.context.triggerElements.entries()) {
            if (triggerElement === store.state.activeTriggerElement) {
              stateUpdates.activeTriggerId = triggerId;
              stateUpdates.activeTriggerElement = triggerElement;
              resolvedActiveTriggerId = triggerId;
              break;
            }
          }

          if (stateUpdates.activeTriggerId === undefined) {
            if (resolvedActiveTriggerId === currentActiveTriggerId) {
              lostActiveTriggerId = currentActiveTriggerId;
            } else {
              resolvedActiveTriggerId = null;
            }
          }
        } else {
          resolvedActiveTriggerId = currentActiveTriggerId;
          if (activeTriggerElement !== store.state.activeTriggerElement) {
            stateUpdates.activeTriggerElement = activeTriggerElement;
          }
        }
      } else {
        resolvedActiveTriggerId = null;
      }

      if (!lostActiveTriggerId && !currentActiveTriggerId && triggerCount === 1) {
        const iteratorResult = store.context.triggerElements.entries().next();
        if (!iteratorResult.done) {
          const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
          stateUpdates.activeTriggerId = implicitTriggerId;
          stateUpdates.activeTriggerElement = implicitTriggerElement;
          resolvedActiveTriggerId = implicitTriggerId;
        }
      }

      if (
        stateUpdates.activeTriggerId !== undefined ||
        stateUpdates.activeTriggerElement !== undefined
      ) {
        store.update(stateUpdates as Partial<State>);
      }

      if (lostActiveTriggerId && closeOnActiveTriggerUnmount) {
        // Defer so a same-tick replacement trigger with the same id can register first.
        queueMicrotask(() => {
          if (
            store.select('open') &&
            store.select('activeTriggerId') === lostActiveTriggerId &&
            !store.context.triggerElements.getById(lostActiveTriggerId)
          ) {
            const eventDetails = createChangeEventDetails(REASONS.none);
            store.setOpen(false, eventDetails);
            // If closing is canceled, keep the previous active trigger ownership for the
            // still-open popup instead of claiming another trigger implicitly.
            if (!eventDetails.isCanceled) {
              store.update({
                activeTriggerId: null,
                activeTriggerElement: null,
              } as Partial<State>);
            }
          }
        });
      }
    },
  );
}

/**
 * Manages the mounted state of the popup.
 * Sets up the transition status listeners and handles unmounting when needed.
 * Updates the `mounted`, `transitionStatus`, and `preventUnmountingOnClose` states in the store.
 *
 * @param open Whether the popup is open.
 * @param store The Store instance managing the popup state.
 * @param onUnmount Optional callback to be called when the popup is unmounted.
 * @param animateInitialOpen Whether a popup that mounts already open should still play its enter
 *   transition. Defaults to `false`, so content that was open on the first render (a `defaultOpen`
 *   popup on page load, SSR'd markup) appears without animating. Opt in for popups whose subtree
 *   only mounts in response to something the user did, such as a submenu inside a menu popup.
 *
 * @returns A function to forcibly unmount the popup.
 */
export function useOpenStateTransitions<State extends PopupStoreState<any>>(
  open: Accessor<boolean>,
  store: SolidStore<State, PopupStoreContext<any>, typeof popupStoreSelectors>,
  onUnmount?: () => void,
  animateInitialOpen?: MaybeAccessor<boolean | undefined>,
) {
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open, false, false, () =>
    Boolean(access(animateInitialOpen)),
  );
  const preventUnmountingOnClose = store.useState('preventUnmountingOnClose');
  // Opening starts a new close cycle (React clears it during render).
  const syncedPreventUnmountingOnClose = () => (open() ? false : preventUnmountingOnClose());

  store.useSyncedValues({ mounted, transitionStatus });

  // Reset only when opening, so the effect never writes back the value it read.
  createLayoutEffect(open, (isOpen) => {
    if (isOpen && store.state.preventUnmountingOnClose) {
      store.set('preventUnmountingOnClose', false as State['preventUnmountingOnClose']);
    }
  });

  const forceUnmount = () => {
    setMounted(false);
    store.update({
      activeTriggerId: null,
      activeTriggerElement: null,
      mounted: false,
      preventUnmountingOnClose: false,
    } as Partial<State>);
    onUnmount?.();
    store.context.onOpenChangeComplete?.(false);
  };

  useOpenChangeComplete({
    get enabled() {
      return mounted() && !open() && !syncedPreventUnmountingOnClose();
    },
    open,
    get ref() {
      return store.context.popupRef.current;
    },
    onComplete() {
      if (!untrack(open)) {
        forceUnmount();
      }
    },
  });

  return { forceUnmount, transitionStatus };
}
