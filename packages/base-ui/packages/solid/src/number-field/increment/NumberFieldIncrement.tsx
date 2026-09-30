import { mergeProps as solidMergeProps } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { NumberFieldRoot } from '../root/NumberFieldRoot';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { useNumberFieldButton } from '../root/useNumberFieldButton';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';

/**
 * A stepper button that increases the field value when clicked.
 * Renders an `<button>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldIncrement(componentProps: NumberFieldIncrement.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);
  const disabledProp = () => local.disabled ?? false;
  const nativeButton = () => local.nativeButton ?? true;

  const {
    allowInputSyncRef,
    disabled: contextDisabled,
    formatOptionsRef,
    getStepAmount,
    id,
    incrementValue,
    inputRef,
    inputValue,
    locale,
    maxWithDefault,
    readOnly,
    setValue,
    state,
    value,
    valueRef,
    lastChangedValueRef,
    onValueCommitted,
  } = useNumberFieldRootContext();

  const isMax = () => {
    const v = value();
    return v != null && v >= maxWithDefault();
  };
  const disabled = () => disabledProp() || contextDisabled() || isMax();

  const { props } = useNumberFieldButton({
    allowInputSyncRef,
    disabled,
    formatOptionsRef,
    getStepAmount,
    id,
    incrementValue,
    inputRef,
    inputValue,
    isIncrement: true,
    lastChangedValueRef,
    locale,
    onValueCommitted,
    readOnly,
    setValue,
    valueRef,
  });

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
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

  return <>{element()}</>;
}

export interface NumberFieldIncrementState extends NumberFieldRoot.State {}

export interface NumberFieldIncrementProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NumberFieldIncrement.State> {}

export namespace NumberFieldIncrement {
  export type State = NumberFieldIncrementState;
  export type Props = NumberFieldIncrementProps;
}
