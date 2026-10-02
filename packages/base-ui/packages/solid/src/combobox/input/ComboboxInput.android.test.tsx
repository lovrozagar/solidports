import { expect, vi, describe, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { createRenderer } from '#test-utils';
import { fireEvent, screen } from '@solidjs/testing-library';

// Solid: OS detection lives in `detectBrowser` rather than the `platform` utility.
vi.mock('../../utils/detectBrowser', async () => {
  const actual = await vi.importActual<typeof import('../../utils/detectBrowser')>(
    '../../utils/detectBrowser',
  );

  return {
    ...actual,
    isAndroid: true,
  };
});

describe('<Combobox.Input /> on Android', () => {
  const { render } = createRenderer();

  it('propagates changes during Android composition', () => {
    const onInputValueChange = vi.fn();
    render(() => (
      <Combobox.Root onInputValueChange={onInputValueChange}>
        <Combobox.Input />
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    fireEvent.compositionStart(input);
    // Solid: `input` is the per-keystroke event React exposes as `onChange`.
    fireEvent.input(input, { target: { value: 'a' } });

    expect(onInputValueChange).toHaveBeenCalledWith('a', expect.anything());
  });
});
