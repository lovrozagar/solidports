/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, Match, Switch } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../utils/resolveValueLabel';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * The current value of the combobox.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxValue(props: ComboboxValue.Props) {
  const store = useComboboxRootContext();

  const itemToStringLabel = store.useState('itemToStringLabel');
  const selectedValue = store.useState('selectedValue');
  const items = store.useState('items');
  const selectionMode = store.useState('selectionMode');
  const multiple = () => selectionMode() === 'multiple';
  const hasSelectedValue = store.useState('hasSelectedValue');

  const shouldCheckNullItemLabel = () =>
    !hasSelectedValue() && props.placeholder != null && props.children == null;
  const hasNullLabel = store.useState('hasNullItemLabel', shouldCheckNullItemLabel);

  return (
    <Switch fallback={resolveSelectedLabel(selectedValue(), items(), itemToStringLabel())}>
      <Match keyed when={typeof props.children === 'function' && props.children}>
        {(renderer) => renderer(selectedValue)}
      </Match>
      <Match when={props.children != null}>{props.children}</Match>
      <Match when={!hasSelectedValue() && props.placeholder != null && !hasNullLabel()}>
        {props.placeholder}
      </Match>
      <Match when={multiple() && Array.isArray(selectedValue())}>
        {resolveMultipleLabels(selectedValue(), items(), itemToStringLabel())}
      </Match>
    </Switch>
  );
}

export interface ComboboxValueState {}

export interface ComboboxValueProps {
  children?: JSX.Element | ((selectedValue: Accessor<any>) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace ComboboxValue {
  export type State = ComboboxValueState;
  export type Props = ComboboxValueProps;
}
