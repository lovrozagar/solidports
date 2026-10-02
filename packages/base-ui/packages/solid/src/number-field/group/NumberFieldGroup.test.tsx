import { expect, describe, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { NumberField } from '@solidports/base-ui/number-field';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NumberField.Group />', () => {
  const { render } = createRenderer();

  describeConformance(NumberField.Group, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <NumberField.Root>{node(props!)}</NumberField.Root>),
  }));

  it('has role prop', async () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Group />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('group')).not.toBe(null);
  });
});
