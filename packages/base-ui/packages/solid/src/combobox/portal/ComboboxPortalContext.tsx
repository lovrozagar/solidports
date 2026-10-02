import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export const ComboboxPortalContext = createContext<Accessor<boolean | undefined>>(() => undefined);

export function useComboboxPortalContext() {
  const context = useContext(ComboboxPortalContext);
  if (context == null) {
    throw new Error('Base UI: <Combobox.Portal> is missing.');
  }
  return context;
}
