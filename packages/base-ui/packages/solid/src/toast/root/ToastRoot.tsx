/* eslint-disable typescript/no-explicit-any -- generic Data type erased at root */
import { createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';
import { activeElement, contains, getTarget } from '../../floating-ui-solid/utils';
import { splitComponentProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { BASE_UI_SWIPE_IGNORE_SELECTOR, LEGACY_SWIPE_IGNORE_SELECTOR } from '../../utils/constants';
import { flushSync as flushSyncUpdate } from '../../utils/flushSync';
import { getElementTransform } from '../../utils/getElementTransform';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { ownerDocument } from '../../utils/owner';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { getDisplacement } from '../../utils/useSwipeDismiss';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import type { ToastObject as ToastObjectType } from '../useToastManager';
import { ToastRootContext } from './ToastRootContext';
import { ToastRootCssVars } from './ToastRootCssVars';
import { ToastRootDataAttributes } from './ToastRootDataAttributes';

export const toastRootStateAttributesMapping: StateAttributesMapping<ToastRootState> = {
  ...transitionStatusMapping,
  swipeDirection(value) {
    return value ? { [ToastRootDataAttributes.swipeDirection]: value } : null;
  },
};

const SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const OPPOSITE_DIRECTION_DAMPING_FACTOR = 0.5;
const MIN_DRAG_THRESHOLD = 1;
const TOAST_SWIPE_IGNORE_SELECTOR = `${BASE_UI_SWIPE_IGNORE_SELECTOR},${LEGACY_SWIPE_IGNORE_SELECTOR}`;

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastRoot(componentProps: ToastRoot.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['toast', 'swipeDirection']);

  const isAnchored = () => local.toast.positionerProps?.anchor !== undefined;

  const swipeDirections = createMemo<SwipeDirection[]>(() => {
    if (isAnchored()) {
      return [];
    }
    const swipeDirection = local.swipeDirection ?? ['down', 'right'];
    return Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection];
  });

  const swipeEnabled = () => swipeDirections().length > 0;

  const store = useToastProviderContext();

  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<
    SwipeDirection | undefined
  >(undefined);
  const [isSwiping, setIsSwiping] = createSignal(false);
  const [isRealSwipe, setIsRealSwipe] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [initialTransform, setInitialTransform] = createSignal({ x: 0, y: 0, scale: 1 });
  // Title and Description clear their id on unmount, which can run while a parent computation
  // disposes them (React's unmount cleanup). `ownedWrite` permits that registration write.
  const [titleId, setTitleId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [descriptionId, setDescriptionId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [lockedDirection, setLockedDirection] = createSignal<'horizontal' | 'vertical' | null>(
    null,
  );

  // Solid: a root rendered again for the same toast (a list that recreates its items, such as
  // `toasts().map(...)`) reuses the toast's ref, so measuring it again writes the same values and
  // the update settles. React keeps the instance (and its ref) through the list's keys.
  const rootRef = (untrack(() => local.toast.ref) ??
    useRef<HTMLDivElement | null>(null)) as ReactLikeRef<HTMLDivElement | null>;
  const lastToastIdRef = useRef<string | undefined>(undefined);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialTransformRef = useRef({ x: 0, y: 0, scale: 1 });
  const intendedSwipeDirectionRef = useRef<SwipeDirection | undefined>(undefined);
  const maxSwipeDisplacementRef = useRef(0);
  const cancelledSwipeRef = useRef(false);
  const swipeCancelBaselineRef = useRef({ x: 0, y: 0 });
  const isFirstPointerMoveRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const dragAbortControllerRef = useRef<AbortController | null>(null);

  const domIndex = store.useState('toastIndex', () => local.toast.id);
  const visibleIndex = store.useState('toastVisibleIndex', () => local.toast.id);
  const offsetY = store.useState('toastOffsetY', () => local.toast.id);
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');

  useOpenChangeComplete({
    open: () => local.toast.transitionStatus !== 'ending',
    ref: () => rootRef.current,
    onComplete() {
      const currentToast = untrack(() => local.toast);
      if (currentToast.transitionStatus === 'ending') {
        store.removeToast(currentToast.id);
      }
    },
  });

  // Recalculates the natural height of the toast and updates it in the toast manager.
  // `flushSync` avoids visual flickers when called from observer callbacks.
  // The store ignores this write while the toast is transitioning out.
  function recalculateHeight(flushSync: boolean = false) {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const previousHeight = element.style.height;
    element.style.height = 'auto';

    const height = element.offsetHeight;

    element.style.height = previousHeight;

    function update() {
      store.updateToastInternal(
        untrack(() => local.toast.id),
        {
          ref: rootRef,
          height,
          transitionStatus: undefined,
        },
      );
    }

    if (flushSync) {
      flushSyncUpdate(update);
    } else {
      update();
    }
  }

  function setResolvedDragOffset(nextDragOffset: { x: number; y: number }) {
    dragOffsetRef.current = nextDragOffset;
    setDragOffset(nextDragOffset);
  }

  // Initialize the toast on mount, and reinitialize when it begins a new lifecycle:
  // re-adding an ending toast retains the same root instance (keyed by id), and
  // index-keyed lists can hand an existing instance a different toast.
  // Solid: a user effect, so the root element is attached before it is measured.
  createEffect(
    () => ({ id: local.toast.id, transitionStatus: local.toast.transitionStatus }),
    ({ id, transitionStatus }) => {
      const previousToastId = lastToastIdRef.current;
      // `recalculateHeight` clears the `starting` status itself, so bail out on the
      // resulting re-run and on the later `ending` one, which the store discards anyway.
      if (transitionStatus !== 'starting' && previousToastId === id) {
        return;
      }

      if (previousToastId !== undefined) {
        // A retained root keeps component-local swipe state from its previous lifecycle;
        // clear it so the toast doesn't stay offset or exit in the swiped direction.
        setCurrentSwipeDirection(undefined);
        setInitialTransform({ x: 0, y: 0, scale: 1 });
        setResolvedDragOffset({ x: 0, y: 0 });
      }

      lastToastIdRef.current = id;
      recalculateHeight();
    },
  );

  onCleanup(() => {
    dragAbortControllerRef.current?.abort();
  });

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const directions = swipeDirections();
    const damp = (delta: number) =>
      delta > 0
        ? delta ** OPPOSITE_DIRECTION_DAMPING_FACTOR
        : -(Math.abs(delta) ** OPPOSITE_DIRECTION_DAMPING_FACTOR);

    const dampX =
      (deltaX > 0 && !directions.includes('right')) || (deltaX < 0 && !directions.includes('left'));
    const dampY =
      (deltaY > 0 && !directions.includes('down')) || (deltaY < 0 && !directions.includes('up'));

    return {
      x: dampX ? damp(deltaX) : deltaX,
      y: dampY ? damp(deltaY) : deltaY,
    };
  }

  function handleSwipeEnd(event: PointerEvent) {
    if (event.pointerId !== activePointerIdRef.current) {
      return;
    }

    activePointerIdRef.current = null;
    dragAbortControllerRef.current?.abort();
    dragAbortControllerRef.current = null;
    setIsSwiping(false);
    setIsRealSwipe(false);
    setLockedDirection(null);

    const resolvedInitialTransform = initialTransformRef.current;

    if (event.type === 'pointercancel' || cancelledSwipeRef.current) {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
      return;
    }

    const resolvedDragOffset = dragOffsetRef.current;
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    let dismissDirection: SwipeDirection | undefined;

    for (const direction of swipeDirections()) {
      if (getDisplacement(direction, deltaX, deltaY) > SWIPE_THRESHOLD) {
        dismissDirection = direction;
        break;
      }
    }

    if (dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      store.closeToast(untrack(() => local.toast.id));
    } else {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
    }
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (event.button !== 0) {
      return;
    }

    if (event.pointerType === 'touch') {
      store.pauseTimers();
    }

    const target = getTarget(event) as HTMLElement | null;

    const isInteractiveElement = target?.closest(
      `button,a,input,textarea,[role="button"],${TOAST_SWIPE_IGNORE_SELECTOR}`,
    );

    if (isInteractiveElement) {
      return;
    }

    cancelledSwipeRef.current = false;
    intendedSwipeDirectionRef.current = undefined;
    maxSwipeDisplacementRef.current = 0;
    activePointerIdRef.current = event.pointerId;
    dragStartPosRef.current = { x: event.clientX, y: event.clientY };
    swipeCancelBaselineRef.current = dragStartPosRef.current;

    const element = event.currentTarget;

    const transform = getElementTransform(element);
    initialTransformRef.current = transform;
    setInitialTransform(transform);
    setResolvedDragOffset({
      x: transform.x,
      y: transform.y,
    });

    store.set('hovering', true);
    setIsSwiping(true);
    setIsRealSwipe(false);
    setLockedDirection(null);
    isFirstPointerMoveRef.current = true;

    dragAbortControllerRef.current?.abort();
    const dragAbortController = new AbortController();
    dragAbortControllerRef.current = dragAbortController;

    const doc = ownerDocument(element);
    doc.addEventListener('pointerup', handleSwipeEnd, { signal: dragAbortController.signal });
    doc.addEventListener('pointercancel', handleSwipeEnd, { signal: dragAbortController.signal });

    element.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerIdRef.current) {
      return;
    }

    // Prevent text selection on Safari
    event.preventDefault();

    if (isFirstPointerMoveRef.current) {
      // Adjust the starting position to the current position on the first move
      // to account for the delay between pointerdown and the first pointermove on iOS.
      dragStartPosRef.current = { x: event.clientX, y: event.clientY };
      isFirstPointerMoveRef.current = false;
    }

    const { clientY, clientX, movementX, movementY } = event;

    if (
      (movementY < 0 && clientY > swipeCancelBaselineRef.current.y) ||
      (movementY > 0 && clientY < swipeCancelBaselineRef.current.y)
    ) {
      swipeCancelBaselineRef.current = { x: swipeCancelBaselineRef.current.x, y: clientY };
    }

    if (
      (movementX < 0 && clientX > swipeCancelBaselineRef.current.x) ||
      (movementX > 0 && clientX < swipeCancelBaselineRef.current.x)
    ) {
      swipeCancelBaselineRef.current = { x: clientX, y: swipeCancelBaselineRef.current.y };
    }

    const deltaX = clientX - dragStartPosRef.current.x;
    const deltaY = clientY - dragStartPosRef.current.y;
    const cancelDeltaY = clientY - swipeCancelBaselineRef.current.y;
    const cancelDeltaX = clientX - swipeCancelBaselineRef.current.x;

    const directions = swipeDirections();
    // Solid: signals read in a handler see the latest write, as React's render-time state.
    let resolvedLockedDirection = lockedDirection();

    if (!isRealSwipe()) {
      const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (movementDistance >= MIN_DRAG_THRESHOLD) {
        setIsRealSwipe(true);
        // `lockedDirection` is always reset alongside `isRealSwipe`, so it is
        // still `null` here. Locking is only meaningful when both axes are
        // swipeable; otherwise the single axis already constrains the gesture.
        const hasHorizontal = directions.includes('left') || directions.includes('right');
        const hasVertical = directions.includes('up') || directions.includes('down');
        if (hasHorizontal && hasVertical) {
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);
          resolvedLockedDirection = absX > absY ? 'horizontal' : 'vertical';
          setLockedDirection(resolvedLockedDirection);
        }
      }
    }

    let candidate: SwipeDirection | undefined;
    if (!intendedSwipeDirectionRef.current) {
      if (resolvedLockedDirection === 'vertical') {
        if (deltaY > 0) {
          candidate = 'down';
        } else if (deltaY < 0) {
          candidate = 'up';
        }
      } else if (resolvedLockedDirection === 'horizontal') {
        if (deltaX > 0) {
          candidate = 'right';
        } else if (deltaX < 0) {
          candidate = 'left';
        }
      } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? 'right' : 'left';
      } else {
        candidate = deltaY > 0 ? 'down' : 'up';
      }

      if (candidate && directions.includes(candidate)) {
        intendedSwipeDirectionRef.current = candidate;
        maxSwipeDisplacementRef.current = getDisplacement(candidate, deltaX, deltaY);
        setCurrentSwipeDirection(candidate);
      }
    } else {
      const direction = intendedSwipeDirectionRef.current;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);

      if (currentDisplacement > SWIPE_THRESHOLD) {
        cancelledSwipeRef.current = false;
        setCurrentSwipeDirection(direction);
      } else if (
        !(directions.includes('left') && directions.includes('right')) &&
        !(directions.includes('up') && directions.includes('down')) &&
        maxSwipeDisplacementRef.current - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        // Mark that a change-of-mind has occurred
        cancelledSwipeRef.current = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransformRef.current.x;
    let newOffsetY = initialTransformRef.current.y;

    const hasHorizontalDir = directions.includes('left') || directions.includes('right');
    const hasVerticalDir = directions.includes('up') || directions.includes('down');

    if (resolvedLockedDirection !== 'vertical' && hasHorizontalDir) {
      newOffsetX += dampedDelta.x;
    }

    if (resolvedLockedDirection !== 'horizontal' && hasVerticalDir) {
      newOffsetY += dampedDelta.y;
    }

    setResolvedDragOffset({ x: newOffsetX, y: newOffsetY });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (
        !rootRef.current ||
        !contains(rootRef.current, activeElement(ownerDocument(rootRef.current)))
      ) {
        return;
      }

      store.closeToast(untrack(() => local.toast.id));
    }
  }

  createEffect(swipeEnabled, (enabled) => {
    const element = rootRef.current;
    if (!enabled || !element) {
      return undefined;
    }

    function preventDefaultTouchStart(event: TouchEvent) {
      if (
        activePointerIdRef.current === null ||
        !contains(element, getTarget(event) as HTMLElement | null)
      ) {
        return;
      }

      // The pointermove preventDefault is not enough on iOS; this
      // non-passive touchmove listener blocks native scrolling while dragging.
      event.preventDefault();
    }

    return addEventListener(element, 'touchmove', preventDefaultTouchStart, { passive: false });
  });

  function getDragStyles() {
    const offset = dragOffset();
    const initial = initialTransform();
    const deltaX = offset.x - initial.x;
    const deltaY = offset.y - initial.y;

    return {
      transition: isSwiping() ? 'none' : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: isSwiping()
        ? `translateX(${offset.x}px) translateY(${offset.y}px) scale(${initial.scale})`
        : undefined,
      [ToastRootCssVars.swipeMovementX]: `${deltaX}px`,
      [ToastRootCssVars.swipeMovementY]: `${deltaY}px`,
    };
  }

  const isHighPriority = () => local.toast.priority === 'high';

  const defaultProps: HTMLProps = {
    get role() {
      return isHighPriority() ? 'alertdialog' : 'dialog';
    },
    tabindex: 0,
    'aria-modal': 'false',
    get 'aria-labelledby'() {
      return titleId();
    },
    get 'aria-describedby'() {
      return descriptionId();
    },
    get 'aria-hidden'() {
      return isHighPriority() && !focused() ? 'true' : undefined;
    },
    get onPointerDown() {
      return swipeEnabled() ? handlePointerDown : undefined;
    },
    get onPointerMove() {
      return swipeEnabled() ? handlePointerMove : undefined;
    },
    get onPointerUp() {
      return swipeEnabled() ? handleSwipeEnd : undefined;
    },
    get onPointerCancel() {
      return swipeEnabled() ? handleSwipeEnd : undefined;
    },
    onKeyDown: handleKeyDown,
    get inert() {
      return local.toast.limited;
    },
    get style() {
      return {
        ...getDragStyles(),
        [ToastRootCssVars.index as string]:
          local.toast.transitionStatus === 'ending' ? domIndex() : visibleIndex(),
        [ToastRootCssVars.offsetY as string]: `${offsetY()}px`,
        [ToastRootCssVars.height as string]: local.toast.height
          ? `${local.toast.height}px`
          : undefined,
      };
    },
  };

  const toastRoot: ToastRootContext = {
    toast: () => local.toast,
    setTitleId,
    setDescriptionId,
    recalculateHeight,
    visibleIndex,
    expanded,
  };

  const state: ToastRootState = {
    get transitionStatus() {
      return local.toast.transitionStatus;
    },
    get expanded() {
      return expanded();
    },
    get limited() {
      return local.toast.limited || false;
    },
    get type() {
      return local.toast.type;
    },
    get swiping() {
      return isSwiping();
    },
    get swipeDirection() {
      return currentSwipeDirection();
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: (el: HTMLDivElement | null) => {
      rootRef.current = el;
    },
    state,
    stateAttributesMapping: toastRootStateAttributesMapping,
    props: [defaultProps, elementProps],
  });

  return <ToastRootContext value={toastRoot}>{element()}</ToastRootContext>;
}

export type ToastRootToastObject<Data extends object = any> = ToastObjectType<Data>;
export interface ToastRootState {
  transitionStatus: TransitionStatus;
  /** Whether the toasts in the viewport are expanded. */
  expanded: boolean;
  /** Whether the toast was removed due to exceeding the limit. */
  limited: boolean;
  /** The type of the toast. */
  type: string | undefined;
  /** Whether the toast is being swiped. */
  swiping: boolean;
  /** The direction the toast is being swiped. */
  swipeDirection: 'up' | 'down' | 'left' | 'right' | undefined;
}

export interface ToastRootProps extends BaseUIComponentProps<'div', ToastRoot.State> {
  /**
   * The toast to render.
   */
  toast: ToastRootToastObject<any>;
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?:
    ('up' | 'down' | 'left' | 'right' | ('up' | 'down' | 'left' | 'right')[]) | undefined;
}

export namespace ToastRoot {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props = ToastRootProps;
}
