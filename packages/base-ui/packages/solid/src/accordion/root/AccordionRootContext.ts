import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { AccordionRoot } from './AccordionRoot';
import type { KeyedSelector } from '../../utils/createKeyedSelector';

export interface AccordionRootContext<Value = any> {
  disabled: Accessor<boolean>;
  /** Whether `disabled` can ever be true: false lets a trigger bind no disabled gates. */
  mayBeDisabled: boolean;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: Accessor<boolean>;
  /** Whether the item with `value` is open; reads only that item's membership. */
  /** Membership in the root's value; `isOpen.forKey(value)` binds the read to one value. */
  isOpen: KeyedSelector;
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
