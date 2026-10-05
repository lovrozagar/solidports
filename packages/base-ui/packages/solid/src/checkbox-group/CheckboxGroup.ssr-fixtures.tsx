import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';

function SharedFieldRootGroup(props: { nativeButton: boolean }) {
  const checkboxProps = () => ({
    nativeButton: props.nativeButton,
    render: props.nativeButton ? ('button' as const) : undefined,
  });

  return (
    <Field.Root name="apples">
      <Field.Label>Apples</Field.Label>
      <CheckboxGroup allValues={['fuji', 'gala']}>
        <Checkbox.Root parent data-testid="parent" {...checkboxProps()} />
        <Checkbox.Root value="fuji" data-testid="fuji" {...checkboxProps()} />
        <Checkbox.Root value="gala" data-testid="gala" {...checkboxProps()} />
      </CheckboxGroup>
    </Field.Root>
  );
}

function GroupedLabel(props: { nativeButton: boolean; parent: boolean }) {
  return (
    <Field.Root name="apple">
      <CheckboxGroup allValues={['fuji']}>
        <Field.Item>
          <Field.Label data-testid="label">Fuji</Field.Label>
          <Checkbox.Root
            parent={props.parent}
            value={props.parent ? undefined : 'fuji'}
            nativeButton={props.nativeButton}
            render={props.nativeButton ? 'button' : undefined}
          />
        </Field.Item>
      </CheckboxGroup>
    </Field.Root>
  );
}

function ParentControls(props: { nativeButton: boolean }) {
  return (
    <Field.Root name="apple">
      <CheckboxGroup allValues={['fuji']}>
        <Field.Item>
          <Field.Label data-testid="label">All</Field.Label>
          <Checkbox.Root
            parent
            data-testid="parent"
            nativeButton={props.nativeButton}
            render={props.nativeButton ? 'button' : undefined}
          />
        </Field.Item>
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
  'shared-nativeButton=false': () => <SharedFieldRootGroup nativeButton={false} />,
  'shared-nativeButton=true': () => <SharedFieldRootGroup nativeButton />,
  'grouped-nativeButton=false-parent=false': () => (
    <GroupedLabel nativeButton={false} parent={false} />
  ),
  'grouped-nativeButton=true-parent=false': () => <GroupedLabel nativeButton parent={false} />,
  'grouped-nativeButton=false-parent=true': () => <GroupedLabel nativeButton={false} parent />,
  'grouped-nativeButton=true-parent=true': () => <GroupedLabel nativeButton parent />,
  'parentControls-nativeButton=false': () => <ParentControls nativeButton={false} />,
  'parentControls-nativeButton=true': () => <ParentControls nativeButton />,
});
