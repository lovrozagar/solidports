import { DialogHandle } from '../dialog/store/DialogHandle';
import { DialogStore } from '../dialog/store/DialogStore';

export function createAlertDialogHandle<Payload>(): DialogHandle<Payload> {
  return new DialogHandle<Payload>(
    DialogStore<Payload>({
      disablePointerDismissal: true,
      modal: true,
      role: 'alertdialog',
    }),
  );
}
