import { splitComponentProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../root/FilterDropdownRootContext';

/**
 * Clears the filter query and returns focus to the input.
 *
 * @internal
 */
export function FilterDropdownClear(componentProps: FilterDropdownClear.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);
  const disabledProp = () => local.disabled ?? false;
  const nativeButton = () => local.nativeButton ?? true;

  const context = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();

  const disabled = () => context.disabled() || disabledProp();
  const visible = () => value() !== '';

  const { buttonRef, buttonSources } = useButton({
    disabled,
    native: nativeButton,
  });

  const state: FilterDropdownClear.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('button', componentProps, {
    enabled: visible,
    state,
    ref: [buttonRef],
    // The button's attributes below the part's props, its handlers above them.
    props: [
      ...buttonSources.attributes,
      {
        tabindex: -1,
        'aria-hidden': 'true',
        onMouseDown(event: MouseEvent) {
          // Avoid stealing focus from the input on pointer interaction.
          event.preventDefault();
        },
        onClick(event: MouseEvent) {
          const eventDetails = createChangeEventDetails(REASONS.clearPress, event);
          context.onValueChange('', eventDetails);
          context.focusOwnerRef.current?.focus({ preventScroll: true });
        },
      },
      elementProps,
      buttonSources.handlers,
    ],
  });

  return <>{element()}</>;
}

export interface FilterDropdownClearState {
  /** Whether the component should ignore user interaction. */
  disabled: boolean;
}

export interface FilterDropdownClearProps
  extends NativeButtonProps, BaseUIComponentProps<'button', FilterDropdownClearState> {
  /** Whether the component should ignore user interaction. */
  disabled?: boolean | undefined;
}

export namespace FilterDropdownClear {
  export type Props = FilterDropdownClearProps;
  export type State = FilterDropdownClearState;
}
