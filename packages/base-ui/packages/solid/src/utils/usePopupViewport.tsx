/* eslint-disable typescript/no-explicit-any -- generic store across all popup variants */
import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  onSettled,
  Show,
  untrack,
} from 'solid-js';
import type { Accessor, ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDirection } from '../direction-provider';
import { Dimensions } from '../floating-ui-solid/types';
import type { SolidStore } from './store/SolidStoreV2';
import { Side } from './useAnchorPositioning';
import { flushSync } from './flushSync';
import { useAnimationFrame } from './useAnimationFrame';
import { useAnimationsFinished } from './useAnimationsFinished';
import { usePopupAutoResize } from './usePopupAutoResize';
import { usePreviousValue } from './usePreviousValue';
import { adaptiveOrigin } from './adaptiveOriginMiddleware';
import { on } from '../solid-1-compat';
import { createDepsEffect } from '../solid-helpers';

export type PopupViewportCssVars = {
  /**
   * CSS variable name storing the popup width for the previous content snapshot.
   */
  popupWidth: string;
  /**
   * CSS variable name storing the popup height for the previous content snapshot.
   */
  popupHeight: string;
};

export interface PopupViewportState {
  /**
   * Direction from which the popup was activated, used for directional animations.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
}

type PopupViewportStore = Pick<SolidStore<any, any, any>, 'useState' | 'set' | 'select'>;

export interface UsePopupViewportParameters {
  /**
   * Popup store instance for accessing shared popup state.
   */
  store: PopupViewportStore;
  /**
   * Side of the positioner relative to the trigger.
   */
  side: Side;
  /**
   * CSS variable names used for sizing the previous content snapshot.
   */
  cssVars: PopupViewportCssVars;
  /**
   * Viewport children to render in the current container.
   */
  children?: JSX.Element;
}

export interface UsePopupViewportResult {
  /**
   * The viewport children wrapped in current/previous containers as needed.
   */
  children: JSX.Element;
  /**
   * Viewport state used for data attributes and render prop styling.
   */
  state: PopupViewportState;
}

/**
 * Builds morphing viewport containers for popups that animate between trigger-based content.
 * Handles previous-content snapshots, auto-resize, and state attributes for transitions.
 */
