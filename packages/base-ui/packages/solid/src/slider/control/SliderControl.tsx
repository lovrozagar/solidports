import type { JSX } from '@solidjs/web';
import { createEffect, onSettled, untrack } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import { useDirection } from '../../direction-provider/DirectionContext';
import { activeElement, contains, getTarget } from '../../floating-ui-solid/utils';
import type { Coords } from '../../floating-ui-solid/types';
import { splitComponentProps, useRef, createLayoutEffect } from '../../solid-helpers';
import type { ReactLikeRef } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { clamp } from '../../utils/clamp';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { ownerDocument, ownerWindow } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useAnimationFrame } from '../../utils/useAnimationFrame';
import { isTouchLikePointerType } from '../../internals/usePressAndHold';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping, writeSliderState } from '../root/stateAttributesMapping';
import { canRenderNative, partHandler } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';

import { getMidpoint } from '../utils/getMidpoint';
import { resolveThumbCollision } from '../utils/resolveThumbCollision';
import { roundValueToStep } from '../utils/roundValueToStep';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { safelyChangePointerCapture } from '../../utils/pointerCapture';

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set();

interface SliderControlModel {
  renderBeforeHydration: () => boolean;
  onPointerDown: (event: PointerEvent) => void;
}

function writeControlAttributes(w: SetAttribute, model: SliderControlModel) {
  w.set('data-base-ui-slider-control', model.renderBeforeHydration() ? '' : undefined);
}

const CONTROL_HANDLERS = {
  onPointerDown: partHandler<SliderControlModel, PointerEvent>('onPointerDown', (model, event) =>
    model.onPointerDown(event),
  ),
};

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return {
      start: 0,
      end: 0,
    };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start: parseSize(styles[`border${start}Width`]) + parseSize(styles[`padding${start}`]),
    end: parseSize(styles[`border${end}Width`]) + parseSize(styles[`padding${end}`]),
  };
}

