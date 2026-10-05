import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { Combobox } from '@base-ui/react/combobox';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);

const selectItems = items(size(1000));
function Select1000() {
  const open = useExposed('open', false);
  return (
    <Select.Root items={selectItems} open={open} onOpenChange={setExposed('open')}>
      <Select.Trigger>
        <Select.Value data-testid="value" placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup style={{ maxHeight: '300px', overflow: 'auto' }}>
            <Select.List>
              {selectItems.map((it) => (
                <Select.Item key={it.value} value={it.value}>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                  <Select.ItemText>{it.label}</Select.ItemText>
                </Select.Item>
              ))}
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
      open={open}
      onOpenChange={setExposed('open')}
      itemToStringLabel={(it: Item) => it.label}
    >
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup style={{ maxHeight: '300px', overflow: 'auto' }}>
            <Combobox.List>
              {(it: Item) => (
                <Combobox.Item key={it.value} value={it}>
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

export const fixtures: Record<string, React.FC> = {
  'select/1000': Select1000,
  'combobox/1000': Combobox1000,
};
