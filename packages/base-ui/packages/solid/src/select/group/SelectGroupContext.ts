import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

export interface SelectGroupContext {
  labelId: Accessor<string | undefined>;
  setLabelId: Setter<string | undefined>;
}

export const SelectGroupContext = createContext<SelectGroupContext | null>(null);

export function useSelectGroupContext() {
  const context = useContext(SelectGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.',
    );
  }
  return context;
}
