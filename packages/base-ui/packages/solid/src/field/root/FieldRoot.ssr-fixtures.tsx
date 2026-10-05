import { createSignal, Show } from 'solid-js';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Field } from '@solidports/base-ui/field';
import { Select } from '@solidports/base-ui/select';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

function ToggleControl() {
  const [showSelect, setShowSelect] = createSignal(false);

  return (
    <>
      <Field.Root>
        <Field.Label nativeLabel={false} render={(props) => <div {...props} />} data-testid="label">
          Label
        </Field.Label>
        <Show when={showSelect()} fallback={<Checkbox.Root data-testid="checkbox" />}>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value placeholder="Pick one" />
            </Select.Trigger>
          </Select.Root>
        </Show>
      </Field.Root>
      <button type="button" onClick={() => setShowSelect((prev) => !prev)}>
        Toggle
      </button>
    </>
  );
}

function RemoveLabel() {
  const [showLabel, setShowLabel] = createSignal(true);

  return (
    <>
      <Field.Root>
        <Show when={showLabel()}>
          <Field.Label
            nativeLabel={false}
            render={(props) => <div {...props} />}
            data-testid="label"
          >
            Label
          </Field.Label>
        </Show>
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value placeholder="Pick one" />
          </Select.Trigger>
        </Select.Root>
      </Field.Root>
      <button type="button" onClick={() => setShowLabel(false)}>
        Remove Label
      </button>
    </>
  );
}

export default defineSsrFixtures(import.meta.url, {
  noLabel: () => (
    <Field.Root>
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value placeholder="Pick one" />
        </Select.Trigger>
      </Select.Root>
    </Field.Root>
  ),
  toggleControl: () => <ToggleControl />,
  removeLabel: () => <RemoveLabel />,
});
