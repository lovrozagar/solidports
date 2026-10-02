import { expect, vi, describe, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { createRenderer } from '#test-utils';
import { screen } from '@solidjs/testing-library';

// Solid: engine detection lives in `detectBrowser` rather than the `platform` utility.
vi.mock('../../utils/detectBrowser', async () => {
  const actual = await vi.importActual<typeof import('../../utils/detectBrowser')>(
    '../../utils/detectBrowser',
  );

  return {
    ...actual,
    isFirefox: true,
  };
});

describe('<Combobox.Input /> in Gecko RTL', () => {
  const { render } = createRenderer();

  it('uses Gecko RTL caret positions for Home and End', async () => {
    const { user } = render(() => (
      <DirectionProvider direction="rtl">
        <Combobox.Root defaultInputValue="apple">
          <Combobox.Input />
        </Combobox.Root>
      </DirectionProvider>
    ));

    const input = screen.getByRole<HTMLInputElement>('combobox');
    input.focus();

    await user.keyboard('{Home}');
    expect(input.selectionStart).toBe(input.value.length);

    await user.keyboard('{End}');
    expect(input.selectionStart).toBe(0);
  });
});
