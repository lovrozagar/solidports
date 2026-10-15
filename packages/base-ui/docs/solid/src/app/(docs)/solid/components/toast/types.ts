import { Toast } from '@solidports/base-ui/toast';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Toast);
export const TypesToast = types;
export const TypesToastAdditional = AdditionalTypes;
