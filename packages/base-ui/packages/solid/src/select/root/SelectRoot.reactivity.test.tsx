/*
 * Opening, selecting and closing update only the attributes that change: the trigger's and the
 * popup's props are built once, so a consumer prop is read once (a rebuilt props chain re-reads
 * every prop).
 */
import { describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { Select } from '@solidports/base-ui/select';
import { createRenderer } from '#test-utils';

describe('<Select.Root /> reactivity', () => {
  const { render } = createRenderer();

  it('does not rebuild the trigger and popup props when opening and selecting', async () => {
    let triggerReads = 0;
    let popupReads = 0;
    const triggerProbe = () => {
      triggerReads += 1;
      return 'trigger';
    };
    const popupProbe = () => {
      popupReads += 1;
      return 'popup';
    };

    const { user } = render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger" data-probe={triggerProbe()}>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-probe={popupProbe()}>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    flush();

    await user.click(screen.getByTestId('trigger'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByRole('listbox')).toHaveAttribute('data-probe', 'popup');

    await user.click(screen.getByRole('option', { name: 'b' }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.getByTestId('trigger')).toHaveTextContent('b');
    expect(triggerReads).toBe(1);
    expect(popupReads).toBe(1);
  });
});
