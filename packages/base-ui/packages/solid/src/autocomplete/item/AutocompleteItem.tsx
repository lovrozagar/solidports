/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import type { JSX } from '@solidjs/web';
import { ComboboxItem } from '../../combobox/item/ComboboxItem';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export const AutocompleteItem = ComboboxItem as unknown as (
  props: AutocompleteItemProps,
) => JSX.Element;

export interface AutocompleteItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface AutocompleteItemProps
  extends NonNativeButtonProps,
    Omit<BaseUIComponentProps<'div', AutocompleteItemState>, 'id'> {
  children?: JSX.Element;
  /**
   * An optional click handler for the item when selected.
   */
  onClick?: BaseUIComponentProps<'div', AutocompleteItemState>['onClick'] | undefined;
  /**
   * The index of the item in the list.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace AutocompleteItem {
  export type State = AutocompleteItemState;
  export type Props = AutocompleteItemProps;
}
