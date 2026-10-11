import { Combobox } from '@solidports/base-ui/combobox';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  selectedValue: () => (
    <Combobox.Root defaultValue="Initech">
      <Combobox.Input data-testid="input" />
    </Combobox.Root>
  ),
});
