import { createMemo } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarInput(componentProps: ToolbarInput.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'focusableWhenDisabled',
    'disabled',
    'defaultValue',
    'value',
    'children',
  ]);
  const focusableWhenDisabled = () => local.focusableWhenDisabled ?? true;
  const disabledProp = () => Boolean(local.disabled);

  const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();

  const groupContext = useToolbarGroupContext();

  const disabled = () => toolbarDisabled() || (groupContext?.disabled() ?? false) || disabledProp();

  const itemMetadata = createMemo(() => ({
    disabled: disabled(),
    focusableWhenDisabled: focusableWhenDisabled(),
  }));

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    composite: true,
    disabled,
    focusableWhenDisabled,
    isNativeButton: false,
  });

  const state: ToolbarInput.State = {
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

  const preventWhenDisabled = (event: Event) => {
    if (disabled()) {
      event.preventDefault();
    }
  };

  const defaultProps: Omit<ComponentProps<'input'>, 'children'> = {
    onClick: preventWhenDisabled,
    onPointerDown: preventWhenDisabled,
    // Solid: DOM inputs have no `defaultValue` prop; seed `value` from it.
    get value() {
      return local.value ?? local.defaultValue;
    },
  };

  return (
    <CompositeItem
      tag="input"
      render={renderProps.render}
      class={renderProps.class}
      metadata={itemMetadata}
      state={state}
      ref={componentProps.ref}
      props={[defaultProps, elementProps, focusableWhenDisabledProps()]}
    >
      {local.children}
    </CompositeItem>
  );
}

export interface ToolbarInputState extends ToolbarRoot.State {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarInputProps extends BaseUIComponentProps<'input', ToolbarInput.State> {
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
  defaultValue?: ComponentProps<'input'>['value'] | undefined;
}

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props = ToolbarInputProps;
}
