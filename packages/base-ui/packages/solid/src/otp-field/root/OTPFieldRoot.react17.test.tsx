import { expect, describe, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './OTPFieldRoot.ssr-fixtures';

// Solid: React 17 has no `useId`, so upstream asserts the server markup omits the slot ids until the
// client assigns them. Solid's ids come from the runtime on the server too, so the slots carry them
// in the server markup.
describe('<OTPField.Root /> with the React 17 id fallback', () => {
  it('renders generated slot ids during SSR', () => {
    renderServer(fixtures, 'twoSlots');

    const inputs = screen.getAllByRole('textbox');

    expect(inputs[0].id).not.toBe('');
    expect(inputs[1].id).not.toBe('');
    expect(inputs[0].id).not.toBe(inputs[1].id);
  });
});
