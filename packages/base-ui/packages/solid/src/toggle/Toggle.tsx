/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, Show } from 'solid-js';
import { CompositeItem } from '../internals/composite/item/CompositeItem';
import { createDepsEffect, splitComponentProps } from '../solid-helpers';
import { useToggleGroupContext } from '../toggle-group/ToggleGroupContext';
import type { ToolbarRoot } from '../toolbar/root/ToolbarRoot';
import { useButton } from '../internals/use-button/useButton';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../utils/createBaseUIEventDetails';
import { error } from '../utils/error';
import { REASONS } from '../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../utils/types';
import { useBaseUiId } from '../utils/useBaseUiId';
import { useControlled } from '../utils/useControlled';
import { useRenderElement } from '../utils/useRenderElement';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toggle](https://base-ui.com/react/components/toggle)
 */
export function Toggle<Value extends string>(componentProps: Toggle.Props<Value>) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'defaultPressed',
    'disabled',
    'form', // never participates in form validation
    'onPressedChange',
    'pressed',
    'type', // cannot change button type
    'value',
    'nativeButton',
    'children',
  ]);
  const defaultPressedProp = () => local.defaultPressed ?? false;
  const disabledProp = () => Boolean(local.disabled);
  const pressedProp = () => local.pressed;
  const valueProp = () => local.value;
  const nativeButton = () => Boolean(local.nativeButton ?? true);

  // `|| undefined` handles cases, where value is falsy (i.e. "")
  const value = useBaseUiId(() => valueProp() || undefined);

  const groupContext = useToggleGroupContext();
  const groupValue = () => groupContext?.value() ?? [];

  const defaultPressed = () => (groupContext ? undefined : defaultPressedProp());

  const disabled = () => (disabledProp() || groupContext?.disabled()) ?? false;

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({
        valueProp: valueProp(),
        isValueInitialized: groupContext?.isValueInitialized(),
      }),
      (deps) => {
        if (groupContext && deps.valueProp === undefined && deps.isValueInitialized) {
          error(
            'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
            'This will cause issues between the Toggle Group and Toggle values.',
            'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
          );
        }
      },
    );
  }

  const [pressed, setPressedState] = useControlled({
    controlled: () => (groupContext ? groupValue()?.indexOf(value()) > -1 : pressedProp()),
    default: defaultPressed,
    name: 'Toggle',
    state: 'pressed',
  });

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const state: Toggle.State = {
    get disabled() {
      return disabled();
    },
    get pressed() {
      return pressed();
    },
  };

  const props = [
    {
      get 'aria-pressed'() {
        return pressed() ? 'true' : 'false';
      },
      onClick(event: MouseEvent) {
        const nextPressed = !pressed();
        const details = createChangeEventDetails(REASONS.none, event);

        // `onPressedChange` runs before the group commits so that canceling here
        // can also veto the group value change, which shares this `details` object.
        local.onPressedChange?.(nextPressed, details);

        if (details.isCanceled) {
          return;
        }

        const val = value();
        if (val) {
          groupContext?.setGroupValue?.(val, nextPressed, details);
        }

        if (details.isCanceled) {
          return;
        }

        setPressedState(nextPressed);
      },
    },
    elementProps,
    getButtonProps,
  ];

  const element = useRenderElement('button', componentProps, {
    enabled: () => !groupContext,
    props,
    ref: buttonRef,
    state,
  });

  // A disabled toggle is natively disabled and cannot hold roving focus.
  // Toolbar reads this metadata to compute its `disabledIndices`.
  const itemMetadata = createMemo<ToolbarRoot.ItemMetadata>(() => ({
    disabled: disabled(),
    focusableWhenDisabled: false,
  }));

  return (
    <Show when={groupContext} fallback={element()}>
      <CompositeItem
        tag="button"
        render={renderProps.render}
        class={renderProps.class}
        metadata={itemMetadata}
        state={state}
        refs={[buttonRef, componentProps.ref as any]}
        props={props}
      >
        {}
        {local.children}
      </CompositeItem>
    </Show>
  );
}

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleProps<Value extends string>
  extends NativeButtonProps, BaseUIComponentProps<'button', Toggle.State> {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `pressed`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the pressed state is changed.
   */
  onPressedChange?:
    ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void) | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleChangeEventReason = typeof REASONS.none;

export type ToggleChangeEventDetails = BaseUIChangeEventDetails<Toggle.ChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<TValue extends string = string> = ToggleProps<TValue>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}