export function usePopupViewport(parameters: UsePopupViewportParameters): UsePopupViewportResult {
  const direction = useDirection();
  const activeTrigger = parameters.store.useState('activeTriggerElement');
  const activeTriggerId = parameters.store.useState('activeTriggerId');
  const open = parameters.store.useState('open');
  const payload = parameters.store.useState('payload');
  const mounted = parameters.store.useState('mounted');
  const popupElement = parameters.store.useState('popupElement');
  const positionerElement = parameters.store.useState('positionerElement');

  const previousActiveTrigger = usePreviousValue(() => (open() ? activeTrigger() : null));
  const currentContentKey = usePopupContentKey({
    activeTriggerId,
    payload,
  });

  let capturedNodeRef = null as HTMLElement | null | undefined;
  const [previousContentNode, setPreviousContentNode] = createSignal<
    HTMLElement | null | undefined
  >(null);

  const [newTriggerOffset, setNewTriggerOffset] = createSignal<Offset | null>(null);

  let currentContainerRef: HTMLDivElement | undefined;
  let previousContainerRef: HTMLDivElement | undefined;

  const onAnimationsFinished = useAnimationsFinished(() => currentContainerRef, true, false);
  const cleanupFrame = useAnimationFrame();
  let cleanupControllerRef: AbortController | null = null;

  const [previousContentDimensions, setPreviousContentDimensions] = createSignal<{
    width: number;
    height: number;
  } | null>(null);

  const [showStartingStyleAttribute, setShowStartingStyleAttribute] = createSignal(false);

  createRenderEffect(
    () => parameters.store,
    (store) => {
      store.set('adaptiveOrigin', adaptiveOrigin);
      return () => {
        store.set('adaptiveOrigin', undefined);
      };
    },
  );

  const handleMeasureLayout = () => {
    currentContainerRef?.style.setProperty('animation', 'none');
    currentContainerRef?.style.setProperty('transition', 'none');

    previousContainerRef?.style.setProperty('display', 'none');
  };

  const handleMeasureLayoutComplete = (previousDimensions: Dimensions | null) => {
    currentContainerRef?.style.removeProperty('animation');
    currentContainerRef?.style.removeProperty('transition');

    previousContainerRef?.style.removeProperty('display');

    if (previousDimensions) {
      setPreviousContentDimensions(previousDimensions);
    }
  };

  const armViewportCleanup = () => {
    cleanupControllerRef?.abort();
    const controller = new AbortController();
    cleanupControllerRef = controller;
    onAnimationsFinished(() => {
      setPreviousContentNode(null);
      setPreviousContentDimensions(null);
      capturedNodeRef = null;
    }, controller.signal);
  };

  let lastHandledTriggerRef = null as Element | null | undefined;

  createDepsEffect(
    () => ({ open: open(), mounted: mounted() }),
    (state) => {
      if (!state.open || !state.mounted) {
        lastHandledTriggerRef = null;
      }
    },
  );

  createDepsEffect(
    () => ({ current: activeTrigger(), previous: previousActiveTrigger() }),
    ({ current, previous }) => {
      // When a trigger changes, set the captured children HTML to state,
      // so we can render both new and old content.
      if (
        current &&
        previous &&
        current !== previous &&
        lastHandledTriggerRef !== current &&
        capturedNodeRef
      ) {
        setPreviousContentNode(capturedNodeRef);
        setShowStartingStyleAttribute(true);

        // Calculate the relative position between the previous and new trigger,
        // so we can pass it to the style hook for animation purposes.
        const offset = calculateRelativePosition(previous, current);
        setNewTriggerOffset(offset);

        lastHandledTriggerRef = current;
      }
    },
  );

  // Arm cleanup after a trigger change, and re-arm it if the current container remounts
  // mid-transition when a lagging payload bumps `currentContentKey`. The remount discards
  // the running entry animation (and with transition-style CSS the replacement mounts at
  // final styles with no animation at all), so re-run the starting-style choreography —
  // otherwise the watcher either strands or fires before the previous container's exit
  // animation finishes.
  createDepsEffect(
    () => ({ contentKey: currentContentKey(), previousContentNode: previousContentNode() }),
    (deps) => {
      if (deps.previousContentNode == null) {
        return;
      }

      // Abort the stale watcher synchronously. The remount cancels the old container's
      // animations, and the resulting promise rejection would otherwise run the cleanup
      // in a microtask before the re-armed watcher below is in place.
      cleanupControllerRef?.abort();

      setShowStartingStyleAttribute(true);

      // Solid: wait a second frame. Solid flushes a write made in a rAF before that frame's
      // style recalc, so `[data-starting-style]` must be painted once before it is removed.
      cleanupFrame.request(() => {
        cleanupFrame.request(() => {
          flushSync(() => {
            setShowStartingStyleAttribute(false);
          });
          armViewportCleanup();
        });
      });
    },
  );

  // Capture a clone of the current content DOM subtree when not transitioning.
  // We can't store previous React nodes as they may be stateful; instead we capture DOM clones for visual continuity.
  createEffect(
    ...on(currentContentKey, () => {
      let cancelled = false;

      queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        // When a transition is in progress, we store the next content in capturedNodeRef.
        // This handles the case where the trigger changes multiple times before the transition finishes.
        // We want to always capture the latest content for the previous snapshot.
        // So clicking quickly on T1, T2, T3 will result in the following sequence:
        // 1. T1 -> T2: previousContent = T1, currentContent = T2
        // 2. T2 -> T3: previousContent = T2, currentContent = T3
        const source = currentContainerRef;
        if (!source) {
          return;
        }

        const wrapper = document.createElement('div');
        for (const child of Array.from(source.childNodes)) {
          wrapper.appendChild(child.cloneNode(true));
        }

        capturedNodeRef = wrapper;
      });

      return () => {
        cancelled = true;
      };
    }),
  );

  const isTransitioning = () => previousContentNode() != null;

  // When previousContentNode is present, imperatively populate the previous container with the cloned children.
  createEffect(
    ...on(previousContentNode, (contentNode) => {
      if (!contentNode) {
        return;
      }

      let cancelled = false;

      queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        const container = previousContainerRef;
        if (!container) {
          return;
        }

        container.replaceChildren(...Array.from(contentNode.childNodes));
      });

      return () => {
        cancelled = true;
      };
    }),
  );

  usePopupAutoResize({
    content: payload,
    direction,
    mounted,
    onMeasureLayout: handleMeasureLayout,
    onMeasureLayoutComplete: handleMeasureLayoutComplete,
    popupElement,
    positionerElement,
    side: () => parameters.side,
  });

  const state: PopupViewportState = {
    get activationDirection() {
      return getActivationDirection(newTriggerOffset());
    },
    get transitioning() {
      return isTransitioning();
    },
  };

  function ContainerComponent(props: ParentProps<{ 'data-starting-style'?: '' | undefined }>) {
    return <div data-current ref={currentContainerRef} {...props} />;
  }

  function CurrentContainer(props: ParentProps<{ 'data-starting-style'?: '' | undefined }>) {
    return (
      // Keyed: a new content key remounts the container, as React's `key`.
      <Show when={currentContentKey()} keyed>
        <ContainerComponent {...props}>{parameters.children}</ContainerComponent>
      </Show>
    );
  }

  return {
    get children() {
      return (
        <>
          <Show when={!isTransitioning()}>
            {<CurrentContainer>{parameters.children}</CurrentContainer>}
          </Show>
          <Show when={isTransitioning()}>
            <div
              data-previous
              inert={true}
              ref={previousContainerRef}
              style={{
                [parameters.cssVars.popupWidth]: `${previousContentDimensions()?.width}px`,
                [parameters.cssVars.popupHeight]: `${previousContentDimensions()?.height}px`,
                position: 'absolute',
              }}
              data-ending-style={showStartingStyleAttribute() ? undefined : ''}
            />
            <CurrentContainer data-starting-style={showStartingStyleAttribute() ? '' : undefined}>
              {parameters.children}
            </CurrentContainer>
          </Show>
        </>
      );
    },
    state,
  };
}

