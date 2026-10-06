import { omitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useClosePartRegistration } from '../../utils/closePart';
import { usePopoverRootContext } from '../root/PopoverRootContext';

/**
 * A button that closes the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverClose(props: PopoverClose.Props) {
  const elementProps = omitComponentProps(props, ['disabled', 'nativeButton'] as const);
  const disabled = () => Boolean(props.disabled);
  const nativeButton = () => Boolean(props.nativeButton ?? true);

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: false,
    native: nativeButton,
  });

  const { store } = usePopoverRootContext();
  useClosePartRegistration();

  const element = useRenderElement('button', props, {
    props: [
      ...buttonSources.attributes,
      {
        onClick(event: MouseEvent) {
          store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
        },
      },
      elementProps,
      buttonSources.handlers,
    ],
    ref: buttonRef,
  });

  return <>{element()}</>;
}

export interface PopoverCloseState {}

export interface PopoverCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', PopoverClose.State> {}

export namespace PopoverClose {
  export type State = PopoverCloseState;
  export type Props = PopoverCloseProps;
}