function getFingerCoords(
  event: TouchEvent | PointerEvent,
  touchIdRef: ReactLikeRef<number | null>,
): Coords | null {
  // The event is TouchEvent
  if (touchIdRef.current != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        return {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return {
    x: (event as PointerEvent).clientX,
    y: (event as PointerEvent).clientY,
  };
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderControl(componentProps: SliderControl.Props): JSX.Element {
  const {
    disabled,
    dragging,
    inset,
    isArrayValue,
    lastChangeReasonRef,
    max,
    min,
    minStepsBetweenValues,
    onValueCommitted,
    orientation,
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    pressedValuesRef,
    registerFieldControlRef,
    renderBeforeHydration,
    setActive,
    setDragging,
    setValue,
    state,
    step,
    thumbCollisionBehavior,
    thumbRefs,
    values,
  } = useSliderRootContext();

  const direction = useDirection();
  // Solid: handlers read the latest values, as React's stable callbacks do.
  const range = () => untrack(values).length > 1;
  const vertical = () => untrack(orientation) === 'vertical';

  const controlRef = useRef<HTMLDivElement | null>(null);
  const stylesRef = useRef<CSSStyleDeclaration | null>(null);
  const setStylesRef = (element: HTMLElement | null) => {
    if (element && stylesRef.current == null) {
      stylesRef.current = ownerWindow(element).getComputedStyle(element);
    }
  };

  // A number that uniquely identifies the current finger in the touch session.
  const touchIdRef = useRef<number | null>(null);
  const pointerGestureRef = useRef(false);
  // The number of touch/pointermove events that have fired.
  const moveCountRef = useRef(0);
  // The offset amount to each side of the control for inset sliders.
  // This value should be equal to the radius or half the width/height of the thumb.
  const insetThumbOffsetRef = useRef(0);
  const currentInteractionValueRef = useRef<number | number[] | null>(null);
  // Solid: React's `useValueAsRef`, synced at layout-effect timing.
  const latestValuesRef = useRef<readonly number[]>(untrack(values));
  createLayoutEffect(values, (nextValues) => {
    latestValuesRef.current = nextValues;
  });

  function getThumbInput(el: Element | null | undefined) {
    return el?.querySelector<HTMLInputElement>('input[type="range"]');
  }

  function updatePressedThumb(nextIndex: number) {
    pressedThumbIndexRef.current = nextIndex;
    if (!thumbRefs.current[nextIndex]) {
      pressedThumbCenterOffsetRef.current = null;
    }
  }

  function resetPressedThumb() {
    pressedThumbIndexRef.current = -1;
    pressedThumbCenterOffsetRef.current = null;
  }

  function isTargetDisabledThumb(target: EventTarget | null) {
    if (!isElement(target)) {
      return false;
    }

    return thumbRefs.current.some((thumbEl) => {
      if (!isElement(thumbEl) || !contains(thumbEl, target)) {
        return false;
      }

      return getThumbInput(thumbEl)?.disabled === true;
    });
  }

  function getFingerState(fingerCoords: Coords): FingerState | null {
    const control = controlRef.current;
    const thumbIndex = pressedThumbIndexRef.current;
    const currentValues = untrack(values);

    if (!control || thumbIndex < 0 || thumbIndex >= currentValues.length) {
      if (thumbIndex >= currentValues.length) {
        currentInteractionValueRef.current = null;
      }
      return null;
    }

    const isVertical = vertical();
    const minValue = untrack(min);
    const maxValue = untrack(max);
    const stepValue = untrack(step);
    const { width, height, bottom, left, right } = control.getBoundingClientRect();

    const controlOffset = getControlOffset(stylesRef.current, isVertical);
    const insetThumbOffset = insetThumbOffsetRef.current;
    const controlSize =
      (isVertical ? height : width) -
      controlOffset.start -
      controlOffset.end -
      insetThumbOffset * 2;
    const thumbCenterOffset = pressedThumbCenterOffsetRef.current ?? 0;
    const fingerX = fingerCoords.x - thumbCenterOffset;
    const fingerY = fingerCoords.y - thumbCenterOffset;

    const valueSize = isVertical
      ? bottom - fingerY - controlOffset.end
      : (untrack(direction) === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
    // the value at the finger origin scaled down to fit the range [0, 1]
    const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

    let newValue = (maxValue - minValue) * valueRescaled + minValue;
    newValue = roundValueToStep(newValue, stepValue, minValue);
    newValue = clamp(newValue, minValue, maxValue);

    if (!range()) {
      return {
        value: untrack(isArrayValue) ? [newValue] : newValue,
        thumbIndex,
        didSwap: false,
      };
    }

    return resolveThumbCollision(
      untrack(thumbCollisionBehavior),
      currentValues,
      latestValuesRef.current,
      pressedValuesRef.current,
      thumbIndex,
      newValue,
      minValue,
      maxValue,
      stepValue,
      untrack(minStepsBetweenValues),
    );
  }

  function startPressing(fingerCoords: Coords) {
    const currentValues = untrack(values);
    const maxValue = untrack(max);
    const isVertical = vertical();

    pressedValuesRef.current = range() ? currentValues.slice() : null;
    currentInteractionValueRef.current = null;
    latestValuesRef.current = currentValues;

    const pressedThumbIndex = pressedThumbIndexRef.current;
    let closestThumbIndex = pressedThumbIndex;

    if (pressedThumbIndex > -1 && pressedThumbIndex < currentValues.length) {
      if (currentValues[pressedThumbIndex] === maxValue) {
        let candidateIndex = pressedThumbIndex;

        while (candidateIndex > 0 && currentValues[candidateIndex - 1] === maxValue) {
          candidateIndex -= 1;
        }

        closestThumbIndex = candidateIndex;
      }
    } else {
      // pressed on control
      const axis = !isVertical ? 'x' : 'y';
      let minDistance: number | undefined;

      closestThumbIndex = -1;

      for (let i = 0; i < thumbRefs.current.length; i += 1) {
        const thumbEl = thumbRefs.current[i];
        if (isElement(thumbEl) && !getThumbInput(thumbEl)?.disabled) {
          const midpoint = getMidpoint(thumbEl, isVertical);
          const distance = Math.abs(fingerCoords[axis] - midpoint);

          if (minDistance === undefined || distance <= minDistance) {
            closestThumbIndex = i;
            minDistance = distance;
          }
        }
      }
    }

    if (closestThumbIndex > -1 && closestThumbIndex !== pressedThumbIndex) {
      updatePressedThumb(closestThumbIndex);
    }

    if (untrack(inset)) {
      const thumbEl = thumbRefs.current[closestThumbIndex];
      if (isElement(thumbEl)) {
        const thumbRect = thumbEl.getBoundingClientRect();
        const side = !isVertical ? 'width' : 'height';
        insetThumbOffsetRef.current = thumbRect[side] / 2;
      }
    }
  }

  function focusThumb(thumbIndex: number) {
    const input = getThumbInput(thumbRefs.current?.[thumbIndex]);
    if (!input) {
      return;
    }

    input.focus({
      preventScroll: true,
      // Prevent pointer-driven focus rings in browsers that support this option.
      // Supported in Chrome from 144+.
      focusVisible: false,
    } as FocusOptions);
  }

  function setValueFromPointer(
    finger: FingerState,
    reason: typeof REASONS.trackPress | typeof REASONS.drag,
    nativeEvent: TouchEvent | PointerEvent,
  ) {
    const applied = setValue(
      finger.value,
      createChangeEventDetails(reason, nativeEvent, undefined, {
        activeThumbIndex: finger.thumbIndex,
      }),
    );

    if (applied) {
      currentInteractionValueRef.current = finger.value;
      latestValuesRef.current = Array.isArray(finger.value) ? finger.value : [finger.value];

      // Only track and focus the swapped thumb once the change is actually applied so a
      // canceled swap doesn't leak the new index into subsequent moves.
      if (finger.didSwap) {
        updatePressedThumb(finger.thumbIndex);
        focusThumb(finger.thumbIndex);
      }
    }

    return applied;
  }

  function handleTouchMove(nativeEvent: TouchEvent | PointerEvent) {
    const fingerCoords = getFingerCoords(nativeEvent, touchIdRef);

    if (fingerCoords == null) {
      return;
    }

    moveCountRef.current += 1;

    // Cancel move in case some other element consumed a pointerup event and it was not fired.
    if (nativeEvent.type === 'pointermove' && (nativeEvent as PointerEvent).buttons === 0) {
      handleTouchEnd(nativeEvent);
      return;
    }

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    if (validateMinimumDistance(finger.value, untrack(step), untrack(minStepsBetweenValues))) {
      if (!untrack(dragging) && moveCountRef.current > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
        setDragging(true);
      }

      setValueFromPointer(finger, REASONS.drag, nativeEvent);
    }
  }

  function handleTouchEnd(nativeEvent: TouchEvent | PointerEvent) {
    if (getFingerCoords(nativeEvent, touchIdRef) == null) {
      return;
    }

    setActive(-1);
    setDragging(false);

    pressedThumbCenterOffsetRef.current = null;

    // If the value array shrank or grew mid-drag, the cached interaction value no longer
    // matches the current thumbs (the pressed index can still be in range), so dropping it
    // keeps a stale or malformed array from being committed on release.
    const interactionValue = currentInteractionValueRef.current;
    if (Array.isArray(interactionValue) && interactionValue.length !== untrack(values).length) {
      currentInteractionValueRef.current = null;
    }

    if (currentInteractionValueRef.current != null) {
      const commitReason = lastChangeReasonRef.current;
      onValueCommitted(
        currentInteractionValueRef.current,
        createGenericEventDetails(commitReason, nativeEvent),
      );
    }

    if (
      'pointerType' in nativeEvent &&
      controlRef.current?.hasPointerCapture(nativeEvent.pointerId)
    ) {
      controlRef.current?.releasePointerCapture(nativeEvent.pointerId);
    }

    pressedThumbIndexRef.current = -1;

    stopListening();
  }

  function handlePointerCancel(nativeEvent: PointerEvent) {
    // The browser cancels a touch pointer once it starts panning, but the touch listeners keep
    // tracking the finger until `touchend` or `touchcancel`.
    if (touchIdRef.current != null) {
      return;
    }

    handleTouchEnd(nativeEvent);
  }

  function handleTouchStart(nativeEvent: TouchEvent) {
    // Only the `touchstart` right after `pointerdown` belongs to the pointer gesture, so consume
    // the flag here where it can't outlive a cancelled gesture.
    const startedByPointer = pointerGestureRef.current;
    pointerGestureRef.current = false;

    if (untrack(disabled)) {
      return;
    }

    if (isTargetDisabledThumb(getTarget(nativeEvent))) {
      resetPressedThumb();
      return;
    }

    const touch = nativeEvent.changedTouches[0];
    if (touch == null) {
      return;
    }

    touchIdRef.current = touch.identifier;

    // The pointer handlers already started this gesture. Keep its state and only add the touch
    // listeners, which continue tracking the finger if the browser cancels the pointer.
    if (!startedByPointer) {
      const fingerCoords = { x: touch.clientX, y: touch.clientY };
      startPressing(fingerCoords);

      const finger = getFingerState(fingerCoords);

      if (finger == null) {
        return;
      }

      focusThumb(finger.thumbIndex);
      setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

      moveCountRef.current = 0;
    }

    const doc = ownerDocument(controlRef.current);
    doc.addEventListener('touchmove', handleTouchMove, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: true });
    doc.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  }

  function stopListening() {
    const doc = ownerDocument(controlRef.current);
    doc.removeEventListener('pointermove', handleTouchMove);
    doc.removeEventListener('pointerup', handleTouchEnd);
    doc.removeEventListener('pointercancel', handlePointerCancel);
    doc.removeEventListener('touchmove', handleTouchMove);
    doc.removeEventListener('touchend', handleTouchEnd);
    doc.removeEventListener('touchcancel', handleTouchEnd);
    touchIdRef.current = null;
    pressedValuesRef.current = null;
    currentInteractionValueRef.current = null;
    pointerGestureRef.current = false;
  }

  const focusFrame = useAnimationFrame();

  onSettled(() => {
    const control = controlRef.current;
    if (!control) {
      return () => stopListening();
    }

    const unsubscribeTouchStart = addEventListener(control, 'touchstart', handleTouchStart, {
      passive: true,
    });

    return () => {
      unsubscribeTouchStart();
      focusFrame.cancel();

      stopListening();
    };
  });

  createEffect(disabled, (isDisabled) => {
    if (isDisabled) {
      stopListening();
    }
  });

  function handlePointerDown(event: PointerEvent) {
    // Replace a flag left by a cancelled gesture that had no `touchstart` to consume it.
    pointerGestureRef.current = false;
    const control = controlRef.current;
    const target = getTarget(event);

    if (
      !control ||
      untrack(disabled) ||
      event.defaultPrevented ||
      !isElement(target) ||
      // Only handle left clicks
      event.button !== 0
    ) {
      return;
    }

    if (isTargetDisabledThumb(target)) {
      resetPressedThumb();
      return;
    }

    const fingerCoords = { x: event.clientX, y: event.clientY };
    startPressing(fingerCoords);

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    const pressedOnFocusedThumb = contains(
      thumbRefs.current[finger.thumbIndex],
      activeElement(ownerDocument(control)),
    );

    if (pressedOnFocusedThumb) {
      event.preventDefault();
    } else {
      focusFrame.request(() => {
        focusThumb(finger.thumbIndex);
      });
    }

    setDragging(true);

    const pressedOnAnyThumb = pressedThumbCenterOffsetRef.current != null;
    if (!pressedOnAnyThumb) {
      setValueFromPointer(finger, REASONS.trackPress, event);
    }

    if (event.pointerId) {
      // Solid: a pointer no longer active (released before this handler, or a synthetic
      // event) makes the capture throw; the press works without it.
      safelyChangePointerCapture(control, event.pointerId, 'setPointerCapture');
    }

    moveCountRef.current = 0;
    // Touch and pen presses can be followed by a compatibility `touchstart`.
    pointerGestureRef.current = isTouchLikePointerType(event.pointerType);
    const doc = ownerDocument(control);
    doc.addEventListener('pointermove', handleTouchMove, { passive: true });
    doc.addEventListener('pointerup', handleTouchEnd, { once: true });
    doc.addEventListener('pointercancel', handlePointerCancel, { once: true });
  }

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with its
  // pointerdown handler, no props view (D32). Client renders only, as the indicator: the
  // prehydration script positions the parts while hydrating.
  if (canRenderNative(componentProps)) {
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeSliderState,
      mapping: sliderStateAttributesMapping,
      attributes: writeControlAttributes,
      handlers: CONTROL_HANDLERS,
      handlerTarget: { renderBeforeHydration, onPointerDown: handlePointerDown },
      reactive: true,
      refs: [
        registerFieldControlRef,
        (el: HTMLDivElement | null) => {
          controlRef.current = el;
        },
        setStylesRef,
      ],
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [registerFieldControlRef, controlRef, setStylesRef],
    props: [
      {
        get ['data-base-ui-slider-control' as string]() {
          return renderBeforeHydration() ? '' : undefined;
        },
        onPointerDown: handlePointerDown,
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return element();
}

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export interface SliderControlState extends SliderRootState {}

export interface SliderControlProps extends BaseUIComponentProps<'div', SliderControlState> {}

export namespace SliderControl {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
}
