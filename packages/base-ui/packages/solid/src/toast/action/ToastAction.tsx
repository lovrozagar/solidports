import { Show } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';
import { getRenderContent, useRenderableElement } from '../utils/useRenderableElement';

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastAction(componentProps: ToastAction.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);
  const nativeButton = () => Boolean(local.nativeButton ?? true);

  const { toast } = useToastRootContext();

  const { getButtonProps, buttonRef } = useButton({
    disabled: () => local.disabled,
    native: nativeButton,
  });

  const state: ToastAction.State = {
    get type() {
      return toast().type;
    },
  };

  const computedChildren = () => toast().actionProps?.children ?? componentProps.children;
  const content = () => getRenderContent(componentProps.render, computedChildren());

  const element = useRenderElement('button', componentProps, {
    get children() {
      return content();
    },
    props: [elementProps, propsSourceAccessor(() => toast().actionProps), getButtonProps],
    ref: buttonRef,
    state,
  });

  const { rendered, shouldRender } = useRenderableElement(
    element,
    () => componentProps.render,
    content,
  );

  return <Show when={shouldRender()}>{rendered()}</Show>;
}

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastAction.State> {}

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}
