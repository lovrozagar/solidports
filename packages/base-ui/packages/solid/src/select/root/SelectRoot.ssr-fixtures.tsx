import { Select } from '@solidports/base-ui/select';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  label: () => (
    <Select.Root>
      <Select.Label data-testid="label">Font</Select.Label>
      <Select.Trigger data-testid="trigger">
        <Select.Value />
      </Select.Trigger>
    </Select.Root>
  ),
});
