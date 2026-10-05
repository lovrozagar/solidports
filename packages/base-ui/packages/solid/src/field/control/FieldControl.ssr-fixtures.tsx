import { Field } from '@solidports/base-ui/field';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';
import { autofocus } from '../../solid-helpers';

export default defineSsrFixtures(import.meta.url, {
  autoFocus: () => (
    <Field.Root data-testid="root">
      <Field.Label data-testid="label">Name</Field.Label>
      <Field.Control autofocus ref={autofocus} />
    </Field.Root>
  ),
});
