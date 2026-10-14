import { For, createMemo, omit, onSettled } from 'solid-js';
import { Autocomplete } from '@solidports/base-ui/autocomplete';

export type AutocompleteProps<Value = string> = Autocomplete.Root.Props<Value>;
export type AutocompleteActions = Autocomplete.Root.Actions;
export type AutocompleteChangeEventDetails = Autocomplete.Root.ChangeEventDetails;
export type AutocompleteChangeEventReason = Autocomplete.Root.ChangeEventReason;
export type AutocompleteHighlightEventDetails = Autocomplete.Root.HighlightEventDetails;
export type AutocompleteHighlightEventReason = Autocomplete.Root.HighlightEventReason;

export const { useFilter } = Autocomplete;

export interface SimpleAutocompleteProps extends Omit<Autocomplete.Root.Props<string>, 'children'> {
  items: readonly string[];
  ref?: (element: HTMLInputElement | null) => void;
}

function useAutocompleteFilter(
  options?: Parameters<typeof Autocomplete.useFilter>[0],
): ReturnType<typeof Autocomplete.useFilter> {
  const filter = Autocomplete.useFilter(options);

  onSettled(() => {
    filter.contains('value', 'val');
    filter.startsWith('value', 'v');
    filter.endsWith('value', 'ue');
  });

  return filter;
}

export function AutocompleteHarness(props: SimpleAutocompleteProps) {
  const rootProps = omit(props, 'items', 'ref');
  const actionsRef: { current: AutocompleteActions } = { current: { unmount() {}, close() {} } };
  const filter = useAutocompleteFilter();

  createMemo(() => filter.contains(props.items[0] ?? '', ''));

  const handleValueChange = (value: string, details: AutocompleteChangeEventDetails) => {
    const reason: AutocompleteChangeEventReason = details.reason;
    if (reason === 'item-press') {
      details.cancel();
    }
    return value;
  };

  const handleItemHighlighted = (
    _value: string | undefined,
    details: AutocompleteHighlightEventDetails,
  ) => {
    const reason: AutocompleteHighlightEventReason = details.reason;
    if (reason === 'keyboard') {
      void 0;
    }
  };

  return (
    <Autocomplete.Root
      {...rootProps}
      actionsRef={actionsRef}
      onValueChange={handleValueChange}
      onItemHighlighted={handleItemHighlighted}
    >
      <Autocomplete.Input ref={props.ref} />
      <Autocomplete.Trigger />
      <Autocomplete.Positioner>
        <Autocomplete.Popup>
          <For each={props.items}>
            {(item) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </For>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Root>
  );
}
