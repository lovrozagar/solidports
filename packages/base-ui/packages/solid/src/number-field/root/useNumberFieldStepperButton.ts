
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { isTouchLikePointerType, usePressAndHold } from '../../internals/usePressAndHold';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { DEFAULT_STEP } from '../utils/constants';
import { parseNumber } from '../utils/parse';
import type { EventWithOptionalKeyState } from '../utils/types';
import type { NumberFieldRoot } from './NumberFieldRoot';
import { REASONS } from '../../utils/reasons';
import { useNumberFieldRootContext } from './NumberFieldRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const SELECT_NONE_STYLE = {
  '-webkit-user-select': 'none',
  'user-select': 'none',
} as const satisfies HTMLProps['style'];

type StepperButtonProps = NativeButtonProps & BaseUIComponentProps<'button', NumberFieldRoot.State>;

/**
 * Shared implementation for the increment and decrement stepper buttons. They differ only in the
 * direction they step and the boundary (`max` vs `min`) at which they become disabled.
 */
export function useNumberFieldStepperButton(
  componentProps: StepperButtonProps,
  isIncrement: boolean,
) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);
  const disabledProp = () => local.disabled ?? false;
  const nativeButton = () => local.nativeButton ?? true;

  const {
    allowInputSyncRef,
    formatOptionsRef,
    getStepAmount,
    id,
    incrementValue,
    inputRef,
    focusInput,
    maxWithDefault,
    minWithDefault,
    setValue,
    state,
    value,
    inputValue,
    locale,
    lastChangedValueRef,
    onValueCommitted,
    valueRef,
    disabled: contextDisabled,
    readOnly,
  } = useNumberFieldRootContext();

  const isAtBoundary = () => {
    const current = value();
    return current != null && (isIncrement ? current >= maxWithDefault() : current <= minWithDefault());
  };
  const disabled = () => disabledProp() || contextDisabled() || isAtBoundary();

  const pressReason: NumberFieldRoot.ChangeEventReason = isIncrement
    ? REASONS.incrementPress
    : REASONS.decrementPress;

  function commitValue(nativeEvent: MouseEvent | PointerEvent) {
    const shouldCommitInputValue = !allowInputSyncRef.current;
    allowInputSyncRef.current = true;

    if (!shouldCommitInputValue) {
      lastChangedValueRef.current = valueRef.current;
      return;
    }

    const parsedValue = parseNumber(inputValue(), locale(), formatOptionsRef.current);

    if (parsedValue !== null) {
      const details = createChangeEventDetails(pressReason, nativeEvent);
      setValue(parsedValue, details);

      if (!details.isCanceled) {
        valueRef.current = parsedValue;
      }
    }
  }

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    get disabled() {
      return disabled() || readOnly();
    },
    elementRef: inputRef,
    tick(triggerEvent) {
      const amount = getStepAmount(triggerEvent as EventWithOptionalKeyState) ?? DEFAULT_STEP;
      return incrementValue(amount, {
        direction: isIncrement ? 1 : -1,
        event: triggerEvent,
        reason: pressReason,
      });
    },
    onStop(nativeEvent: PointerEvent) {
      const committed = lastChangedValueRef.current ?? valueRef.current;
      onValueCommitted(committed, createGenericEventDetails(pressReason, nativeEvent));
    },
  });

  const props: HTMLProps = {
    get disabled() {
      return disabled();
    },
    'aria-label': isIncrement ? 'Increase' : 'Decrease',
    get 'aria-controls'() {
      return id();
    },
    tabindex: -1,
    style: SELECT_NONE_STYLE,
    ...pointerHandlers,
    onClick(event: MouseEvent) {
      const isDisabled = disabled() || readOnly();
      if (event.defaultPrevented || isDisabled || shouldSkipClick(event)) {
        return;
      }

      commitValue(event);

      const amount = getStepAmount(event) ?? DEFAULT_STEP;
      const prev = valueRef.current;

      incrementValue(amount, {
        direction: isIncrement ? 1 : -1,
        event,
        reason: pressReason,
      });

      const committed = lastChangedValueRef.current ?? valueRef.current;
      if (committed !== prev) {
        onValueCommitted(committed, createGenericEventDetails(pressReason, event));
      }
    },
    onPointerDown(event: PointerEvent) {
      const isMainButton = !event.button || event.button === 0;
      if (event.defaultPrevented || readOnly() || !isMainButton || disabled()) {
        return;
      }

      commitValue(event);
      lastChangedValueRef.current = null;

      if (!isTouchLikePointerType(event.pointerType)) {
        focusInput();
      }

      pointerHandlers.onPointerDown(event);
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled() || readOnly();
    },
    native: nativeButton,
    focusableWhenDisabled: true,
  });

  const buttonState = solidMergeProps(state, {
    get disabled() {
      return disabled();
    },
  });

  const element = useRenderElement('button', componentProps, {
    props: [props, elementProps, getButtonProps],
    ref: buttonRef,
    state: buttonState,
    stateAttributesMapping,
  });

  return element();
}
