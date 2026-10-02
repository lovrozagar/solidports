import { createSignal, onSettled } from 'solid-js';
import { ownerDocument } from '../../utils/owner';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../utils/useRenderElement';
import type { BaseUIComponentProps } from '../../utils/types';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { NOOP } from '../../utils/empty';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { getDisplacement, useSwipeDismiss, type SwipeDirection } from '../../utils/useSwipeDismiss';
import { getElementTransform } from '../../utils/getElementTransform';
import { DrawerPopupCssVars } from '../popup/DrawerPopupCssVars';
import { DrawerPopupDataAttributes } from '../popup/DrawerPopupDataAttributes';
import { DrawerBackdropCssVars } from '../backdrop/DrawerBackdropCssVars';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useTriggerRegistration } from '../../utils/popups';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { isVirtualClick } from '../../floating-ui-solid/utils/event';
import {
  createDepsRenderEffect,
  live,
  splitComponentProps,
  useRef,
  type ReactLikeRef,
} from '../../solid-helpers';
import { DrawerSwipeAreaDataAttributes } from './DrawerSwipeAreaDataAttributes';

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const SWIPE_AREA_OPEN_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.open]: '',
};

const SWIPE_AREA_CLOSED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.closed]: '',
};

const SWIPE_AREA_SWIPING_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.swiping]: '',
};

const SWIPE_AREA_DISABLED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.disabled]: '',
};

const stateAttributesMapping: StateAttributesMapping<DrawerSwipeAreaState> = {
  open(value) {
    return value ? SWIPE_AREA_OPEN_HOOK : SWIPE_AREA_CLOSED_HOOK;
  },
  swiping(value) {
    return value ? SWIPE_AREA_SWIPING_HOOK : null;
  },
  swipeDirection(value) {
    return { [DrawerSwipeAreaDataAttributes.swipeDirection]: value };
  },
  disabled(value) {
    return value ? SWIPE_AREA_DISABLED_HOOK : null;
  },
};

const oppositeSwipeDirection: Record<DrawerSwipeDirection, DrawerSwipeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function resolveTouchAction(direction: DrawerSwipeDirection) {
  return direction === 'left' || direction === 'right' ? 'pan-y' : 'pan-x';
}

