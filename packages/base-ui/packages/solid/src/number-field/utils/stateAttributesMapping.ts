import { fieldValidityMapping } from '../../field/utils/constants';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import type { NumberFieldRoot } from '../root/NumberFieldRoot';

export const stateAttributesMapping: StateAttributesMapping<NumberFieldRoot.State> = {
  inputValue: () => null,
  value: () => null,
  ...fieldValidityMapping,
};
