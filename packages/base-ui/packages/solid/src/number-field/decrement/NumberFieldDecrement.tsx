import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useNumberFieldStepperButton } from '../root/useNumberFieldStepperButton';
import type { NumberFieldRoot } from '../root/NumberFieldRoot';

/**
 * A stepper button that decreases the field value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldDecrement(componentProps: NumberFieldDecrement.Props) {
  return useNumberFieldStepperButton(componentProps, false);
}

export interface NumberFieldDecrementState extends NumberFieldRoot.State {}

export interface NumberFieldDecrementProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NumberFieldDecrement.State> {}

export namespace NumberFieldDecrement {
  export type State = NumberFieldDecrementState;
  export type Props = NumberFieldDecrementProps;
}
