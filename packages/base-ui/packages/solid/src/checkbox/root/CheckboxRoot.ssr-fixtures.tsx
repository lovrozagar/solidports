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
  // The indicator's transition machinery is created on the first check (4.8a): an unchecked one
  // that stays mounted renders its element with none.
  'indicator-keepMounted': () => (
    <Checkbox.Root data-testid="unchecked">
      <Checkbox.Indicator keepMounted data-testid="indicator">
        ✓
      </Checkbox.Indicator>
    </Checkbox.Root>
  ),
  'groupItem-nativeButton=false': () => <GroupItem nativeButton={false} />,
  'groupItem-nativeButton=true': () => <GroupItem nativeButton />,
  'explicitId-nativeButton=false': () => <ExplicitId nativeButton={false} />,
  'explicitId-nativeButton=true': () => <ExplicitId nativeButton />,
});
