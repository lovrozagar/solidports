import { Combobox } from '@solidports/base-ui/combobox';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

interface Person {
  id: string;
  name: string;
}

// An items collection created outside the component, as a module-level `createItems` call is.
const sharedPersonItems = Combobox.createItems([] as Person[], {
  getValue: (person: Person) => person.id,
  getLabel: (person: Person) => person.name,
});

export default defineSsrFixtures(import.meta.url, {
  externalWindowLabel: () => (
    <Combobox.Root
      items={sharedPersonItems}
      filteredItems={[{ id: 'user-1', name: 'Alice' }]}
      defaultValue="user-1"
    >
      <Combobox.Input data-testid="input" />
    </Combobox.Root>
  ),
});
