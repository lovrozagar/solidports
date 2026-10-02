import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export const DialogPortalContext = createContext<Accessor<boolean | undefined> | null>(null);

export function useDialogPortalContext() {
  const value = useContext(DialogPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Dialog.Portal> is missing.');
  }
  return value;
}
