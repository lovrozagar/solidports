import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { Input } from '@solidports/base-ui/input';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  inlineFormName: () => (
    <Form>
      <Field.Root name="search">
        <Autocomplete.Root items={['alpha', 'alpine']} inline>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.List>
            {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
        </Autocomplete.Root>
      </Field.Root>
      <button type="submit">Submit</button>
    </Form>
  ),
  outsidePopupFormName: () => (
    <Form>
      <Field.Root name="search">
        <Autocomplete.Root items={['alpha', 'alpine']}>
          <Autocomplete.InputGroup>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Trigger>Open</Autocomplete.Trigger>
          </Autocomplete.InputGroup>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
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
