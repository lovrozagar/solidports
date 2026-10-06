import { createContext, useContext } from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import type { AccordionItemState } from './AccordionItem';

export interface AccordionItemContext {
  defaultTriggerId?: Accessor<string | undefined>;
  open: Accessor<boolean>;
  /** Solid: the item's owner (the trigger skips its unmount registration write while the item is disposed). */
  owner?: Owner | null;
  state: AccordionItemState;
  setTriggerId: Setter<string | null | undefined>;
  triggerId?: Accessor<string | undefined>;
}

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
