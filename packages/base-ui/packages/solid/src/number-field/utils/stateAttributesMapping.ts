import { fieldValidityMapping } from '../../field/utils/constants';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { compileStateWriter } from '../../utils/native/element';
import type { NumberFieldRoot } from '../root/NumberFieldRoot';

export const stateAttributesMapping: StateAttributesMapping<NumberFieldRoot.State> = {
  inputValue: () => null,
  value: () => null,
  ...fieldValidityMapping,
};

/** The number field's state attributes, compiled once for the native parts. */
export const writeNumberFieldState = compileStateWriter(
  [
    'disabled',
    'touched',
    'dirty',
    'valid',
    'filled',
    'focused',
    'value',
    'inputValue',
    'required',
    'readOnly',
    'scrubbing',
  ],
  stateAttributesMapping,
);
