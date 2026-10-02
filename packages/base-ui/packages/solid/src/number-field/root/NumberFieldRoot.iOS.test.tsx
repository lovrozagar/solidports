import { expect, vi, describe, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { NumberField } from '@solidports/base-ui/number-field';
import { createRenderer } from '#test-utils';

vi.mock('../../utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../utils/platform')>('../../utils/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, ios: true, apple: true },
    },
  };
});

describe('<NumberField.Root /> iOS', () => {
  const { render } = createRenderer();

  // The iOS numeric software keyboard has no decimal key, and no minus key at all, so the input
  // mode is widened just enough to keep every valid character typeable.
  it('uses the decimal keyboard when negative values are impossible', async () => {
    await render(() => (
      <NumberField.Root min={0}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'decimal');
  });

  it('uses the text keyboard when negative values are allowed', async () => {
    await render(() => (
      <NumberField.Root min={-5}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'text');
  });

  it('uses the text keyboard when no minimum is set', async () => {
    await render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'text');
  });
});
