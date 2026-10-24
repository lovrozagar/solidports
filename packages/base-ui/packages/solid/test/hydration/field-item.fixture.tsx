import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';

/** A field's checkbox group of items, each with its own label, rendered on the server and hydrated. */
export function FieldItemFixture() {
  return (
    <Field.Root name="apple">
      <CheckboxGroup defaultValue={['gala']}>
        <Field.Item data-testid="item-fuji">
          <Field.Label>Fuji</Field.Label>
          <Checkbox.Root value="fuji" />
        </Field.Item>
        <Field.Item data-testid="item-gala" disabled>
          <Field.Label>Gala</Field.Label>
          <Checkbox.Root value="gala" />
        </Field.Item>
      </CheckboxGroup>
    </Field.Root>
  );
}
