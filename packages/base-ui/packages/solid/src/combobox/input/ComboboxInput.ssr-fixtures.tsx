import { Show } from 'solid-js';
import { Combobox } from '@solidports/base-ui/combobox';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

interface Country {
  code: string;
  name: string;
}

const COUNTRIES: Country[] = [
  { code: 'HR', name: 'Croatia' },
  { code: 'SI', name: 'Slovenia' },
];

function CountryInput(props: Combobox.Input.Props) {
  return (
    <Combobox.InputGroup>
      <Combobox.Input data-slot="input" {...props} onInput={() => {}} onChange={() => {}} />
      <Combobox.Trigger />
    </Combobox.InputGroup>
  );
}

export default defineSsrFixtures(import.meta.url, {
  selectedValue: () => (
    <Combobox.Root defaultValue="Initech">
      <Combobox.Input data-testid="input" />
    </Combobox.Root>
  ),
  objectItems: () => (
    <Show when={false} fallback={
      <Combobox.Root
        items={COUNTRIES}
        defaultValue={COUNTRIES[0]}
        itemToStringLabel={(country: Country) => country.name}
        itemToStringValue={(country: Country) => country.code}
        inputRef={{ current: null }}
        name="country"
      >
        <CountryInput data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(country: Country) => (
                  <Combobox.Item value={country}>{country.name}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    }>
      {null}
    </Show>
  ),
});
