import { Combobox } from '@solidports/base-ui/combobox';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const FRUITS = ['Apple', 'Banana', 'Cherry'];

export default defineSsrFixtures(import.meta.url, {
  label: () => (
    <Combobox.Root inline>
      <Combobox.Label data-testid="label">Food</Combobox.Label>
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
      <Combobox.Input data-testid="input" />
    </Combobox.Root>
  ),
  withItems: () => (
    <Combobox.Root items={FRUITS} defaultValue="Banana">
      <Combobox.Input data-testid="input" />
      <Combobox.Trigger
        data-testid="trigger"
        render={(props) => <button type="button" {...props} />}
      />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  ),
});
