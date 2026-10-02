import { createRenderer } from '#test-utils';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';

describe('<Autocomplete.InputGroup />', () => {
  const { render } = createRenderer();

  it('wraps the input and trigger', async () => {
    render(() => (
      <Autocomplete.Root items={['alpha']}>
        <Autocomplete.InputGroup data-testid="group">
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Trigger data-testid="trigger">Open</Autocomplete.Trigger>
        </Autocomplete.InputGroup>
      </Autocomplete.Root>
    ));

    expect(screen.getByTestId('group').contains(screen.getByTestId('input'))).to.equal(true);
    expect(screen.getByTestId('group').contains(screen.getByTestId('trigger'))).to.equal(true);
  });
});
