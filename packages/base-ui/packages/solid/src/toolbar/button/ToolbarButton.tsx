import { createMemo, untrack } from 'solid-js';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { EMPTY_OBJECT } from '../../utils/empty';
import { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarButton(componentProps: ToolbarButton.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
    'children',
  ]);
  const disabledProp = () => Boolean(local.disabled);
  const focusableWhenDisabled = () => local.focusableWhenDisabled ?? true;
  const nativeButton = () => Boolean(local.nativeButton ?? true);

  const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();

  const groupContext = useToolbarGroupContext();

  const disabled = () => toolbarDisabled() || (groupContext?.disabled() ?? false) || disabledProp();

  const itemMetadata = createMemo(() => ({
    disabled: disabled(),
    focusableWhenDisabled: focusableWhenDisabled(),
  }));

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled,
    native: nativeButton,
  });

  const state: ToolbarButton.State = {
    get disabled() {
      return disabled();
    },
    get focusable() {
      return focusableWhenDisabled();
    },
    get orientation() {
      return orientation();
    },
  };

  return (
    <CompositeItem
      tag="button"
      render={renderProps.render}
      class={renderProps.class}
      metadata={itemMetadata}
      state={state}
      ref={componentProps.ref}
      refs={[buttonRef]}
      props={[
        elementProps,
        // When a render prop is provided (typically another Base UI component
        // like Menu.Trigger), forward `disabled` so the rendered component can
        // derive its own disabled state. For the default toolbar button, avoid
        // forwarding a `disabled` prop so focusable disabled buttons remain
        // hoverable for interactions like tooltips.
        // TODO: follow up after https://github.com/mui/base-ui/issues/1976#issuecomment-2916905663
        // Solid: `render` is read once; a `disabled` key holding `undefined` would override
        // the native `disabled` from `getButtonProps`, so the key must be absent without `render`.
        untrack(() => renderProps.render)
          ? {
              get disabled() {
                return disabled();
              },
            }
          : EMPTY_OBJECT,
        getButtonProps,
      ]}
    >
      {local.children}
    </CompositeItem>
  );
}

export interface ToolbarButtonState extends ToolbarRoot.State {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToolbarButtonState> {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props = ToolbarButtonProps;
}
