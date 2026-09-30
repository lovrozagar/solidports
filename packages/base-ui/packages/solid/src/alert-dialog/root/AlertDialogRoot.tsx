import { untrack, type Accessor } from 'solid-js';
import type { DialogRoot } from '../../dialog/root/DialogRoot';
import { IsDrawerContext } from '../../dialog/root/DialogRoot';
import { DialogRootContext, useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useDialogRoot } from '../../dialog/root/useDialogRoot';
import { DialogHandle } from '../../dialog/store/DialogHandle';
import { DialogStore } from '../../dialog/store/DialogStore';
import { ComponentWithPayload, type ReactLikeRef } from '../../solid-helpers';
import { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';

/**
 * Groups all parts of the alert dialog.
 * Doesn’t render its own HTML element.
 *
 * Documentation: [Base UI Alert Dialog](https://base-ui.com/react/components/alert-dialog)
 */
export function AlertDialogRoot<Payload>(props: AlertDialogRoot.Props<Payload>) {
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;

  const parentDialogRootContext = useDialogRootContext(true);
  const nested = () => Boolean(parentDialogRootContext);

  const store = untrack(
    () =>
      props.handle?.store ??
      DialogStore<Payload>({
        get activeTriggerId() {
          return defaultTriggerIdProp();
        },
        disablePointerDismissal: true,
        modal: true,
        get nested() {
          return nested();
        },
        get open() {
          return defaultOpen();
        },
        get openProp() {
          return openProp();
        },
        role: 'alertdialog',
        get triggerIdProp() {
          return triggerIdProp();
        },
      }),
  );

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);
  store.useSyncedValue('nested', nested);
  store.useContextCallback('onOpenChange', (open, details) =>
    props.onOpenChange?.(open, details),
  );
  store.useContextCallback('onOpenChangeComplete', (open) => props.onOpenChangeComplete?.(open));

  const payload = store.useState('payload') as Accessor<Payload | undefined>;

  useDialogRoot({
    get actionsRef() {
      return props.actionsRef;
    },
    isDrawer: false,
    get onOpenChange() {
      return props.onOpenChange;
    },
    get parentContext() {
      return parentDialogRootContext?.store.context;
    },
    store,
    get triggerIdProp() {
      return triggerIdProp();
    },
  });

  const contextValue: DialogRootContext<Payload> = { store };

  return (
    <IsDrawerContext.Provider value={false}>
      <DialogRootContext.Provider value={contextValue as DialogRootContext}>
        <ComponentWithPayload payload={payload} children={props.children} />
      </DialogRootContext.Provider>
    </IsDrawerContext.Provider>
  );
}

export interface AlertDialogRootState {}

export interface AlertDialogRootProps<Payload = unknown> extends Omit<
  DialogRoot.Props<Payload>,
  'modal' | 'disablePointerDismissal' | 'onOpenChange' | 'actionsRef' | 'handle'
> {
  /**
   * Event handler called when the dialog is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: AlertDialogRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: When specified, the dialog will not be unmounted when closed.
   * Instead, the `unmount` function must be called to unmount the dialog manually.
   * Useful when the dialog's animation is controlled by an external library.
   * - `close`: Closes the dialog imperatively when called.
   */
  actionsRef?: ReactLikeRef<AlertDialogRoot.Actions | null> | undefined;
  /**
   * A handle to associate the alert dialog with a trigger.
   * If specified, allows external triggers to control the alert dialog's open state.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
}

export type AlertDialogRootActions = DialogRoot.Actions;

export type AlertDialogRootChangeEventReason = DialogRoot.ChangeEventReason;
export type AlertDialogRootChangeEventDetails =
  BaseUIChangeEventDetails<AlertDialogRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace AlertDialogRoot {
  export type State = AlertDialogRootState;
  export type Props<Payload = unknown> = AlertDialogRootProps<Payload>;
  export type Actions = AlertDialogRootActions;
  export type ChangeEventReason = AlertDialogRootChangeEventReason;
  export type ChangeEventDetails = AlertDialogRootChangeEventDetails;
}
