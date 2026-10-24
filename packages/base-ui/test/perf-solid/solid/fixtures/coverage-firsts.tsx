// First scenarios for the components that had none (plan 3, leaf 1.13): Fieldset and the
// unstable useMediaQuery hook; and Field.Item's first (D33 batch 3). Same markup as `react/fixtures/coverage-firsts.tsx`.
import { For } from 'solid-js';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { useMediaQuery } from '@solidports/base-ui/unstable-use-media-query';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Fieldsets() {
  const disabled = useExposed('disabled', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Fieldset.Root disabled={disabled()}>
            <Fieldset.Legend>Legend {i}</Fieldset.Legend>
            <input aria-label={`Field ${i}`} />
          </Fieldset.Root>
        )}
      </For>
    </div>
  );
}

// A field's checkbox group of items, each with its own label and checkbox (D33 batch 3).
function CheckboxItems() {
  const disabled = useExposed('disabled', false);
  return (
    <Field.Root name="items" disabled={disabled()}>
      <CheckboxGroup defaultValue={[]}>
        <For each={range(size(100))}>
          {(i) => (
            <Field.Item data-testid="field-item">
              <Field.Label>Item {i}</Field.Label>
              <Checkbox.Root value={`item-${i}`} data-testid="item-checkbox" />
            </Field.Item>
          )}
        </For>
      </CheckboxGroup>
    </Field.Root>
  );
}

function MediaQueryReader() {
  const wide = useMediaQuery('(min-width: 600px)', {});
  return <span>{wide() ? 'wide' : 'narrow'}</span>;
}

function MediaQueries() {
  return (
    <div>
      <For each={range(size(1000))}>{() => <MediaQueryReader />}</For>
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'fieldset/300': Fieldsets,
  'field/checkbox-items-100': CheckboxItems,
  'unstable-use-media-query/1000': MediaQueries,
};
