import { NumberField } from '@solidports/base-ui/number-field';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  defaultValue: () => (
    <NumberField.Root defaultValue={3}>
      <NumberField.Input data-testid="input" />
    </NumberField.Root>
  ),
});
