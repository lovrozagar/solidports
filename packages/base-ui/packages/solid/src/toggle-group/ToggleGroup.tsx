import { Show } from 'solid-js';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { splitComponentProps } from '../solid-helpers';
import { useToolbarRootContext } from '../toolbar/root/ToolbarRootContext';
import { useToolbarGroupContext } from '../toolbar/group/ToolbarGroupContext';
import { EMPTY_ARRAY } from '../utils/empty';
import type { BaseUIChangeEventDetails } from '../utils/createBaseUIEventDetails';
import { REASONS } from '../utils/reasons';
import type { BaseUIComponentProps, HTMLProps, Orientation } from '../utils/types';
import { useControlled } from '../utils/useControlled';
import { useRenderElement } from '../utils/useRenderElement';
import { ToggleGroupContext } from './ToggleGroupContext';

/**
 * Provides a shared state to a series of toggle buttons.
 *
 * Documentation: [Base UI Toggle Group](https://base-ui.com/react/components/toggle-group)
 */
export function ToggleGroup<Value extends string>(componentProps: ToggleGroup.Props<Value>) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'defaultValue',
    'disabled',
    'loopFocus',
    'onValueChange',
    'orientation',
    'multiple',
    'value',
    'children',
  ]);
  const defaultValueProp = () => local.defaultValue;
  const disabledProp = () => Boolean(local.disabled);
  const loopFocus = () => local.loopFocus ?? true;
  const orientation = () => local.orientation ?? 'horizontal';
  const multiple = () => local.multiple ?? false;
  const valueProp = () => local.value;

  const toolbarContext = useToolbarRootContext(true);
  const toolbarGroupContext = useToolbarGroupContext();

  const defaultValue = () => defaultValueProp() ?? EMPTY_ARRAY;
  // Use the raw prop to distinguish an omitted value from the empty default.
  const isValueInitialized = () => valueProp() !== undefined || defaultValueProp() !== undefined;

  const disabled = () =>
    (toolbarContext?.disabled() ?? false) ||
    (toolbarGroupContext?.disabled() ?? false) ||
    disabledProp();

  const [groupValue, setValueState] = useControlled({
    controlled: valueProp,
    default: defaultValue,
    name: 'ToggleGroup',
    state: 'value',
  });

  const setGroupValue = (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: BaseUIChangeEventDetails<typeof REASONS.none>,
  ) => {
    let newGroupValue: Value[];
    const currentValue = groupValue();
    if (multiple()) {
      newGroupValue = currentValue.slice();
      if (nextPressed) {
        newGroupValue.push(newValue);
      } else {
        newGroupValue.splice(currentValue.indexOf(newValue), 1);
      }
    } else {
      newGroupValue = nextPressed ? [newValue] : [];
    }

    local.onValueChange?.(newGroupValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueState(newGroupValue);
  };

  const state: ToggleGroup.State = {
    get disabled() {
      return disabled();
    },
    get multiple() {
      return multiple();
    },
    get orientation() {
      return orientation();
    },
  };

  const contextValue: ToggleGroupContext<Value> = {
    disabled,
    isValueInitialized,
    setGroupValue,
    value: groupValue,
  };

  const defaultProps: Omit<HTMLProps, 'children'> = {
    role: 'group',
  };

  const element = useRenderElement('div', componentProps, {
    enabled: () => Boolean(toolbarContext),
    props: [defaultProps, elementProps],
    state,
  });

  return (
    <ToggleGroupContext value={contextValue}>
      <Show when={!toolbarContext} fallback={element()}>
        <CompositeRoot
          render={renderProps.render}
          class={renderProps.class}
          state={state}
          ref={componentProps.ref}
          props={[defaultProps, elementProps]}
          loopFocus={loopFocus()}
          orientation={orientation()}
          enableHomeAndEndKeys
        >
          {local.children}
        </CompositeRoot>
      </Show>
    </ToggleGroupContext>
  );
}

export interface ToggleGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple: boolean;
  /**
   * The orientation of the toggle group.
   */
  orientation: Orientation;
}

export interface ToggleGroupProps<Value extends string> extends BaseUIComponentProps<
  'div',
  ToggleGroup.State
> {
  /**
   * The open state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the controlled counterpart of `defaultValue`.
   */
  value?: readonly Value[] | undefined;
  /**
   * The open state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the uncontrolled counterpart of `value`.
   */
  defaultValue?: readonly Value[] | undefined;
  /**
   * Callback fired when the pressed states of the toggle group changes.
   */
  onValueChange?:
    ((groupValue: Value[], eventDetails: ToggleGroup.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the toggle group should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type ToggleGroupChangeEventReason = typeof REASONS.none;

export type ToggleGroupChangeEventDetails = BaseUIChangeEventDetails<ToggleGroup.ChangeEventReason>;

export namespace ToggleGroup {
  export type State = ToggleGroupState;
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}
