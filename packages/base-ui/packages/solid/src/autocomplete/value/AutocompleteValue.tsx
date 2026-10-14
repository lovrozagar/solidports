import { createMemo, Match, Switch } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxInputValueContext } from '../../combobox/root/ComboboxRootContext';

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export function AutocompleteValue(props: AutocompleteValue.Props) {
  const inputValue = useComboboxInputValueContext();
  // The function child reads the value as text, as React passes it `String(inputValue)`.
  const text = createMemo(() => String(inputValue()));
  // One read: each read of JSX children creates them anew.
  const children = createMemo(() => props.children);

  return (
    <Switch fallback={<>{inputValue()}</>}>
      <Match
        keyed
        when={
          typeof children() === 'function'
            ? (children() as (value: Accessor<string>) => JSX.Element)
            : undefined
        }
      >
        {(renderer) => renderer(text)}
      </Match>
      <Match when={children() != null}>{children() as JSX.Element}</Match>
    </Switch>
  );
}

export interface AutocompleteValueState {}

export interface AutocompleteValueProps {
  children?: JSX.Element | ((value: Accessor<string>) => JSX.Element) | undefined;
}

export namespace AutocompleteValue {
  export type State = AutocompleteValueState;
  export type Props = AutocompleteValueProps;
}
