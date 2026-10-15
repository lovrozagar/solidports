import { Field } from '@solidports/base-ui/field';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Field);
export const TypesField = types;
export const TypesFieldAdditional = AdditionalTypes;
