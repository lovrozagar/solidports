import { createSignal, onCleanup } from 'solid-js';
import { getTarget } from '../../floating-ui-solid/utils';
import { createDepsEffect, splitComponentProps, useRef, provideContext } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { createGenericEventDetails } from '../../utils/createBaseUIEventDetails';
import { flushSync } from '../../utils/flushSync';
import { platform } from '../../utils/platform';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { getViewportRect } from '../utils/getViewportRect';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { NumberFieldScrubAreaContext } from './NumberFieldScrubAreaContext';

const SCRUB_AREA_STYLE = {
  'touch-action': 'none',
  '-webkit-user-select': 'none',
  'user-select': 'none',
} as const satisfies HTMLProps['style'];

/**
 * An interactive area where the user can click and drag to change the field value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldScrubArea(componentProps: NumberFieldScrubArea.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'direction',
    'pixelSensitivity',
    'teleportDistance',
  ]);
  const direction = () => local.direction ?? 'horizontal';
  const pixelSensitivity = () => local.pixelSensitivity ?? 2;

  const {
    state,
    setIsScrubbing: setRootScrubbing,
    inputRef,
    focusInput,
    incrementValue,
    allowInputSyncRef,
    getStepAmount,
    onValueCommitted,
    lastChangedValueRef,
    valueRef,
  } = useNumberFieldRootContext();
  const disabled = () => state.disabled;
  const readOnly = () => state.readOnly;

  const scrubAreaRef = useRef<HTMLSpanElement | null>(null);

  let isScrubbingRef = false;
  let didMoveRef = false;
  let pointerDownTargetRef: EventTarget | null = null;
  const scrubAreaCursorRef = useRef<HTMLSpanElement | null>(null);
  let virtualCursorCoords = { x: 0, y: 0 };

  const exitPointerLockTimeout = useTimeout();

  const [isTouchInput, setIsTouchInput] = createSignal(false);
  const [isPointerLockDenied, setIsPointerLockDenied] = createSignal(false);
  const [isScrubbing, setIsScrubbing] = createSignal(false);

  function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number) {
    // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
    // scale with the content on pinch-zoom.
    const scale = ownerWindow(virtualCursor).visualViewport?.scale ?? 1;
    virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
  }

  const onScrub = ({ movementX, movementY }: PointerEvent) => {
    const virtualCursor = scrubAreaCursorRef.current;
    const scrubAreaEl = scrubAreaRef.current;

    if (!virtualCursor || !scrubAreaEl) {
      return;
    }

    const rect = getViewportRect(local.teleportDistance, scrubAreaEl);

    const coords = virtualCursorCoords;

    // Wrap the cursor to the opposite edge when its center crosses a viewport bound.
    const wrap = (coord: number, halfSize: number, low: number, high: number) => {
      if (coord + halfSize < low) {
        return high - halfSize;
      }
      if (coord + halfSize > high) {
        return low - halfSize;
      }
      return coord;
    };

    const newCoords = {
      x: wrap(
        Math.round(coords.x + movementX),
        virtualCursor.offsetWidth / 2,
        rect.left,
        rect.right,
      ),
      y: wrap(
        Math.round(coords.y + movementY),
        virtualCursor.offsetHeight / 2,
        rect.top,
        rect.bottom,
      ),
    };

    virtualCursorCoords = newCoords;

    updateCursorTransform(virtualCursor, newCoords.x, newCoords.y);
  };

  const onScrubbingChange = (scrubbingValue: boolean, { clientX, clientY }: PointerEvent) => {
    flushSync(() => {
      setIsScrubbing(scrubbingValue);
      setRootScrubbing(scrubbingValue);
    });

    const virtualCursor = scrubAreaCursorRef.current;
    if (!virtualCursor || !scrubbingValue) {
      return;
    }

    const initialCoords = {
      x: clientX - virtualCursor.offsetWidth / 2,
      y: clientY - virtualCursor.offsetHeight / 2,
    };

    virtualCursorCoords = initialCoords;

    updateCursorTransform(virtualCursor, initialCoords.x, initialCoords.y);
  };

  createDepsEffect(
    () => ({ disabled: disabled(), readOnly: readOnly(), isScrubbing: isScrubbing() }),
    function registerGlobalScrubbingEventListeners(deps) {
      // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
      if (!inputRef.current || deps.disabled || deps.readOnly || !deps.isScrubbing) {
        return undefined;
      }

      let cumulativeDelta = 0;

      function handleScrubPointerUp(event: PointerEvent) {
        function handler() {
          try {
            ownerDocument(scrubAreaRef.current).exitPointerLock();
          } catch {
            // Ignore errors.
          } finally {
            isScrubbingRef = false;
            onScrubbingChange(false, event);
            onValueCommitted(
              lastChangedValueRef.current ?? valueRef.current,
              createGenericEventDetails(REASONS.scrub, event),
            );

            // Manually dispatch a click event if no movement happened, since
            // preventDefault on pointerdown prevents the browser click event.
            const pointerDownTarget = pointerDownTargetRef;
            const input = inputRef.current;
            if (!didMoveRef && pointerDownTarget != null && input) {
              pointerDownTarget.dispatchEvent(
                new (ownerWindow(input).MouseEvent)('click', {
                  bubbles: true,
                  cancelable: true,
                }),
              );
            }

            didMoveRef = false;
            pointerDownTargetRef = null;
          }
        }

        if (platform.engine.gecko) {
          // Firefox needs a small delay here when soft-clicking as the pointer
          // lock will not release otherwise.
          exitPointerLockTimeout.start(20, handler);
        } else {
          handler();
        }
      }

      function handleScrubPointerMove(event: PointerEvent) {
        // The effect can tear down and re-run while `isScrubbing` stays `true`. The ref is the
        // source of truth for whether a pointer is actually down.
        if (!isScrubbingRef) {
          return;
        }

        // Prevent text selection.
        event.preventDefault();

        onScrub(event);

        const { movementX, movementY } = event;
        const scrubDirection = direction();

        cumulativeDelta += scrubDirection === 'vertical' ? movementY : movementX;

        if (Math.abs(cumulativeDelta) >= pixelSensitivity()) {
          cumulativeDelta = 0;
          didMoveRef = true;
          const dValue = scrubDirection === 'vertical' ? -movementY : movementX;
          const stepAmount = getStepAmount(event);
          const rawAmount = dValue * stepAmount;

          if (rawAmount !== 0) {
            allowInputSyncRef.current = true;
            incrementValue(Math.abs(rawAmount), {
              direction: rawAmount >= 0 ? 1 : -1,
              event,
              reason: REASONS.scrub,
            });
          }
        }
      }

      const win = ownerWindow(inputRef.current);
      const unsubscribe = mergeCleanups(
        addEventListener(win, 'pointerup', handleScrubPointerUp, true),
        addEventListener(win, 'pointermove', handleScrubPointerMove, true),
      );

      return () => {
        exitPointerLockTimeout.clear();
        unsubscribe();
      };
    },
  );

  // If the scrub area unmounts mid-scrub, release pointer lock and clear the root's scrubbing
  // state so it doesn't stay locked or stuck. (No commit: there's no pointer release here.)
  onCleanup(() => {
    if (isScrubbingRef) {
      isScrubbingRef = false;
      setRootScrubbing(false);
      try {
        ownerDocument(scrubAreaRef.current).exitPointerLock();
      } catch {
        // Ignore errors.
      }
    }
  });

  // Prevent scrolling using touch input when scrubbing.
  createDepsEffect(
    () => ({ disabled: disabled(), readOnly: readOnly() }),
    function registerScrubberTouchPreventListener(deps) {
      const element = scrubAreaRef.current;
      if (!element || deps.disabled || deps.readOnly) {
        return undefined;
      }

      function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
          event.preventDefault();
        }
      }

      return addEventListener(element, 'touchstart', handleTouchStart);
    },
  );

  const defaultProps: HTMLProps = {
    role: 'presentation',
    style: SCRUB_AREA_STYLE,
    async onPointerDown(event) {
      if (event.defaultPrevented || readOnly() || event.button || disabled()) {
        return;
      }

      const isTouch = event.pointerType === 'touch';
      setIsTouchInput(isTouch);

      if (event.pointerType === 'mouse') {
        event.preventDefault();
        focusInput();
      }

      isScrubbingRef = true;
      didMoveRef = false;
      pointerDownTargetRef = getTarget(event);
      onScrubbingChange(true, event);

      // WebKit causes significant layout shift with the native message, so we can't use it.
      if (!isTouch && !platform.engine.webkit) {
        try {
          // Avoid non-deterministic errors in testing environments. This error sometimes
          // appears:
          // "The root document of this element is not valid for pointer lock."
          await ownerDocument(scrubAreaRef.current).body.requestPointerLock();
          setIsPointerLockDenied(false);
        } catch {
          setIsPointerLockDenied(true);
        } finally {
          // `onScrubbingChange` already wraps its state updates in `flushSync`, so re-emit the
          // scrubbing state directly (no extra nested `flushSync`) to reflect the resolved
          // pointer-lock result on the cursor.
          if (isScrubbingRef) {
            onScrubbingChange(true, event);
          }
        }
      }
    },
  };

  const element = useRenderElement('span', componentProps, {
    ref: (el) => {
      scrubAreaRef.current = el;
    },
    state,
    props: [defaultProps, elementProps],
    stateAttributesMapping,
  });

  const contextValue: NumberFieldScrubAreaContext = {
    isScrubbing,
    isTouchInput,
    isPointerLockDenied,
    scrubAreaCursorRef,
  };

  return provideContext(NumberFieldScrubAreaContext, contextValue, element);
}

export interface NumberFieldScrubAreaState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaProps extends BaseUIComponentProps<
  'span',
  NumberFieldScrubArea.State
> {
  /**
   * Cursor movement direction in the scrub area.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical' | undefined;
  /**
   * Determines how many pixels the cursor must move before the value changes.
   * A higher value will make scrubbing less sensitive.
   * @default 2
   */
  pixelSensitivity?: number | undefined;
  /**
   * If specified, determines the distance that the cursor may move from the center
   * of the scrub area before it will loop back around.
   */
  teleportDistance?: number | undefined;
}

export namespace NumberFieldScrubArea {
  export type State = NumberFieldScrubAreaState;
  export type Props = NumberFieldScrubAreaProps;
}
