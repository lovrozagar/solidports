import { ContextMenu } from '@solidports/base-ui/context-menu';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, ContextMenu);
export const TypesContextMenu = types;
export const TypesContextMenuAdditional = AdditionalTypes;
