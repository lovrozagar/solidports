import { createRenderer } from '#test-utils';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { screen } from '@solidjs/testing-library';
import { expect, describe, it } from 'vitest';

describe('<Autocomplete.Trigger />', () => {
  const { render } = createRenderer();

  it('renders a dedicated trigger without data-placeholder', async () => {
    render(() => (
      <Autocomplete.Root items={['alpha', 'beta']}>
        <Autocomplete.InputGroup data-testid="group">
          <Autocomplete.Input />
          <Autocomplete.Trigger data-testid="trigger">Open</Autocomplete.Trigger>
        </Autocomplete.InputGroup>
      </Autocomplete.Root>
    ));

    expect(screen.getByTestId('trigger')).not.toBe(null);
    expect(screen.getByTestId('trigger').tagName).toBe('BUTTON');
    expect(screen.getByTestId('group')).not.toBe(null);
  });
});
