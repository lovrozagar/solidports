import { createRenderer } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';
import { AriaCombobox } from './AriaCombobox';

describe('AriaCombobox call shapes', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  it('selectionMode="none" routes input value via onInputValueChange', async () => {
    const onInputValueChange = vi.fn();
    const onSelectedValueChange = vi.fn();

    const { user } = render(() => (
      <AriaCombobox
        selectionMode="none"
        onInputValueChange={onInputValueChange}
        onSelectedValueChange={onSelectedValueChange}
      >
        <Combobox.Input data-testid="input" />
      </AriaCombobox>
    ));

    await user.type(screen.getByTestId('input'), 'a');

    /* onInputValueChange must fire with the typed value */
    expect(onInputValueChange).toHaveBeenCalled();
    const calls = onInputValueChange.mock.calls;
    const lastValue = calls[calls.length - 1][0] as string;
    expect(lastValue).toBe('a');

    /* onSelectedValueChange must NOT fire for plain input typing in none mode */
    expect(onSelectedValueChange).not.toHaveBeenCalled();
  });

  it('selectionMode="single" routes selected value via onSelectedValueChange', async () => {
    const onSelectedValueChange = vi.fn();

    const { user } = render(() => (
      <AriaCombobox<string, 'single'>
        selectionMode="single"
        items={['a', 'b']}
        onSelectedValueChange={onSelectedValueChange}
      >
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </AriaCombobox>
    ));

    /* open popup then select item 'a' */
    await user.click(screen.getByTestId('input'));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'a' })).not.toBeNull());
    await user.click(screen.getByRole('option', { name: 'a' }));

    expect(onSelectedValueChange).toHaveBeenCalled();
    const [value, eventDetails] = onSelectedValueChange.mock.calls[0] as [string, object];
    expect(value).toBe('a');
    expect(eventDetails).toEqual(expect.any(Object));
  });

  it('selectionMode="multiple" yields array via onSelectedValueChange', async () => {
    const onSelectedValueChange = vi.fn();

    const { user } = render(() => (
      <AriaCombobox<string, 'multiple'>
        selectionMode="multiple"
        items={['a', 'b']}
        onSelectedValueChange={onSelectedValueChange}
      >
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </AriaCombobox>
    ));

    /* select 'a' */
    await user.click(screen.getByTestId('input'));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'a' })).not.toBeNull());
    await user.click(screen.getByRole('option', { name: 'a' }));

    /* popup stays open in multiple mode — select 'b' */
    await waitFor(() => expect(screen.queryByRole('option', { name: 'b' })).not.toBeNull());
    await user.click(screen.getByRole('option', { name: 'b' }));

    /* last call must carry both values as an array */
    expect(onSelectedValueChange).toHaveBeenCalled();
    const lastCallArgs = onSelectedValueChange.mock.calls[
      onSelectedValueChange.mock.calls.length - 1
    ] as [string[], object];
    expect(lastCallArgs[0]).toEqual(['a', 'b']);
  });
});
