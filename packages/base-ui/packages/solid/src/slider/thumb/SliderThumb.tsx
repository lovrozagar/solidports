/* eslint-disable typescript/no-explicit-any -- Solid event-handler bridge requires casts at mergeProps boundaries (currentTarget shape mismatch) */
import { createEffect, createMemo, createSignal, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  COMPOSITE_KEYS,
  END,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
} from '../../internals/composite/composite';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { PrehydrationScript } from '../../internals/PrehydrationScript';
import { useDirection } from '../../direction-provider/DirectionContext';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { contains } from '../../floating-ui-solid/utils';
import { matchesFocusVisible } from '../../floating-ui-solid/utils/element';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { mergeProps, type MergablePropsCallback } from '../../merge-props';
import { splitComponentProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import { clamp } from '../../utils/clamp';
import { formatNumber } from '../../utils/formatNumber';
import { ownerWindow } from '../../utils/owner';
import type { BaseUIComponentProps, HTMLProps, UseRenderElementRef } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useIsHydrating } from '../../utils/useIsHydrating';
import { useRenderElement } from '../../utils/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import { visuallyHidden } from '../../utils/visuallyHidden';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { getMidpoint } from '../utils/getMidpoint';
import { getSliderValue } from '../utils/getSliderValue';
import { getDecimalPrecision, roundValueToStep } from '../utils/roundValueToStep';
import { script as prehydrationScript } from './prehydrationScript.min';
import { SliderThumbDataAttributes } from './SliderThumbDataAttributes';

const ALL_KEYS = new Set([...COMPOSITE_KEYS, PAGE_UP, PAGE_DOWN]);

function getDefaultAriaValueText(
  values: readonly number[],
  index: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | undefined,
): string | undefined {
  if (index < 0) {
    return undefined;
  }

  if (values.length === 2) {
    return `${formatNumber(values[index], locale, format)} ${index === 0 ? 'start' : 'end'} range`;
  }

  return format ? formatNumber(values[index], locale, format) : undefined;
}

