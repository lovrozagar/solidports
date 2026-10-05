import { For } from 'solid-js';
import { Select } from '@solidports/base-ui/select';
import { Combobox } from '@solidports/base-ui/combobox';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);

const selectItems = items(size(1000));
function Select1000() {
  const open = useExposed('open', false);
  return (
    <Select.Root items={selectItems} open={open()} onOpenChange={setExposed('open')}>
      <Select.Trigger>
        <Select.Value data-testid="value" placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={{ 'max-height': '300px', overflow: 'auto' }}>
            <Select.List>
              <For each={selectItems}>
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

type Item = { value: string; label: string };
const comboItems = items(size(1000));
function Combobox1000() {
  const open = useExposed('open', false);
  return (
    <Combobox.Root
      items={comboItems}
      open={open()}
      onOpenChange={setExposed('open')}
      itemToStringLabel={(it: Item) => it.label}
    >
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup style={{ 'max-height': '300px', overflow: 'auto' }}>
            <Combobox.List>
              {(it: Item) => <Combobox.Item value={it}>{it.label}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'select/1000': Select1000,
  'combobox/1000': Combobox1000,
};