/**
 * An invisible area that listens for swipe gestures to open the drawer.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerSwipeArea(componentProps: DrawerSwipeArea.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'swipeDirection',
  ]);
  // Solid: `live` so the swipe handlers read the latest props untracked.
  const disabled = live(() => local.disabled ?? false);
  const swipeDirectionProp = live(() => local.swipeDirection);

  const store = useDialogRootContext();
  const { swipeDirection, frontmostHeight, swipeAreaActiveRef } = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();

  const [swipeActive, setSwipeActive] = createSignal(false);

  const swipeAreaRef: ReactLikeRef<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const swipeStartEventRef = useRef<PointerEvent | TouchEvent | null>(null);
  const openedBySwipeRef = useRef(false);
  const dragDeltaRef = useRef({ x: 0, y: 0 });
  const closedOffsetRef = useRef<number | null>(null);
  const appliedSwipeStylesRef = useRef(false);
  const swipePopupElementRef = useRef<HTMLElement | null>(null);
  const swipeBackdropElementRef = useRef<HTMLElement | null>(null);
  const popupTransitionRef = useRef<string | null>(null);
  const releaseGuardCleanupRef = useRef<() => void>(NOOP);

  const swipeAreaId = useBaseUiId(() => componentProps.id);
  const registerTrigger = useTriggerRegistration(swipeAreaId, store);

  // `registerTrigger` is stable, so the ref does not re-fire when the id changes: re-register the
  // rendered element here instead. This is also what registers the swipe area when the id only
  // resolves after the first render.
  createDepsRenderEffect(
    () => [swipeAreaId(), store],
    () => {
      registerTrigger(swipeAreaRef.current);
      return () => registerTrigger(null);
    },
  );

  const open = store.useState('open');
  // Solid: read by the re-assert effect below, which stands in for React's every-commit effect.
  const mounted = store.useState('mounted');

  // Solid: the component body runs once, so these callbacks are stable without `useStableCallback`.
  const resetDragDelta = () => {
    dragDeltaRef.current.x = 0;
    dragDeltaRef.current.y = 0;
  };

  const resolvedSwipeDirection = (): DrawerSwipeDirection =>
    swipeDirectionProp() ?? oppositeSwipeDirection[swipeDirection()];
  const dismissDirection = () => oppositeSwipeDirection[resolvedSwipeDirection()];
  const enabled = () => !disabled() && (!open() || swipeActive());

  function disableDismissForSwipe() {
    releaseGuardCleanupRef.current();
    store.context.outsidePressEnabledRef.current = false;
  }

  const enableDismissAfterRelease = () => {
    releaseGuardCleanupRef.current();

    const doc = ownerDocument(swipeAreaRef.current);

    function restore(event?: MouseEvent) {
      // The gesture's trailing release click is the one physical click with no `pointerdown` of
      // its own. Ignore it and keep waiting, so it cannot dismiss the drawer it just opened,
      // while a click-only activation (keyboard or assistive tech) still re-enables in time.
      if (event?.type === 'click' && event.detail !== 0 && !isVirtualClick(event)) {
        return;
      }

      releaseGuardCleanupRef.current = NOOP;
      doc.removeEventListener('pointerdown', restore, true);
      doc.removeEventListener('click', restore, true);
      store.context.outsidePressEnabledRef.current = true;
    }

    // The pointerup that ends a swipe-open gesture synthesizes a `click`. When the drag released
    // outside the popup (e.g. it was dragged past the popup's size), that click would be treated as
    // an outside press and immediately dismiss the drawer that was just opened. Keep outside-press
    // dismissal disabled until the next interaction that isn't that release click: a deliberate
    // outside press starts with a `pointerdown`, and a click-only activation (keyboard or
    // assistive tech) is distinguishable from a physical release. This is deterministic, unlike
    // re-enabling on a timer that can race the synthesized click and dismiss at random.
    //
    // `restore` runs in document capture, ahead of floating-ui's own outside-press check (which
    // happens on the event target, after capture), so the triggering press still dismisses.
    releaseGuardCleanupRef.current = restore;
    doc.addEventListener('pointerdown', restore, true);
    doc.addEventListener('click', restore, true);
  };

  function getPopupSize(popupElement: HTMLElement) {
    const isHorizontal = dismissDirection() === 'left' || dismissDirection() === 'right';
    const size = isHorizontal ? popupElement.offsetWidth : popupElement.offsetHeight;
    if (size <= 0) {
      return null;
    }

    return size;
  }

  function resolvePopupSize() {
    const popupElement = store.context.popupRef.current;
    return popupElement ? getPopupSize(popupElement) : null;
  }

  function resolveClosedOffset(popupElement: HTMLElement) {
    const offset = getPopupSize(popupElement);
    if (offset == null) {
      return null;
    }

    const isHorizontal = dismissDirection() === 'left' || dismissDirection() === 'right';
    const transform = getElementTransform(popupElement);
    const transformOffset = isHorizontal ? transform.x : transform.y;
    if (Number.isFinite(transformOffset) && Math.abs(transformOffset) > 0.5) {
      return Math.min(offset, Math.abs(transformOffset));
    }

    return offset;
  }

  function resolveSwipeOpenThreshold() {
    const popupSize = resolvePopupSize();
    if (popupSize == null) {
      return FALLBACK_SWIPE_OPEN_THRESHOLD;
    }

    return popupSize * DEFAULT_SWIPE_OPEN_RATIO;
  }

  function applySwipeMovement() {
    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return;
    }

    if (!store.select('open') || !store.select('mounted')) {
      return;
    }

    if (closedOffsetRef.current == null) {
      closedOffsetRef.current = resolveClosedOffset(popupElement);
    }

    const closedOffset = closedOffsetRef.current;
    if (closedOffset === null) {
      return;
    }

    const { x, y } = dragDeltaRef.current;
    const displacement = getDisplacement(resolvedSwipeDirection(), x, y);
    const clampedDisplacement = Math.max(0, displacement);
    const dampedDisplacement =
      clampedDisplacement > closedOffset
        ? closedOffset + Math.sqrt(clampedDisplacement - closedOffset)
        : clampedDisplacement;
    const remaining = closedOffset - dampedDisplacement;
    const directionSign = dismissDirection() === 'left' || dismissDirection() === 'up' ? -1 : 1;
    const movement = remaining * directionSign;
    const isHorizontal = dismissDirection() === 'left' || dismissDirection() === 'right';
    const movementX = isHorizontal ? movement : 0;
    const movementY = isHorizontal ? 0 : movement;
    const openProgress = Math.max(0, Math.min(1, clampedDisplacement / closedOffset));
    const backdropProgress = Math.max(0, Math.min(1, 1 - openProgress));

    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementX, `${movementX}px`);
    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementY, `${movementY}px`);
    popupElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
    swipePopupElementRef.current = popupElement;
    if (popupTransitionRef.current === null) {
      popupTransitionRef.current = popupElement.style.transition;
    }
    popupElement.style.transition = 'none';

    const backdropElement = store.context.backdropRef.current;
    if (backdropElement) {
      backdropElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
      swipeBackdropElementRef.current = backdropElement;
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${backdropProgress}`);
      if (openProgress > 0 && frontmostHeight() > 0) {
        backdropElement.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight()}px`);
      } else {
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }
    }

    providerContext?.visualStateStore.set({
      swipeProgress: openProgress,
      frontmostHeight: openProgress > 0 ? frontmostHeight() : 0,
    });
    appliedSwipeStylesRef.current = true;
    swipeAreaActiveRef.current = true;
  }

  const clearSwipeStyles = () => {
    const popupElement = swipePopupElementRef.current;
    if (popupElement) {
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementX);
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementY);
      popupElement.removeAttribute(DrawerPopupDataAttributes.swiping);
    }

    if (popupElement && popupTransitionRef.current !== null) {
      popupElement.style.transition = popupTransitionRef.current;
      popupTransitionRef.current = null;
    }

    const backdropElement = swipeBackdropElementRef.current;
    if (backdropElement) {
      backdropElement.removeAttribute(DrawerPopupDataAttributes.swiping);
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }

    providerContext?.visualStateStore.set({ swipeProgress: 0, frontmostHeight: 0 });
    appliedSwipeStylesRef.current = false;
    swipePopupElementRef.current = null;
    swipeBackdropElementRef.current = null;
    swipeAreaActiveRef.current = false;
  };

  function openDrawer(event?: PointerEvent | TouchEvent) {
    openedBySwipeRef.current = true;
    store.setOpen(true, createChangeEventDetails(REASONS.swipe, event, swipeAreaRef.current!));
  }

  function closeDrawer(event?: PointerEvent | TouchEvent) {
    store.setOpen(false, createChangeEventDetails(REASONS.swipe, event, swipeAreaRef.current!));
  }

  function resetSwipeInteractionState() {
    swipeStartEventRef.current = null;
    openedBySwipeRef.current = false;
    closedOffsetRef.current = null;
    setSwipeActive(false);
  }

  function finishSwipeInteraction() {
    resetSwipeInteractionState();
    enableDismissAfterRelease();
    resetDragDelta();
    clearSwipeStyles();
  }

  const swipe = useSwipeDismiss({
    get enabled() {
      return enabled();
    },
    get directions() {
      return [resolvedSwipeDirection()];
    },
    // Solid: `useSwipeDismiss` takes the element itself, read lazily.
    get elementRef() {
      return swipeAreaRef.current;
    },
    trackDrag: false,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      disableDismissForSwipe();
      swipeStartEventRef.current = event;
      openedBySwipeRef.current = false;
      setSwipeActive(true);
      resetDragDelta();
    },
    onProgress(_progress, details) {
      if (!details) {
        return;
      }

      if (!swipeStartEventRef.current) {
        return;
      }

      dragDeltaRef.current.x = details.deltaX;
      dragDeltaRef.current.y = details.deltaY;

      if (details.direction !== resolvedSwipeDirection()) {
        return;
      }

      const displacement = getDisplacement(
        resolvedSwipeDirection(),
        details.deltaX,
        details.deltaY,
      );
      if (!openedBySwipeRef.current && displacement < MIN_SWIPE_START_DISTANCE) {
        return;
      }

      if (!openedBySwipeRef.current && !store.select('open')) {
        openDrawer(swipeStartEventRef.current);
      }

      applySwipeMovement();
    },
    onRelease({ event, direction, deltaX, deltaY, releaseVelocityX, releaseVelocityY }) {
      const displacement = getDisplacement(resolvedSwipeDirection(), deltaX, deltaY);
      const releaseVelocity = getDisplacement(
        resolvedSwipeDirection(),
        releaseVelocityX,
        releaseVelocityY,
      );
      const threshold = resolveSwipeOpenThreshold();
      const hasEnoughDistance = displacement >= threshold;
      const hasEnoughVelocity = releaseVelocity >= VELOCITY_THRESHOLD;
      const shouldOpen =
        direction === resolvedSwipeDirection() &&
        (hasEnoughDistance || hasEnoughVelocity) &&
        !disabled();

      if (shouldOpen) {
        if (!store.select('open')) {
          openDrawer(event);
        }
      } else if (openedBySwipeRef.current && store.select('open')) {
        closeDrawer(event);
      }

      finishSwipeInteraction();

      return false;
    },
    onCancel: finishSwipeInteraction,
  });

  const swipePointerProps = swipe.getPointerProps();
  const swipeTouchProps = swipe.getTouchProps();
  const resetSwipe = swipe.reset;

  // The commit that opens the drawer re-renders the popup, resetting `--swipe-movement-*` to `0px`
  // (the viewport isn't swiping). Re-assert after the DOM mutation but before paint.
  // Solid: there is no per-commit effect; re-run on the open/mounted changes that re-render the popup.
  createDepsRenderEffect(
    () => ({ open: open(), mounted: mounted(), swipeActive: swipeActive() }),
    (deps) => {
      if (deps.swipeActive && appliedSwipeStylesRef.current) {
        applySwipeMovement();
      }
    },
  );

  createDepsRenderEffect(
    () => ({ enabled: enabled(), swipeActive: swipeActive() }),
    (deps, prev) => {
      // Solid: the mount run would only re-write initial state, and writes are not allowed while
      // the component is being created.
      if (prev === undefined) {
        return;
      }
      if (!deps.enabled) {
        if (deps.swipeActive) {
          enableDismissAfterRelease();
        }
        resetSwipe();
        resetDragDelta();
        clearSwipeStyles();
        resetSwipeInteractionState();
      }
    },
  );

  onSettled(() => {
    return () => {
      releaseGuardCleanupRef.current();
      store.context.outsidePressEnabledRef.current = true;
    };
  });

  const state: DrawerSwipeAreaState = {
    get open() {
      return open();
    },
    get swiping() {
      return swipe.swiping;
    },
    get swipeDirection() {
      return resolvedSwipeDirection();
    },
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [swipeAreaRef, registerTrigger],
    stateAttributesMapping,
    get props() {
      return [
        {
          role: 'presentation' as const,
          'aria-hidden': 'true' as const,
          style: {
            'pointer-events': !enabled() ? 'none' : undefined,
            'touch-action': resolveTouchAction(resolvedSwipeDirection()),
          },
          onPointerDown(event: PointerEvent) {
            if (event.pointerType === 'touch') {
              return;
            }
            swipePointerProps.onPointerDown?.(event);

            // Prevent native text selection/drag gestures from competing with swipe-open dragging.
            if (event.cancelable) {
              event.preventDefault();
            }
          },
          onPointerMove(event: PointerEvent) {
            if (event.pointerType === 'touch') {
              return;
            }
            swipePointerProps.onPointerMove?.(event);
          },
          onPointerUp(event: PointerEvent) {
            if (event.pointerType === 'touch') {
              return;
            }
            swipePointerProps.onPointerUp?.(event);
          },
          onPointerCancel(event: PointerEvent) {
            if (event.pointerType === 'touch') {
              return;
            }
            swipePointerProps.onPointerCancel?.(event);
          },
        },
        swipeTouchProps,
        swipeAreaId() ? { id: swipeAreaId() } : undefined,
        elementProps,
      ];
    },
  });

  return <>{element()}</>;
}

export interface DrawerSwipeAreaProps extends BaseUIComponentProps<'div', DrawerSwipeAreaState> {
  /**
   * Whether the swipe area is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The swipe direction that opens the drawer.
   * Defaults to the opposite of `Drawer.Root` `swipeDirection`.
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
}

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: boolean;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: SwipeDirection;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: boolean;
}

export namespace DrawerSwipeArea {
  export type Props = DrawerSwipeAreaProps;
  export type State = DrawerSwipeAreaState;
}
