import { createContext, useContext } from 'solid-js';
import type { AccordionItemModel } from './AccordionItemModel';

/** The item's model: its state, collapsible root and trigger id registration. */
export type AccordionItemContext = AccordionItemModel;

export const AccordionItemContext = createContext<AccordionItemContext | null>(null);

export function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  }
  return context;
}
