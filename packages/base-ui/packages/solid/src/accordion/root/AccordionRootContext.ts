/* eslint-disable typescript/no-explicit-any -- generic Value bridge erased at the context boundary, mirrors React */
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { AccordionRoot } from './AccordionRoot';

export interface AccordionRootContext<Value = any> {
  disabled: Accessor<boolean>;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: Accessor<boolean>;
  keepMounted: Accessor<boolean>;
  state: AccordionRoot.State<Value>;
  value: Accessor<AccordionRoot.Value<Value>>;
}

export const AccordionRootContext = createContext<AccordionRootContext<any> | null>(null);

export function useAccordionRootContext<Value = any>() {
  const context = useContext(AccordionRootContext) as AccordionRootContext<Value> | null;
  if (context == null) {
    throw new Error(
      'Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.',
    );
  }
  return context;
}
