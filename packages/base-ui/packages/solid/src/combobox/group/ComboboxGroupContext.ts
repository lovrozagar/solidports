/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

export interface ComboboxGroupContext {
  labelId: Accessor<string | undefined>;
  setLabelId: Setter<string | undefined>;
  /**
   * Optional list of items that belong to this group. Used by nested
   * collections to render group-specific items.
   */
  items?: Accessor<readonly any[] | undefined>;
}

export const ComboboxGroupContext = createContext<ComboboxGroupContext | null>(null);

export function useComboboxGroupContext() {
  const context = useContext(ComboboxGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.',
    );
  }
  return context;
}
