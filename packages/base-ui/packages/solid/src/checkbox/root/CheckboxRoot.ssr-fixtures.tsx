import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
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

function GroupItem(props: { nativeButton: boolean }) {
  return (
    <Field.Root name="apple">
      <CheckboxGroup allValues={['fuji']}>
        <Field.Item>
          <Field.Label data-testid="label">Fuji</Field.Label>
          <Checkbox.Root
            value="fuji"
            data-testid="fuji"
            nativeButton={props.nativeButton}
            render={props.nativeButton ? 'button' : undefined}
          />
        </Field.Item>
      </CheckboxGroup>
    </Field.Root>
  );
}

export default defineSsrFixtures(import.meta.url, {
  'groupItem-nativeButton=false': () => <GroupItem nativeButton={false} />,
  'groupItem-nativeButton=true': () => <GroupItem nativeButton />,
  'explicitId-nativeButton=false': () => <ExplicitId nativeButton={false} />,
  'explicitId-nativeButton=true': () => <ExplicitId nativeButton />,
});
