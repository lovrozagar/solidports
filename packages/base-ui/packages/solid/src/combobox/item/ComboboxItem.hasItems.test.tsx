/*
 * Combobox items read "does the root have an `items` collection" (`ComboboxHasItemsContext`) in
 * two effects each. Read as a plain accessor over the root's `items`, every item subscribed to the
 * collection itself: a new `items` array, even one that keeps every item, notified 2 x 1,000 item
 * effects although the answer stayed `true` (Solid's HUGE_FAN_OUT diagnostic counted 2,012
 * subscribers on the combobox/full-1000 bench). Plan 3, 4.9.
 */
import { createSignal, flush } from 'solid-js';
import { Combobox } from '@solidports/base-ui/combobox';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from '#test-utils';

type Item = { value: string; label: string };
const makeItems = (count: number, prefix = 'item') =>
  Array.from({ length: count }, (_, i) => ({ value: `${prefix}-${i}`, label: `Item ${i}` }));

describe('Combobox items: has-items context', () => {
  const { render } = createRenderer();

  it('a new items array that keeps every item does not fan out to each item', async () => {
    const [items, setItems] = createSignal<Item[]>(makeItems(1000));
    render(() => (
      <Combobox.Root items={items()} defaultOpen itemToStringLabel={(it: Item) => it.label}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(it: Item) => <Combobox.Item value={it}>{it.label}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    expect(screen.getAllByRole('option')).toHaveLength(1000);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      setItems((current) => [...current, ...makeItems(1, 'extra')]);
      flush();
      const fanOut = warn.mock.calls.map((args) => String(args[0])).filter((text) => text.includes('HUGE_FAN_OUT'));
      expect(fanOut).toEqual([]);
    } finally {
      warn.mockRestore();
    }
    expect(screen.getAllByRole('option')).toHaveLength(1001);
  });
});
