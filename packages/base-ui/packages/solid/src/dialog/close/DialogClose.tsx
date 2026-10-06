import { omitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useDialogRootContext } from '../root/DialogRootContext';

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogClose(componentProps: DialogClose.Props) {
  const elementProps = omitComponentProps(componentProps, ['disabled', 'nativeButton'] as const);
  const disabled = () => Boolean(componentProps.disabled);
  const nativeButton = () => Boolean(componentProps.nativeButton ?? true);

  const store = useDialogRootContext();
  const open = store.useState('open');

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const state: DialogClose.State = {
    get disabled() {
      return disabled();
    },
  };

  function handleClick(event: MouseEvent) {
    if (open()) {
      store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
    }
  }

  const element = useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [
      ...buttonSources.attributes,
      { onClick: handleClick },
      elementProps,
      buttonSources.handlers,
    ],
  });

  return <>{element()}</>;
}

export interface DialogCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogClose.State> {}

export interface DialogCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export namespace DialogClose {
  export type Props = DialogCloseProps;
  export type State = DialogCloseState;
}
