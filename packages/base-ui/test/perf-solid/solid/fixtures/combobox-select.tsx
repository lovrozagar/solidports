import { For, type Accessor } from 'solid-js';
import { Select } from '@solidports/base-ui/select';
import { Combobox } from '@solidports/base-ui/combobox';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

type Item = { value: string; label: string };
const setExposed = (key: string) => (value: unknown) => setters[key](value);
const popupStyle = { 'max-height': '300px', overflow: 'auto' } as const;

function SelectFixture(props: {
  count: number;
  multiple?: boolean;
  defaultValue?: string | string[];
}) {
  const open = useExposed('open', false);
  const list = items(props.count);
  return (
    <Select.Root
      items={list}
      open={open()}
      onOpenChange={setExposed('open')}
      multiple={props.multiple as never}
      defaultValue={props.defaultValue as never}
    >
      <Select.Trigger data-testid="trigger">
        <Select.Value data-testid="value" placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup data-testid="popup" style={popupStyle}>
            <Select.List>
              <For each={list}>
                {(it) => (
                  <Select.Item value={it.value}>
                    <Select.ItemIndicator>✓</Select.ItemIndicator>
                    <Select.ItemText>{it.label}</Select.ItemText>
                  </Select.Item>
                )}
              </For>
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function ComboboxFixture(props: { count: number }) {
  const open = useExposed('open', false);
  const list = useExposed<Item[]>('items', items(props.count));
  return (
    <Combobox.Root
      items={list()}
      open={open()}
      onOpenChange={setExposed('open')}
      itemToStringLabel={(it: Item) => it.label}
    >
      <Combobox.InputGroup>
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear">×</Combobox.Clear>
        <Combobox.Trigger data-testid="trigger">▾</Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup style={popupStyle}>
            <Combobox.Empty>
              <div data-testid="empty">No results</div>
            </Combobox.Empty>
            <Combobox.List>
              {(it: Item) => (
                <Combobox.Item value={it}>
                  <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                  {it.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const multipleItems = items(size(1000));
function ComboboxMultiple() {
  const open = useExposed('open', false);
  return (
    <Combobox.Root
      items={multipleItems}
      multiple
      open={open()}
      onOpenChange={setExposed('open')}
      itemToStringLabel={(it: Item) => it.label}
    >
      <Combobox.InputGroup>
        <Combobox.Value>
          {(value: Accessor<Item[]>) => (
            <Combobox.Chips>
              <For each={value()}>
                {(it) => (
                  <Combobox.Chip data-testid="chip">
                    {it.label}
                    <Combobox.ChipRemove data-testid="chip-remove">×</Combobox.ChipRemove>
                  </Combobox.Chip>
                )}
              </For>
              <Combobox.Input data-testid="input" />
            </Combobox.Chips>
          )}
        </Combobox.Value>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup style={popupStyle}>
            <Combobox.List>
              {(it: Item) => (
                <Combobox.Item value={it}>
                  <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                  {it.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const labels = items(size(1000)).map((it) => it.label);
function AutocompleteFixture(props: { mode?: 'list' | 'both' }) {
  return (
    <Autocomplete.Root items={labels} mode={props.mode}>
      <Autocomplete.Input data-testid="input" />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4}>
          <Autocomplete.Popup style={popupStyle}>
            <Autocomplete.Empty>
              <div data-testid="empty">No results</div>
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(label: string) => <Autocomplete.Item value={label}>{label}</Autocomplete.Item>}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'select/full-1000': () => <SelectFixture count={size(1000)} />,
  'select/preselected-800': () => <SelectFixture count={size(1000)} defaultValue="item-800" />,
  'select/multiple-1000': () => <SelectFixture count={size(1000)} multiple defaultValue={[]} />,
  'combobox/full-1000': () => <ComboboxFixture count={size(1000)} />,
  'combobox/5000': () => <ComboboxFixture count={size(5000)} />,
  'combobox/multiple-1000': ComboboxMultiple,
  'autocomplete/1000': () => <AutocompleteFixture />,
  'autocomplete/both-1000': () => <AutocompleteFixture mode="both" />,
};
