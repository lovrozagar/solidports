import type { JSX } from 'solid-js';
import {
  DialogTrigger,
  type DialogTriggerProps,
  type DialogTriggerState,
} from '../../dialog/trigger/DialogTrigger';
import type { DialogHandle } from '../../dialog/store/DialogHandle';

/**
 * A button that opens the alert dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Alert Dialog](https://base-ui.com/react/components/alert-dialog)
 */
export const AlertDialogTrigger = DialogTrigger;

export interface AlertDialogTriggerProps<Payload = unknown> extends Omit<
  DialogTriggerProps<Payload>,
  'handle'
> {
  /**
   * A handle to associate the trigger with an alert dialog.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
}

export interface AlertDialogTriggerState extends DialogTriggerState {}

export namespace AlertDialogTrigger {
  export type Props<Payload = unknown> = AlertDialogTriggerProps<Payload>;
  export type State = AlertDialogTriggerState;
}
