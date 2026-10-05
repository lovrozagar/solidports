import { omitComponentProps } from '../solid-helpers';
import { useButton } from '../internals/use-button/useButton';
import type { BaseUIComponentProps, NativeButtonProps } from '../utils/types';
import { useRenderElement } from '../utils/useRenderElement';

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Button](https://base-ui.com/react/components/button)
 */
export function Button(componentProps: Button.Props) {
  const elementProps = omitComponentProps(componentProps, [
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
  ] as const);
  const disabled = () => Boolean(componentProps.disabled);
  const focusableWhenDisabled = () => componentProps.focusableWhenDisabled ?? false;
  const nativeButton = () => Boolean(componentProps.nativeButton ?? true);

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled,
    native: nativeButton,
  });

  const state: Button.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('button', componentProps, {
    props: [...buttonSources.attributes, elementProps, buttonSources.handlers],
    ref: buttonRef,
    state,
  });

  return element();
}

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ButtonState> {
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace Button {
  export type State = ButtonState;
  export type Props = ButtonProps;
}
