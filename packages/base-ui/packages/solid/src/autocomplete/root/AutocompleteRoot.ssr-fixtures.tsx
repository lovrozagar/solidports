import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { Input } from '@solidports/base-ui/input';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  formDefaultValue: () => (
    <Form>
      <Field.Root name="search">
        <Autocomplete.Root items={['alpha', 'alpine']} defaultValue="alpha">
          <Autocomplete.Trigger>
            <Autocomplete.Value />
          </Autocomplete.Trigger>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.Input render={(props) => <Input {...props} data-testid="input" />} />
                <Autocomplete.List>
                  {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>
      <button type="submit">Submit</button>
    </Form>
  ),
});
