import * as DirectionProviderNamespace from '@solidports/base-ui/direction-provider';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, DirectionProviderNamespace);
export const TypesDirectionProvider = types.DirectionProvider;
export const TypesUseDirection = types.useDirection;
export const TypesDirectionProviderAdditionalTypes = AdditionalTypes;
