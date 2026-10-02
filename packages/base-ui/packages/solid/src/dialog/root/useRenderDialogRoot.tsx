import { Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { ComponentWithPayload, createDepsRenderEffect } from '../../solid-helpers';
import { DialogInteractions } from './useDialogRoot';
import { DialogRootContext, useDialogRootContext } from './DialogRootContext';
import { DialogStore } from '../store/DialogStore';
import type { DialogRoot, DialogRootProps } from './DialogRoot';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import {
  useImplicitActiveTrigger,
  useOpenStateTransitions,
  PopupHandleAttachment,
  usePopupRootStore,
  usePopupRootSync,
} from '../../utils/popups';
import { splitProps } from '../../solid-1-compat';

/**
 * Component form of `useRenderDialogRoot`: Solid creates JSX children eagerly, so a wrapper that
 * provides context around the dialog tree (Drawer.Root) renders this component inside its provider.
 */
export function RenderDialogRoot<Payload>(
  props: DialogRootProps<Payload> & { mode: DialogRootMode },
) {
  const [local, rest] = splitProps(props, ['mode']);
  return useRenderDialogRoot(untrack(() => local.mode), rest);
}

export function useRenderDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
) {
  const openProp = () => props.open;
  const triggerIdProp = () => props.triggerId;

  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const modal = () => (isAlertDialog ? true : (props.modal ?? true));
  const disablePointerDismissal = () => isAlertDialog || (props.disablePointerDismissal ?? false);
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;
  const rootState = {
    modal,
    disablePointerDismissal,
    nested: () => nested,
    role: () => role,
  };

  // The store is owned by this Root instance and created exactly once. It is not tied to the handle:
  // the handle attaches to it, so swapping the handle re-attaches rather than recreating state.
  // Default values are only initial values; controlled values and root state are synced after creation.
  // Dialogs pass the popup element to Floating UI as the floating element (`treatPopupAsFloatingElement`).
  const store = usePopupRootStore(
    (floatingId, floatingNested) =>
      DialogStore<Payload>(
        {
          open: props.defaultOpen ?? false,
          openProp: openProp(),
          activeTriggerId: props.defaultTriggerId ?? null,
          triggerIdProp: triggerIdProp(),
          modal: modal(),
          disablePointerDismissal: disablePointerDismissal(),
          nested,
          role,
        },
        floatingId,
        floatingNested,
      ),
    true,
  );

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);

  store.useSyncedValues(rootState);
  // Handlers read the latest props, as React re-registers them on every render.
  store.useContextCallback(
    'onOpenChange',
    (open: boolean, eventDetails: DialogRoot.ChangeEventDetails) =>
      untrack(() => props.onOpenChange)?.(open, eventDetails),
  );
  store.useContextCallback('onOpenChangeComplete', (open: boolean) =>
    untrack(() => props.onOpenChangeComplete)?.(open),
  );

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as Accessor<Payload | undefined>;

  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const { forceUnmount } = useOpenStateTransitions(open, store);

  // React's `useImperativeHandle`.
  createDepsRenderEffect(
    () => props.actionsRef,
    (actionsRef) => {
      if (!actionsRef) {
        return undefined;
      }
      actionsRef.current = {
        unmount: forceUnmount,
        close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
      };
      return () => {
        actionsRef.current = null;
      };
    },
  );

  const shouldRenderInteractions = () => open() || mounted();

  return (
    <DialogRootContext value={store as DialogStore<unknown>}>
      {props.handle && <PopupHandleAttachment handle={props.handle} store={store} />}
      <Show when={shouldRenderInteractions()}>
        <DialogInteractions
          store={store}
          parentContext={parentStore?.context}
          isDrawer={isDrawer}
        />
      </Show>
      <ComponentWithPayload payload={payload} children={props.children} />
    </DialogRootContext>
  );
}

export type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';
