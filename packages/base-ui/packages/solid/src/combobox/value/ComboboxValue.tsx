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

  // One read: each read of JSX children creates them anew.
  const children = createMemo(() => props.children);

  return (
    <Switch fallback={resolveSelectedLabel(selectedValue(), items(), itemToStringLabel())}>
      <Match keyed when={typeof children() === 'function' && children()}>
        {(renderer) => (renderer as (value: typeof selectedValue) => JSX.Element)(selectedValue)}
      </Match>
      <Match when={children() != null}>{children() as JSX.Element}</Match>
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
  /**
   * Accepts a function that returns a `ReactNode` to format the selected value.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   */
  children?: JSX.Element | ((selectedValue: Accessor<any>) => JSX.Element) | undefined;
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element | undefined;
}

export namespace ComboboxValue {
  export type State = ComboboxValueState;
  export type Props = ComboboxValueProps;
}