function getNewValue(
  thumbValue: number,
  increment: number,
  direction: number,
  min: number,
  max: number,
): number {
  const value = thumbValue + increment * direction;
  const roundedValue = Number(
    value.toFixed(
      Math.max(
        getDecimalPrecision(thumbValue),
        getDecimalPrecision(increment),
        getDecimalPrecision(min),
      ),
    ),
  );
  return clamp(roundedValue, min, max);
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element and a nested `<input type="range">`.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderThumb(componentProps: SliderThumb.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'children',
    'aria-describedby',
    'aria-label',
    'aria-labelledby',
    'aria-valuetext',
    'disabled',
    'getAriaLabel',
    'getAriaValueText',
    'id',
    'index',
    'inputRef',
    'onBlur',
    'onFocus',
    'onKeyDown',
    'tabIndex',
  ]);

  const id = useBaseUiId(() => local.id);

  const {
    active: activeIndex,
    lastUsedThumbIndex,
    controlRef,
    disabled: contextDisabled,
    validation,
    format,
    handleInputChange,
    inset,
    labelId,
    largeStep,
    locale,
    max,
    min,
    minStepsBetweenValues,
    form,
    name,
    orientation,
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    renderBeforeHydration,
    setActive,
    setIndicatorPosition,
    state,
    step,
    thumbRefs,
    values: sliderValues,
  } = useSliderRootContext();

  const direction = useDirection();

  const disabled = () => (local.disabled ?? false) || contextDisabled();
  const range = () => sliderValues().length > 1;
  const vertical = () => orientation() === 'vertical';
  const rtl = () => direction() === 'rtl';

  const { setTouched, setFocused, validationMode } = useFieldRootContext();

  const thumbRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoringFocusVisibleRef = useRef(false);

  // Attached to the `input` (not the thumb wrapper) so `event.currentTarget` is the
  // input, matching `onKeyDown`. The synthetic blur/focus dispatched while restoring
  // `:focus-visible` is internal and must not be forwarded to the user's handlers.
  function handleFocusProp(event: FocusEvent) {
    if (restoringFocusVisibleRef.current) {
      return;
    }
    callHandler(local.onFocus, event);
  }

  function handleBlurProp(event: FocusEvent) {
    if (restoringFocusVisibleRef.current) {
      return;
    }
    callHandler(local.onBlur, event);
  }

  const defaultInputId = useBaseUiId();
  const labelableId = useLabelableId();
  const inputId = () => (range() ? defaultInputId() : labelableId());

  const thumbMetadata = () => ({
    inputId: inputId(),
  });

  const { setRef: listItemRef, index: compositeIndex } = useCompositeListItem<ThumbMetadata>({
    metadata: thumbMetadata,
  });

  const index = () => (!range() ? 0 : (local.index ?? compositeIndex()));
  const last = () => index() === sliderValues().length - 1;
  const thumbValue = () => sliderValues()[index()];
  const thumbValuePercent = () => valueToPercent(thumbValue(), min(), max());

  const [positionPercent, setPositionPercent] = createSignal<number | undefined>();
  const isHydrating = useIsHydrating();

  const safeLastUsedThumbIndex = () =>
    lastUsedThumbIndex() >= 0 && lastUsedThumbIndex() < sliderValues().length
      ? lastUsedThumbIndex()
      : -1;

  // Solid: React's stable callback reads the latest values.
  function getInsetPosition() {
    const control = controlRef.current;
    const thumb = thumbRef.current;
    if (!control || !thumb) {
      return;
    }

    const thumbRect = thumb.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();

    const side = untrack(vertical) ? 'height' : 'width';
    // the total travel distance adjusted to account for the thumb size
    const controlSize = controlRect[side] - thumbRect[side];
    // px distance from the starting edge (inline-start or bottom) to the thumb center
    const thumbOffsetFromControlEdge =
      thumbRect[side] / 2 + (controlSize * untrack(thumbValuePercent)) / 100;
    const nextPositionPercent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;
    const nextInsetPosition = Number.isFinite(nextPositionPercent)
      ? nextPositionPercent
      : undefined;

    setPositionPercent(nextInsetPosition);

    if (untrack(index) === 0) {
      setIndicatorPosition((prevPosition) => [nextInsetPosition, prevPosition[1]]);
    } else if (untrack(last)) {
      setIndicatorPosition((prevPosition) => [prevPosition[0], nextInsetPosition]);
    }
  }

  // Solid: user effects, since the measurement writes signals.
  createEffect(inset, (isInset) => {
    if (isInset) {
      queueMicrotask(getInsetPosition);
    }
  });

  createEffect(
    () => ({ inset: inset(), thumbValuePercent: thumbValuePercent() }),
    (deps) => {
      if (deps.inset) {
        getInsetPosition();
      }
    },
  );

  createEffect(inset, (isInset) => {
    if (!isInset) {
      return undefined;
    }

    const control = controlRef.current;
    const thumb = thumbRef.current;

    if (!control || !thumb) {
      return undefined;
    }

    const ResizeObserverCtor = ownerWindow(control).ResizeObserver;
    if (typeof ResizeObserverCtor !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserverCtor(getInsetPosition);

    resizeObserver.observe(control);
    resizeObserver.observe(thumb);

    return () => {
      resizeObserver.disconnect();
    };
  });

  const zIndex = () => {
    if (range()) {
      if (activeIndex() === index()) {
        return 2;
      }
      if (safeLastUsedThumbIndex() === index()) {
        return 1;
      }
      return undefined;
    }
    return activeIndex() === index() ? 1 : undefined;
  };

  const thumbStyle = (): JSX.CSSProperties => {
    const isInset = inset();
    const percent = thumbValuePercent();
    if (!isInset && !Number.isFinite(percent)) {
      return visuallyHidden;
    }

    const isVertical = vertical();
    const startEdge = isVertical ? 'bottom' : 'inset-inline-start';
    const crossOffsetProperty = isVertical ? 'left' : 'top';

    return {
      position: 'absolute',
      [startEdge]: isInset ? 'var(--position)' : `${percent}%`,
      [crossOffsetProperty]: '50%',
      translate: `${(isVertical || !rtl() ? -1 : 1) * 50}% ${(isVertical ? 1 : -1) * 50}%`,
      'z-index': zIndex(),
      ...(isInset && {
        '--position': `${positionPercent() ?? 0}%`,
        visibility:
          (renderBeforeHydration() && isHydrating()) || positionPercent() === undefined
            ? 'hidden'
            : undefined,
      }),
    } as JSX.CSSProperties;
  };

  const cssWritingMode = (): JSX.CSSProperties['writing-mode'] => {
    if (vertical()) {
      return rtl() ? 'vertical-rl' : 'vertical-lr';
    }
    return undefined;
  };

  const ariaLabel = () =>
    typeof local.getAriaLabel === 'function' ? local.getAriaLabel(index()) : local['aria-label'];

  // Rebuilt when its sources change, as React merges these props every render.
  const inputProps = createMemo(() =>
    mergeProps<'input'>(
      {
        get 'aria-label'() {
          return ariaLabel();
        },
        get 'aria-labelledby'() {
          return local['aria-labelledby'] ?? (ariaLabel() == null ? labelId() : undefined);
        },
        get 'aria-describedby'() {
          return local['aria-describedby'];
        },
        get 'aria-orientation'() {
          return orientation();
        },
        get 'aria-valuenow'() {
          return thumbValue();
        },
        get 'aria-valuetext'() {
          return typeof local.getAriaValueText === 'function'
            ? local.getAriaValueText(
                formatNumber(thumbValue(), locale(), format()),
                thumbValue(),
                index(),
              )
            : (local['aria-valuetext'] ??
                getDefaultAriaValueText(sliderValues(), index(), format(), locale()));
        },
        get disabled() {
          return disabled();
        },
        get form() {
          return form();
        },
        get id() {
          return inputId();
        },
        get max() {
          return max();
        },
        get min() {
          return min();
        },
        get name() {
          return name();
        },
        onChange(event: Event) {
          handleInputChange(
            (event.currentTarget as HTMLInputElement).valueAsNumber,
            untrack(index),
            event,
          );
        },
        onFocus(event: FocusEvent) {
          const isRestoringFocusVisible = restoringFocusVisibleRef.current;
          restoringFocusVisibleRef.current = false;
          setActive(untrack(index));
          setFocused(true);

          if (isRestoringFocusVisible) {
            event.stopPropagation();
          }
        },
        onBlur(event: FocusEvent) {
          if (restoringFocusVisibleRef.current) {
            event.stopPropagation();
            return;
          }

          setActive(-1);

          // Keep field-level blur logic from running while focus moves to another thumb
          // of the same slider, so validation doesn't commit mid-interaction.
          if (thumbRefs.current.some((thumb) => contains(thumb, event.relatedTarget as Element))) {
            return;
          }

          setTouched(true);
          setFocused(false);

          if (untrack(validationMode) === 'onBlur') {
            validation.commit(
              getSliderValue(
                untrack(thumbValue),
                untrack(index),
                untrack(min),
                untrack(max),
                untrack(range),
                untrack(sliderValues),
              ),
            );
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (event.defaultPrevented) {
            return;
          }

          if (!ALL_KEYS.has(event.key)) {
            return;
          }

          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }

          // Solid: read the latest values, as React's handler closes over the current render.
          const currentIndex = untrack(index);
          const currentValues = untrack(sliderValues);
          const currentValue = currentValues[currentIndex];
          const stepValue = untrack(step);
          const largeStepValue = untrack(largeStep);
          const minValue = untrack(min);
          const maxValue = untrack(max);
          const minSteps = untrack(minStepsBetweenValues);
          const isRange = currentValues.length > 1;
          const isRtl = untrack(rtl);

          let newValue = null;
          let keyDirection = 0;
          let increment = event.shiftKey ? largeStepValue : stepValue;
          const roundedValue = roundValueToStep(currentValue, stepValue, minValue);
          switch (event.key) {
            case ARROW_UP:
              keyDirection = 1;
              break;
            case ARROW_RIGHT:
              keyDirection = isRtl ? -1 : 1;
              break;
            case ARROW_DOWN:
              keyDirection = -1;
              break;
            case ARROW_LEFT:
              keyDirection = isRtl ? 1 : -1;
              break;
            case PAGE_UP:
              increment = largeStepValue;
              keyDirection = 1;
              break;
            case PAGE_DOWN:
              increment = largeStepValue;
              keyDirection = -1;
              break;
            case END:
              newValue =
                isRange && Number.isFinite(currentValues[currentIndex + 1])
                  ? currentValues[currentIndex + 1] - stepValue * minSteps
                  : maxValue;
              break;
            case HOME:
              newValue =
                isRange && Number.isFinite(currentValues[currentIndex - 1])
                  ? currentValues[currentIndex - 1] + stepValue * minSteps
                  : minValue;
              break;
            default:
              break;
          }

          if (keyDirection !== 0) {
            newValue = getNewValue(roundedValue, increment, keyDirection, minValue, maxValue);
          }

          if (newValue !== null) {
            const input = event.currentTarget as HTMLInputElement;

            if (!matchesFocusVisible(input)) {
              restoringFocusVisibleRef.current = true;
              input.blur();
              input.focus({
                preventScroll: true,
                // Show `:focus-visible` after keyboard interaction, even if the
                // thumb was previously focused by a pointer.
                focusVisible: true,
              } as FocusOptions);
            }

            handleInputChange(newValue, currentIndex, event);
            event.preventDefault();
          }
        },
        get step() {
          return step();
        },
        get style(): JSX.CSSProperties {
          return {
            ...visuallyHidden,
            // So that VoiceOver's focus indicator matches the thumb's dimensions
            width: '100%',
            height: '100%',
            'writing-mode': cssWritingMode(),
          };
        },
        get tabindex() {
          return local.tabIndex;
        },
        type: 'range',
        get value() {
          return thumbValue() ?? '';
        },
      } as any,
      ((props) =>
        validation.getValidationProps(
          disabled(),
          props as HTMLProps,
        )) as MergablePropsCallback<'input'>,
      {
        onFocus: handleFocusProp,
        onBlur: handleBlurProp,
        onKeyDown(event: KeyboardEvent) {
          callHandler(local.onKeyDown, event);
        },
      },
    ),
  );

  // Solid: React's `useMergedRefs(inputRef, validation.inputRef, inputRefProp)`.
  function mergedInputRef(element: HTMLInputElement) {
    inputRef.current = element;
    validation.inputRef.current = element;
    const inputRefProp = local.inputRef;
    if (typeof inputRefProp === 'function') {
      inputRefProp(element);
    } else if (inputRefProp != null) {
      inputRefProp.current = element;
    }
  }

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [listItemRef, thumbRef],
    get children() {
      return (
        <>
          {local.children}
          <input
            ref={mergedInputRef}
            {...(inputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)}
          />
          {/* Rendered with the last thumb to ensure all preceding thumbs are already in the DOM. */}
          <Show when={inset() && last() && renderBeforeHydration()}>
            <PrehydrationScript script={prehydrationScript} />
          </Show>
        </>
      );
    },
    props: [
      {
        get [SliderThumbDataAttributes.index as string]() {
          return index();
        },
        get id() {
          return id();
        },
        onPointerDown(event: PointerEvent) {
          // Keep disabled thumbs from writing transient pointer state.
          if (untrack(disabled)) {
            return;
          }

          const isVertical = untrack(vertical);
          pressedThumbIndexRef.current = untrack(index);
          const midpoint = getMidpoint(event.currentTarget as HTMLElement, isVertical);
          pressedThumbCenterOffsetRef.current =
            (isVertical ? event.clientY : event.clientX) - midpoint;
        },
        get style() {
          return thumbStyle();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return <>{element()}</>;
}

function callHandler<E extends Event>(
  handler: JSX.EventHandlerUnion<HTMLInputElement, E> | undefined,
  event: E,
) {
  if (typeof handler === 'function') {
    (handler as (event: E) => void)(event);
  } else if (Array.isArray(handler)) {
    (handler[0] as (data: unknown, event: E) => void)(handler[1], event);
  }
}

export interface ThumbMetadata {
  inputId: string | undefined;
}

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbProps extends Omit<
  BaseUIComponentProps<'div', SliderThumbState>,
  'onBlur' | 'onFocus' | 'onKeyDown'
> {
  /**
   * Whether the thumb should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * Ignored when `getAriaValueText` is provided.
   */
  'aria-valuetext'?: JSX.AriaAttributes['aria-valuetext'] | undefined;
  /**
   * A function which returns a string value for the [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) attribute of the `input`.
   */
  getAriaLabel?: ((index: number) => string) | null | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * This is important for screen reader users.
   */
  getAriaValueText?:
    ((formattedValue: string, value: number, index: number) => string) | null | undefined;
  /**
   * The index of the thumb which corresponds to the index of its value in the
   * `value` or `defaultValue` array.
   * This prop is required to support server-side rendering for range sliders
   * with multiple thumbs.
   * @example
   * ```tsx
   * <Slider.Root value={[10, 20]}>
   *   <Slider.Thumb index={0} />
   *   <Slider.Thumb index={1} />
   * </Slider.Root>
   * ```
   */
  index?: number | undefined;
  /**
   * A ref to access the nested input element.
   */
  inputRef?:
    | ReactLikeRef<HTMLInputElement | null | undefined>
    | UseRenderElementRef<HTMLInputElement | null>
    | undefined;
  /**
   * A blur handler forwarded to the `input`.
   */
  onBlur?: JSX.EventHandlerUnion<HTMLInputElement, FocusEvent> | undefined;
  /**
   * A focus handler forwarded to the `input`.
   */
  onFocus?: JSX.EventHandlerUnion<HTMLInputElement, FocusEvent> | undefined;
  /**
   * A keydown handler forwarded to the `input`.
   */
  onKeyDown?: JSX.EventHandlerUnion<HTMLInputElement, KeyboardEvent> | undefined;
  /**
   * Optional tab index attribute forwarded to the `input`.
   */
  tabIndex?: number | undefined;
}

export namespace SliderThumb {
  export type State = SliderThumbState;
  export type Props = SliderThumbProps;
}
