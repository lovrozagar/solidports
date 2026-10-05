import { createMemo, untrack } from 'solid-js';
import { useClick } from '../../floating-ui-solid';
import { splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import { CLICK_TRIGGER_IDENTIFIER } from '../../utils/constants';
import { usePopupHandleStore, useTriggerDataForwarding } from '../../utils/popups';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useOpenMethodTriggerProps } from '../../utils/useOpenInteractionType';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useDialogRootContext } from '../root/DialogRootContext';
import { DialogHandle } from '../store/DialogHandle';
import type { DialogHandleStore } from '../store/DialogStore';

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogTrigger<Payload>(componentProps: DialogTrigger.Props<Payload>) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'nativeButton',
    'id',
    'payload',
    'handle',
  ]);
  const disabled = () => Boolean(local.disabled);
  const nativeButton = () => local.nativeButton ?? true;

  const dialogRootStore = useDialogRootContext(true);
  // The handle is read once: a trigger keeps the handle it mounted with.
  const handleStore = usePopupHandleStore(() => local.handle);
  const store = (): DialogHandleStore<unknown> =>
    (handleStore() ?? dialogRootStore) as DialogHandleStore<unknown>;
  if (!untrack(() => handleStore() ?? dialogRootStore)) {
    throw new Error(
      'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => local.id);
  const isOpenedByThisTrigger = createMemo(() =>
    store().select('isOpenedByTrigger', thisTriggerId),
  );
  const popupId = createMemo(() => store().select('triggerPopupId', thisTriggerId));

  const triggerElementRef: ReactLikeRef<HTMLElement | null> = { current: null };

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      get payload() {
        return local.payload;
      },
    },
  );

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const click = useClick({
    get context() {
      return store().context.floatingRootContext;
    },
  });
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => store().select('open'),
    (interactionType) => {
      untrack(store).set('openMethod', interactionType);
    },
  );

  const state: DialogTriggerState = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  // Sources the element props read per key: a state change updates its attribute without
  // rebuilding the element's props chain.
  const rootTriggerProps = propsSourceAccessor(
    createMemo(() => store().select('triggerProps', isMountedByThisTrigger)),
  );
  const interactionProps = {
    onClick: interactionTypeProps.onClick,
    onPointerDown: interactionTypeProps.onPointerDown,
  };
  const triggerProps = {
    [CLICK_TRIGGER_IDENTIFIER as string]: '',
    get id() {
      return thisTriggerId();
    },
    'aria-haspopup': 'dialog' as const,
    get 'aria-expanded'() {
      return isOpenedByThisTrigger() ? 'true' : 'false';
    },
    get 'aria-controls'() {
      return popupId();
    },
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: [
      buttonRef,
      registerTrigger,
      (el: HTMLElement | null) => {
        triggerElementRef.current = el;
      },
    ],
    props: [
      propsSourceAccessor(() => click.reference),
      rootTriggerProps,
      interactionProps,
      triggerProps,
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return <>{element()}</>;
}

export interface DialogTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogTriggerState> {
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
  payload?: NoInfer<Payload> | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export namespace DialogTrigger {
  export type Props<Payload = unknown> = DialogTriggerProps<Payload>;
  export type State = DialogTriggerState;
}
