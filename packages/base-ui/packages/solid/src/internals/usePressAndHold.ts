import { onCleanup } from 'solid-js';
import { addEventListener } from '../utils/addEventListener';
import { ownerWindow } from '../utils/owner';
import { useInterval } from '../utils/useInterval';
import { useTimeout } from '../utils/useTimeout';
import type { ReactLikeRef } from '../solid-helpers';

const DEFAULT_TICK_DELAY = 60;
const DEFAULT_START_DELAY = 400;
const DEFAULT_SCROLL_DISTANCE = 8;
const TOUCH_TIMEOUT = 50;
const MAX_POINTER_MOVES_AFTER_TOUCH = 3;

export function isTouchLikePointerType(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen';
}

export interface UsePressAndHoldParameters {
  disabled: boolean;
  readOnly?: boolean | undefined;
  /** Called on each tick during a hold. Return `false` to stop the sequence. */
  tick: (triggerEvent?: Event) => boolean;
  /** Called when hold ends via global `pointerup`. */
  onStop?: ((nativeEvent: PointerEvent) => void) | undefined;
  /** Interval between ticks once hold is active. @default 60 */
  tickDelay?: number | undefined;
  /** Delay before repeating ticks start. @default 400 */
  startDelay?: number | undefined;
  /** Movement distance (px) that cancels the hold. @default 8 */
  scrollDistance?: number | undefined;
  /** Ref to element used to resolve ownerWindow. */
  elementRef: ReactLikeRef<HTMLElement | null | undefined>;
}

export interface UsePressAndHoldReturnValue {
  pointerHandlers: {
    onTouchStart: () => void;
    onTouchEnd: () => void;
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onMouseEnter: (event: MouseEvent) => void;
    onMouseLeave: () => void;
    onMouseUp: () => void;
  };
  /** Returns `true` if the `onClick` handler should be skipped. */
  shouldSkipClick: (event: MouseEvent & { detail?: number }) => boolean;
}

/** Adds press-and-hold behavior to a button element. */
export function usePressAndHold(params: UsePressAndHoldParameters): UsePressAndHoldReturnValue {
  const {
    disabled,
    readOnly = false,
    tick,
    onStop,
    tickDelay = DEFAULT_TICK_DELAY,
    startDelay = DEFAULT_START_DELAY,
    scrollDistance = DEFAULT_SCROLL_DISTANCE,
    elementRef,
  } = params;

  const startTickTimeout = useTimeout();
  const tickInterval = useInterval();
  const intentionalTouchCheckTimeout = useTimeout();

  let isPressedRef = false;
  let movesAfterTouchRef = 0;
  let downCoordsRef = { x: 0, y: 0 };
  let isTouchingButtonRef = false;
  let ignoreClickRef = false;
  let pointerTypeRef = '';
  let unsubscribeFromGlobalContextMenu = () => {};

  function stopAutoChange() {
    intentionalTouchCheckTimeout.clear();
    startTickTimeout.clear();
    tickInterval.clear();
    unsubscribeFromGlobalContextMenu();
    movesAfterTouchRef = 0;
  }

  function startAutoChange(triggerNativeEvent?: Event) {
    stopAutoChange();

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const win = ownerWindow(element);

    unsubscribeFromGlobalContextMenu = addEventListener(win, 'contextmenu', (event) => {
      event.preventDefault();
    });

    addEventListener(
      win,
      'pointerup',
      (event) => {
        isPressedRef = false;
        stopAutoChange();
        onStop?.(event);
      },
      { once: true },
    );

    if (!tick(triggerNativeEvent)) {
      stopAutoChange();
      return;
    }

    startTickTimeout.start(startDelay, () => {
      tickInterval.start(tickDelay, () => {
        if (!tick(triggerNativeEvent)) {
          stopAutoChange();
        }
      });
    });
  }

  onCleanup(() => stopAutoChange());

  const pointerHandlers: UsePressAndHoldReturnValue['pointerHandlers'] = {
    onMouseEnter(event) {
      if (
        event.defaultPrevented ||
        disabled ||
        readOnly ||
        !isPressedRef ||
        isTouchingButtonRef ||
        isTouchLikePointerType(pointerTypeRef)
      ) {
        return;
      }

      startAutoChange(event);
    },
    onMouseLeave() {
      if (isTouchingButtonRef) {
        return;
      }

      stopAutoChange();
    },
    onMouseUp() {
      if (isTouchingButtonRef) {
        return;
      }

      stopAutoChange();
    },
    onPointerDown(event) {
      const isMainButton = !event.button || event.button === 0;
      if (event.defaultPrevented || !isMainButton || disabled || readOnly) {
        return;
      }

      pointerTypeRef = event.pointerType;
      ignoreClickRef = false;
      isPressedRef = true;
      downCoordsRef = { x: event.clientX, y: event.clientY };

      const isTouchPointer = isTouchLikePointerType(event.pointerType);

      if (!isTouchPointer) {
        event.preventDefault();
        startAutoChange(event);
      } else {
        intentionalTouchCheckTimeout.start(TOUCH_TIMEOUT, () => {
          const moves = movesAfterTouchRef;
          movesAfterTouchRef = 0;
          const stillPressed = isPressedRef;
          if (stillPressed && moves < MAX_POINTER_MOVES_AFTER_TOUCH) {
            startAutoChange(event);
            ignoreClickRef = true;
          } else {
            ignoreClickRef = false;
            stopAutoChange();
          }
        });
      }
    },
    onPointerMove(event) {
      if (disabled || readOnly || !isTouchLikePointerType(event.pointerType) || !isPressedRef) {
        return;
      }

      movesAfterTouchRef += 1;

      const { x, y } = downCoordsRef;
      const dx = x - event.clientX;
      const dy = y - event.clientY;

      if (dx ** 2 + dy ** 2 > scrollDistance ** 2) {
        stopAutoChange();
      }
    },
    onPointerUp(event) {
      if (isTouchLikePointerType(event.pointerType)) {
        isPressedRef = false;
      }
    },
    onTouchEnd() {
      isTouchingButtonRef = false;
    },
    onTouchStart() {
      isTouchingButtonRef = true;
    },
  };

  function shouldSkipClick(event: MouseEvent & { detail?: number }): boolean {
    if (event.defaultPrevented) {
      return true;
    }
    if (isTouchLikePointerType(pointerTypeRef)) {
      return ignoreClickRef;
    }
    return (event.detail ?? 0) !== 0;
  }

  return { pointerHandlers, shouldSkipClick };
}
