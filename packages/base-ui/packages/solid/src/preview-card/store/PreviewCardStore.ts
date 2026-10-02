import { untrack } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';
import { NullStore } from '../../utils/NullStore';
import {
  applyPopupOpenChange,
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  InlineRectCoords,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  type PopupTriggerStoreKeys,
  updateInlineRectCoords,
} from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { type PreviewCardRoot } from '../root/PreviewCardRoot';
import { CLOSE_DELAY } from '../utils/constants';
import type { AdaptiveOriginMiddleware } from '../../utils/adaptiveOriginConstants';

export type State<Payload> = PopupStoreState<Payload> & {
  instantType: 'dismiss' | 'focus' | undefined;
  // Solid: the viewport flags itself here; the positioner derives the adaptive-origin middleware.
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
  closeDelay: number;
};

export type Context = PopupStoreContext<PreviewCardRoot.ChangeEventDetails> & {
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  inlineRectCoordsRef: ReactLikeRef<InlineRectCoords | undefined>;
};

const selectors = {
  ...popupStoreSelectors,
  instantType: (state: State<unknown>) => state.instantType,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
  closeDelay: (state: State<unknown>) => state.closeDelay,
};

type Selectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `PreviewCardStore`
 * and the inert fallback store satisfy it, so a trigger can read from whichever store the handle
 * currently exposes. Narrowed to the trigger-data members a trigger uses; it exposes no popup-open
 * mutator, so the inert fallback can be a plain `NullStore`.
 */
export type PreviewCardHandleStore<Payload> = Pick<
  PreviewCardStore<Payload>,
  PopupTriggerStoreKeys
>;

export function PreviewCardStore<Payload>(
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
    eventDetails: Omit<PreviewCardRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => {
    const { inlineRectCoordsRef } = store.context;

    applyPopupOpenChange(store, nextOpen, eventDetails as PreviewCardRoot.ChangeEventDetails, {
      onBeforeDispatch() {
        // Capture the hovered inline-rect coordinates so the card anchors to the
        // exact point on the link that was hovered.
        const event = eventDetails.event;
        if (
          nextOpen &&
          eventDetails.reason === REASONS.triggerHover &&
          eventDetails.trigger &&
          'clientX' in event &&
          'clientY' in event &&
          inlineRectCoordsRef.current?.element !== eventDetails.trigger
        ) {
          updateInlineRectCoords(
            inlineRectCoordsRef,
            eventDetails.trigger,
            event.clientX,
            event.clientY,
          );
        }
      },
    });
  };

  return { ...store, setOpen };
}

export type PreviewCardStore<Payload> = ReturnType<typeof PreviewCardStore<Payload>>;

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `PreviewCard.Root` is attached. It preserves a preview-card-specific trigger registry in context
 * so detached triggers can register before migrating to the live root store.
 */
export function createNullPreviewCardStore<Payload>(): PreviewCardHandleStore<Payload> {
  const triggerElements = new PopupTriggerMap();

  // Solid: the state is not frozen because Solid stores mark their source object.
  return NullStore<State<Payload>, Context, Selectors>(
    createInitialStateSnapshot<Payload>(),
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
      instantType: undefined,
      adaptiveOrigin: undefined,
      closeDelay: CLOSE_DELAY,
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
    inlineRectCoordsRef: { current: undefined },
  };
}
