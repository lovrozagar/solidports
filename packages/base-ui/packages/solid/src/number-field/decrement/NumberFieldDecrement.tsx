import { mergeProps as solidMergeProps } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { NumberFieldRoot } from '../root/NumberFieldRoot';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { useNumberFieldButton } from '../root/useNumberFieldButton';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';

/**
 * A stepper button that decreases the field value when clicked.
 * Renders an `<button>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldDecrement(componentProps: NumberFieldDecrement.Props) {
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
    minWithDefault,
    readOnly,
    setValue,
    state,
    value,
    valueRef,
    locale,
    lastChangedValueRef,
    onValueCommitted,
  } = useNumberFieldRootContext();

  const isMin = () => {
    const v = value();
    return v != null && v < minWithDefault();
  };
  const disabled = () => disabledProp() || contextDisabled() || isMin();

  const { props } = useNumberFieldButton({
    allowInputSyncRef,
    disabled,
    formatOptionsRef,
    getStepAmount,
    id,
    incrementValue,
    inputRef,
    inputValue,
    isIncrement: false,
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

export interface NumberFieldDecrementState extends NumberFieldRoot.State {}

export interface NumberFieldDecrementProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NumberFieldDecrement.State> {}

export namespace NumberFieldDecrement {
  export type State = NumberFieldDecrementState;
  export type Props = NumberFieldDecrementProps;
}
