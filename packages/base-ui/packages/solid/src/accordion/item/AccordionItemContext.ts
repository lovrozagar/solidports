import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Store } from 'solid-js';
import type { CodependentRefs } from '../../solid-helpers';
import type { AccordionItem } from './AccordionItem';
import { type SetStoreFunction } from '../../solid-1-compat';

export interface AccordionItemContext {
  open: Accessor<boolean>;
  state: AccordionItem.State;
  triggerId?: Accessor<string | undefined>;
  codependentRefs: Store<CodependentRefs<['trigger']>>;
  setCodependentRefs: SetStoreFunction<CodependentRefs<['trigger']>>;
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
