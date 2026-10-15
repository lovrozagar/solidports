import { Toolbar } from '@solidports/base-ui/toolbar';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Toolbar);
export const TypesToolbar = types;
export const TypesToolbarAdditional = AdditionalTypes;
