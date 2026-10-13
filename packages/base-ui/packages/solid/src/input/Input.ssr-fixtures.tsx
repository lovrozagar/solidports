import { createSignal } from 'solid-js';
import { Field } from '@solidports/base-ui/field';
import { Input } from '@solidports/base-ui/input';
import { NumberField } from '@solidports/base-ui/number-field';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';

/** The controlled fixture's value; the test changes it after hydration. */
export const [controlledValue, setControlledValue] = createSignal('Ada');

export default defineSsrFixtures(import.meta.url, {
  uncontrolled: () => (
    <form>
      <Field.Root name="name">
        <Field.Label>Name</Field.Label>
        <Input defaultValue="Ada" />
      </Field.Root>
    </form>
  ),
  uncontrolledReadOnly: () => (
    <form>
      <Field.Root name="name">
        <Field.Label>Name</Field.Label>
        <Input readOnly defaultValue="Ada" />
      </Field.Root>
    </form>
  ),
  textarea: () => (
    <form>
      <Field.Root name="name">
        <Field.Control
          render={(props) => <textarea {...(props as object)} />}
          defaultValue="Ada"
        />
      </Field.Root>
    </form>
  ),
  numberField: () => (
    <form>
      <NumberField.Root name="name" defaultValue={42}>
        <NumberField.Input />
      </NumberField.Root>
    </form>
  ),
  controlled: () => (
    <form>
      <Field.Root name="name">
        <Input value={controlledValue()} />
      </Field.Root>
    </form>
  ),
});