type Offset = {
  horizontal: number;
  vertical: number;
};

/**
 * Returns a string describing the provided offset.
 * It describes both the horizontal and vertical offset, separated by a space.
 *
 * @param offset
 */
function getActivationDirection(offset: Offset | null): string | undefined {
  if (!offset) {
    return undefined;
  }

  return `${getValueWithTolerance(offset.horizontal, 5, 'right', 'left')} ${getValueWithTolerance(offset.vertical, 5, 'down', 'up')}`;
}

/**
 * Returns a label describing the value (positive/negative) treating values
 * within tolerance as zero.
 *
 * @param value Value to check
 * @param tolerance Tolerance to treat the value as zero.
 * @param positiveLabel
 * @param negativeLabel
 * @returns If 0 < abs(value) < tolerance, returns an empty string. Otherwise returns positiveLabel or negativeLabel.
 */
function getValueWithTolerance(
  value: number,
  tolerance: number,
  positiveLabel: string,
  negativeLabel: string,
) {
  if (value > tolerance) {
    return positiveLabel;
  }

  if (value < -tolerance) {
    return negativeLabel;
  }

  return '';
}

/**
 * Calculates the relative position between centers of two elements.
 */
function calculateRelativePosition(from: Element, to: Element): Offset {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();

  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2,
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2,
  };

  return {
    horizontal: toCenter.x - fromCenter.x,
    vertical: toCenter.y - fromCenter.y,
  };
}

/**
 * Returns a key that forces remounting content when triggers change or a payload is updated.
 */
function usePopupContentKey(parameters: {
  activeTriggerId: Accessor<string | null>;
  payload: Accessor<unknown>;
}): Accessor<string> {
  const [contentKey, setContentKey] = createSignal(0);
  // Initial values for the first comparison, as React's refs.
  let previousActiveTriggerIdRef = untrack(parameters.activeTriggerId);
  let previousPayloadRef = untrack(parameters.payload);
  let pendingPayloadUpdateRef = false;

  createDepsEffect(
    () => ({ activeTriggerId: parameters.activeTriggerId(), payload: parameters.payload() }),
    ({ activeTriggerId, payload }) => {
      // Compare against the last committed values to decide whether we need a new DOM subtree.
      const triggerIdChanged = activeTriggerId !== previousActiveTriggerIdRef;
      const payloadChanged = payload !== previousPayloadRef;

      if (triggerIdChanged) {
        // Remount immediately on trigger change; remember if payload hasn't caught up yet.
        setContentKey((value) => value + 1);
        pendingPayloadUpdateRef = !payloadChanged;
      } else if (pendingPayloadUpdateRef && payloadChanged) {
        // Payload arrived a render later, so remount once more to avoid reusing the old <img>.
        setContentKey((value) => value + 1);
        pendingPayloadUpdateRef = false;
      }

      // Persist current values for the next render's comparison.
      previousActiveTriggerIdRef = activeTriggerId;
      previousPayloadRef = payload;
    },
  );

  const key = createMemo(() => `${parameters.activeTriggerId() ?? 'current'}-${contentKey()}`);
  return key;
}
