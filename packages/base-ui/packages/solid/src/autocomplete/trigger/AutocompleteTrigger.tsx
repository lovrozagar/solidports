import type { JSX } from 'solid-js';
import { ComboboxTrigger } from '../../combobox/trigger/ComboboxTrigger';
import type { FieldRootState } from '../../field/root/FieldRoot';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import type { Side } from '../../utils/useAnchorPositioning';

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export const AutocompleteTrigger = ComboboxTrigger as unknown as (
  props: AutocompleteTriggerProps,
) => JSX.Element;

export interface AutocompleteTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   *  Whether the component should ignore user edits.
   */
  readOnly: boolean;
}

export interface AutocompleteTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', AutocompleteTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace AutocompleteTrigger {
  export type State = AutocompleteTriggerState;
  export type Props = AutocompleteTriggerProps;
}
