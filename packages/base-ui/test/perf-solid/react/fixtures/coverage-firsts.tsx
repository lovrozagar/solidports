// First scenarios for the components that had none (plan 3, leaf 1.13): Fieldset and the
// unstable useMediaQuery hook; and Field.Item's first (D33 batch 3). Same markup as `solid/fixtures/coverage-firsts.tsx`.
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { useMediaQuery } from '@base-ui/react/unstable-use-media-query';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Fieldsets() {
  const disabled = useExposed('disabled', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <Fieldset.Root key={i} disabled={disabled}>
          <Fieldset.Legend>Legend {i}</Fieldset.Legend>
          <input aria-label={`Field ${i}`} />
        </Fieldset.Root>
      ))}
    </div>
  );
}

// A field's checkbox group of items, each with its own label and checkbox (D33 batch 3).
function CheckboxItems() {
  const disabled = useExposed('disabled', false);
  return (
    <Field.Root name="items" disabled={disabled}>
      <CheckboxGroup defaultValue={[]}>
        {range(size(100)).map((i) => (
          <Field.Item key={i} data-testid="field-item">
            <Field.Label>Item {i}</Field.Label>
            <Checkbox.Root value={`item-${i}`} data-testid="item-checkbox" />
          </Field.Item>
        ))}
      </CheckboxGroup>
    </Field.Root>
  );
}

function MediaQueryReader() {
  const wide = useMediaQuery('(min-width: 600px)', {});
  return <span>{wide ? 'wide' : 'narrow'}</span>;
}

function MediaQueries() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <MediaQueryReader key={i} />
      ))}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'fieldset/300': Fieldsets,
  'field/checkbox-items-100': CheckboxItems,
  'unstable-use-media-query/1000': MediaQueries,
};
