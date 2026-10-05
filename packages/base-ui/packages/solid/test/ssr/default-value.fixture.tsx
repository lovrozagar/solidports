import { renderToString } from '@solidjs/web';
import { Field } from '@solidports/base-ui/field';
import { NumberField } from '@solidports/base-ui/number-field';

/* Uncontrolled defaults must reach the server HTML as `value` (React's SSR does this). */
export function render(): string {
  return renderToString(() => (
    <>
      <Field.Root>
        <Field.Control data-testid="text" defaultValue="ada@acme.dev" />
      </Field.Root>
      <NumberField.Root defaultValue={3}>
        <NumberField.Input />
      </NumberField.Root>
    </>
  ));
}
