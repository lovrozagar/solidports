
import { useSyncedFloatingRootContext } from '../../floating-ui-solid/hooks/useSyncedFloatingRootContext';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import type { ReactLikeRef } from '../../solid-helpers';
import {
  createInitialPopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
} from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type PreviewCardRoot } from '../root/PreviewCardRoot';
import { CLOSE_DELAY } from '../utils/constants';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export type State<Payload> = PopupStoreState<Payload> & {
  instantType: 'dismiss' | 'focus' | undefined;
  hasViewport: boolean;
};

type Context = PopupStoreContext<PreviewCardRoot.ChangeEventDetails> & {
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly closeDelayRef: ReactLikeRef<number>;
};

const selectors = {
  ...popupStoreSelectors,
  hasViewport: (state: State<unknown>) => state.hasViewport,
  instantType: (state: State<unknown>) => state.instantType,
};

function createInitialState<Payload>(initialState: Partial<State<Payload>> = {}) {
  return createInitialPopupStoreState<Payload, State<Payload>>({
    hasViewport: false,
    instantType: undefined,
    ...initialState,
  });
}

export function PreviewCardStore<Payload>(initialState?: Partial<State<Payload>>) {
  const [state, setState] = createInitialState(initialState);
  const store = SolidStore<State<Payload>, Context, typeof selectors>(
    [state, setState],
    {
      closeDelayRef: { current: CLOSE_DELAY },
      floatingRootContext: getEmptyRootContext(),
      onOpenChange: undefined,
      onOpenChangeComplete: undefined,
      popupRef: { current: null },
      triggerElements: new PopupTriggerMap(),
    },
    selectors,
  );

  function setOpen(
    nextOpen: boolean,
    eventDetails: Omit<PreviewCardRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    const reason = eventDetails.reason;
    const isHover = reason === REASONS.triggerHover;
    const isFocusOpen = nextOpen && reason === REASONS.triggerFocus;
    const isDismissClose =
      !nextOpen && (reason === REASONS.triggerPress || reason === REASONS.escapeKey);

    (eventDetails as PreviewCardRoot.ChangeEventDetails).preventUnmountOnClose = () => {
      store.set('preventUnmountingOnClose', true);
    };

    store.context.onOpenChange?.(nextOpen, eventDetails as PreviewCardRoot.ChangeEventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    /* Notify floating-ui interaction hooks (useHover, useFocus) of the open change. */
    if (!store.context.floatingRootContext.context.syncOnly) {
      store.context.floatingRootContext.context.events.emit('openchange', {
        nativeEvent: eventDetails.event,
        nested: false,
        open: nextOpen,
        reason: eventDetails.reason,
      });
    }

    const changeState = () => {
      const updatedState: Partial<State<Payload>> = { open: nextOpen };
      if (isFocusOpen) {
        updatedState.instantType = 'focus';
      } else if (isDismissClose) {
        updatedState.instantType = 'dismiss';
      } else if (reason === REASONS.triggerHover) {
        updatedState.instantType = undefined;
      }

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
      changeState();
    } else {
      changeState();
    }
  }

  const merged = solidMergeProps(store, { setOpen });
  return merged;
}

PreviewCardStore.useStore = <Payload>(
  externalStore: ReturnType<typeof PreviewCardStore<Payload>> | undefined,
  initialState?: Partial<State<Payload>>,
): PreviewCardStore<Payload> => {
  const store = externalStore ?? PreviewCardStore<Payload>(initialState);
  const floatingRootContext = useSyncedFloatingRootContext({
    onOpenChange: store.setOpen,
    popupStore: store,
  });
  store.context.floatingRootContext = floatingRootContext;
  return store;
};

export type PreviewCardStore<Payload> = ReturnType<typeof PreviewCardStore<Payload>>;
