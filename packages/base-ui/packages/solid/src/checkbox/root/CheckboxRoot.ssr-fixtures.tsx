import { Checkbox } from '@solidports/base-ui/checkbox';
import { Field } from '@solidports/base-ui/field';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

function ExplicitId(props: { nativeButton: boolean }) {
  return (
    <Field.Root>
      <Field.Label data-testid="label">Label</Field.Label>
      <Checkbox.Root
        id="explicit"
        nativeButton={props.nativeButton}
        render={props.nativeButton ? 'button' : undefined}
      />
    </Field.Root>
  );
}

export default defineSsrFixtures(import.meta.url, {
  'explicitId-nativeButton=false': () => <ExplicitId nativeButton={false} />,
  'explicitId-nativeButton=true': () => <ExplicitId nativeButton />,
});
