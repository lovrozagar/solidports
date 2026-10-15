import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types } = createMultipleTypes(import.meta.url, {
  RadioGroup,
  Radio,
});
export const TypesRadioGroup = types;
