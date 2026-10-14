import { For } from 'solid-js';
import { Select } from '@solidports/base-ui/select';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const FONTS = [
  { value: 'sans', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
];

export default defineSsrFixtures(import.meta.url, {
  label: () => (
    <Select.Root>
      <Select.Label data-testid="label">Font</Select.Label>
      <Select.Trigger data-testid="trigger">
        <Select.Value />
      </Select.Trigger>
    </Select.Root>
  ),
  withItems: () => (
    <Select.Root items={FONTS} defaultValue="serif">
      <Select.Trigger
        data-testid="trigger"
        render={(props) => <button type="button" {...props} />}
      >
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <For each={FONTS}>
              {(font) => <Select.Item value={font().value}>{font().label}</Select.Item>}
            </For>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  ),
});
