import { For } from 'solid-js';
import { Combobox } from '@solidports/base-ui/combobox';
import type { ComboboxItemCollection } from '@solidports/base-ui/combobox';

interface User {
  id: number;
  name: string;
}

const users: User[] = [{ id: 1, name: 'Alice' }];

export const userCollection: ComboboxItemCollection<User, number> = Combobox.createItems(users, {
  getValue: (user) => user.id,
  getLabel: (user) => user.name,
});

export type ComboboxProps<
  Value = string,
  Multiple extends boolean | undefined = false,
> = Combobox.Root.Props<Value, Multiple>;
export type ComboboxActions = Combobox.Root.Actions;
export type ComboboxChangeEventDetails = Combobox.Root.ChangeEventDetails;
export type ComboboxChangeEventReason = Combobox.Root.ChangeEventReason;
export type ComboboxHighlightEventDetails = Combobox.Root.HighlightEventDetails;
export type ComboboxHighlightEventReason = Combobox.Root.HighlightEventReason;

export const { useFilter } = Combobox;

export interface SimpleComboboxProps extends Omit<Combobox.Root.Props<string, false>, 'children'> {
  items: readonly string[];
  ref?: (element: HTMLInputElement | null) => void;
}

function useComboboxFilter(
  options?: Parameters<typeof Combobox.useFilter>[0],
): ReturnType<typeof Combobox.useFilter> {
  return Combobox.useFilter(options);
}

export function ComboboxHarness(props: SimpleComboboxProps) {
  const actionsRef: { current: ComboboxActions } = { current: { unmount() {}, close() {} } };
  const filter = useComboboxFilter({ value: props.value, multiple: false });

  function handleValueChange(value: string | null, details: ComboboxChangeEventDetails) {
    const reason: ComboboxChangeEventReason = details.reason;
    if (reason === 'item-press') {
      details.cancel();
    }
    void value;
  }

  function handleItemHighlighted(value: string | undefined, details: ComboboxHighlightEventDetails) {
    void value;
    const reason: ComboboxHighlightEventReason = details.reason;
    if (reason === 'keyboard') {
      void 0;
    }
  }

  return (
    <Combobox.Root
      actionsRef={actionsRef}
      onValueChange={handleValueChange}
      onItemHighlighted={handleItemHighlighted}
      filter={filter.contains}
    >
      <Combobox.Input ref={props.ref} />
      <Combobox.Trigger />
      <Combobox.Positioner>
        <Combobox.Popup>
          <For each={props.items}>
            {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </For>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Root>
  );
}
