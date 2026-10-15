import { Accordion } from '@solidports/base-ui/accordion';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Accordion);
export const TypesAccordion = types;
export const TypesAccordionAdditional = AdditionalTypes;
