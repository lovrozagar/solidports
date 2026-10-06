import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface FieldItemContext {
  disabled: Accessor<boolean>;
}

/** The context outside any `Field.Item`: never disabled by an item. */
export const DEFAULT_FIELD_ITEM_CONTEXT: FieldItemContext = { disabled: () => false };

export const FieldItemContext = createContext<FieldItemContext>(DEFAULT_FIELD_ITEM_CONTEXT);

export function useFieldItemContext() {
  const context = useContext(FieldItemContext);

  return context;
}
