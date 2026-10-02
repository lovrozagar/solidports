import { expect, vi, describe, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY } from '../utils/useInitialLiveRegionTextMutation';

// Solid: OS detection lives in `detectBrowser` rather than the `platform` utility.
vi.mock('../../utils/detectBrowser', async () => {
  const actual = await vi.importActual<typeof import('../../utils/detectBrowser')>(
    '../../utils/detectBrowser',
  );

  return {
    ...actual,
    isIOS: true,
    isMac: true,
  };
});

describe('<Combobox.Status /> iOS', () => {
  const { render, clock } = createRenderer();

  clock.withFakeTimers();

  it('skips the initial text mutation', () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Status data-testid="status">Searching…</Combobox.Status>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
    expect(screen.getByTestId('status').textContent).toBe('Searching…');

    clock.tick(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

    expect(screen.getByTestId('status').textContent).toBe('Searching…');
  });
});
