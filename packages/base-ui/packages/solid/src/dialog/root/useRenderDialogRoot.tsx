import { onSettled } from 'solid-js';
import type { Accessor } from 'solid-js';
import { ComponentWithPayload } from '../../solid-helpers';
import { usePopupRootStore } from '../../utils/popups';
import { DialogStore } from '../store/DialogStore';
import { DialogRootContext, IsDrawerContext, useDialogRootContext } from './DialogRootContext';
import type { DialogRoot, DialogRootProps } from './DialogRoot';
import { useDialogRoot } from './useDialogRoot';
import { splitProps } from '../../solid-1-compat';

/** Component form of `useRenderDialogRoot` so outer providers own the dialog tree. */
export function RenderDialogRoot<Payload>(
  props: DialogRootProps<Payload> & { mode: DialogRootMode },
) {
  const [local, rest] = splitProps(props, ['mode']);
  return useRenderDialogRoot(local.mode, rest);
}

export function useRenderDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
) {
  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const disablePointerDismissal = () => isAlertDialog || (props.disablePointerDismissal ?? false);
  const modal = () => (isAlertDialog ? true : (props.modal ?? true));
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentDialogRootContext = useDialogRootContext(true);
  const nested = () => Boolean(parentDialogRootContext);

  const store = usePopupRootStore(
    () =>
      props.handle?.store ??
      DialogStore<Payload>({
        get activeTriggerId() {
          return defaultTriggerIdProp();
        },
        get disablePointerDismissal() {
          return disablePointerDismissal();
        },
        get modal() {
          return modal();
        },
        get nested() {
          return nested();
        },
        get open() {
          return defaultOpen();
        },
        get openProp() {
          return openProp();
        },
        role,
        get triggerIdProp() {
          return triggerIdProp();
        },
      }),
    true,
  );

  onSettled(() => {
    if (openProp() === undefined && store.state.open === false && defaultOpen() === true) {
      store.update({
        activeTriggerId: defaultTriggerIdProp(),
        open: true,
      });
    }
  });

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);

  store.useSyncedValues({ disablePointerDismissal, modal, nested, role: () => role });
  store.useContextCallback('onOpenChange', (open: boolean, details: DialogRoot.ChangeEventDetails) =>
    props.onOpenChange?.(open, details),
  );
  store.useContextCallback('onOpenChangeComplete', (open: boolean) =>
    props.onOpenChangeComplete?.(open),
  );

  const payload = store.useState('payload') as Accessor<Payload | undefined>;

  useDialogRoot({
    get actionsRef() {
      return props.actionsRef;
    },
    isDrawer,
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
    <IsDrawerContext value={isDrawer}>
      <DialogRootContext value={contextValue as DialogRootContext}>
        <ComponentWithPayload payload={payload} children={props.children} />
      </DialogRootContext>
    </IsDrawerContext>
  );
}

export type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';
