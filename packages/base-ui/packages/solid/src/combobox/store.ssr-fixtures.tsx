import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  formValueOwnership: () => (
    <Autocomplete.Root items={['alpha', 'beta']} name="search">
      <Autocomplete.Input data-testid="input" />
      <Autocomplete.Portal>
        <Autocomplete.Positioner />
      </Autocomplete.Portal>
    </Autocomplete.Root>
  ),
});
