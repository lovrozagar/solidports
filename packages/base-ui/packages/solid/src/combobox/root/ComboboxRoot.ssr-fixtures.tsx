import { Combobox } from '@solidports/base-ui/combobox';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  label: () => (
    <Combobox.Root inline>
      <Combobox.Label data-testid="label">Food</Combobox.Label>
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
      <Combobox.Input data-testid="input" />
    </Combobox.Root>
  ),
});
