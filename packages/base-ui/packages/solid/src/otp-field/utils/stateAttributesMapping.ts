import { fieldValidityMapping } from '../../field/utils/constants';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';

export const rootStateAttributesMapping: StateAttributesMapping<OTPFieldRootState> = {
  length: () => null,
  value: () => null,
  ...fieldValidityMapping,
};

export const inputStateAttributesMapping: StateAttributesMapping<OTPFieldInputState> = {
  index: () => null,
  value: () => null,
  ...fieldValidityMapping,
};
