import { createContext, useContext } from 'solid-js';
import { DialogStore } from '../store/DialogStore';

export const IsDrawerContext = createContext(false);

export interface DialogRootContext<Payload = unknown> {
  store: DialogStore<Payload>;
}

export const DialogRootContext = createContext<DialogRootContext | null>(null);

export function useDialogRootContext(optional?: false): DialogRootContext;
export function useDialogRootContext(optional: true): DialogRootContext | null;
export function useDialogRootContext(optional?: boolean) {
  const dialogRootContext = useContext(DialogRootContext);

  if (!optional && dialogRootContext == null) {
    throw new Error(
      'Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>.',
    );
  }

  return dialogRootContext;
}
