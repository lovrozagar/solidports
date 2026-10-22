/*
 * What a selection change re-runs in an open Combobox (D32's batch 1 regate: combobox/multiple-1000
 * select 50 by click and remove 10 chips): every item reads "is my value in the selected value".
 * Read through the root's keyed membership, a change re-runs only the items that joined or left the
 * selection, so the value's subscribers do not grow with the number of items. The values are the
 * bench's item objects, keyed by identity.
 */
import { createRenderEffect, createRoot, createSignal, DEV, flush, getOwner } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { createRenderer } from '#test-utils';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

/** The computations other than a probe's that read what `read` reads. */
function subscribers(read: () => void) {
  let probe: unknown;
  const dispose = createRoot((disposeRoot) => {
    createRenderEffect(
      () => {
        probe = getOwner();
        read();
      },
      () => {},
    );
    return disposeRoot;
  });
  onTestFinished(dispose);
  return () =>
    (DEV!.getSources(probe as never) as unknown[]).reduce<number>(
      (count, source) =>
        count +
        (DEV!.getObservers(source as never) as unknown[]).filter((observer) => observer !== probe)
          .length,
      0,
    );
}

type Item = { value: string; label: string };

describe('Combobox: a selection change re-runs only the items whose selection changed', () => {
  const { render } = createRenderer();

  function mount(count: number, multiple: boolean) {
    let store!: ComboboxStore;
    function RootProbe() {
      store = useComboboxRootContext();
      return null;
    }
    const items: Item[] = Array.from({ length: count }, (_, i) => ({
      value: `v${i}`,
      label: `Item ${i}`,
    }));
    const [value, setValue] = createSignal<Item | Item[] | null>(multiple ? [] : null);
    const view = render(() => (
      <Combobox.Root
        items={items}
        multiple={multiple}
        open
        value={value()}
        itemToStringLabel={(it: Item) => it.label}
      >
        <RootProbe />
        <Combobox.Input />
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
    flush();
    const valueSubscribers = subscribers(() => store.state.selectedValue);
    const selected = () =>
      screen.queryAllByRole('option', { selected: true }).map((option) => option.textContent);
    const set = (next: Item | Item[] | null) => {
      setValue(next);
      flush();
    };
    return { items, valueSubscribers, selected, set, unmount: view.unmount };
  }

  it('a multiple value has as many subscribers at 300 items as at 30', () => {
    const small = mount(30, true);
    small.set([small.items[20]]);
    small.set([small.items[20], small.items[3]]);
    expect(small.selected()).toEqual(['Item 3', 'Item 20']);
    const few = small.valueSubscribers();
    small.unmount();
    const large = mount(300, true);
    large.set([large.items[200]]);
    large.set([large.items[200], large.items[3]]);
    expect(large.selected()).toEqual(['Item 3', 'Item 200']);
    expect(few).toBe(7);
    expect(large.valueSubscribers()).toBe(few);
    large.unmount();
  });

  it('a single value has as many subscribers at 300 items as at 30', () => {
    const small = mount(30, false);
    small.set(small.items[20]);
    expect(small.selected()).toEqual(['Item 20']);
    const few = small.valueSubscribers();
    small.unmount();
    const large = mount(300, false);
    large.set(large.items[200]);
    expect(large.selected()).toEqual(['Item 200']);
    expect(few).toBe(8);
    expect(large.valueSubscribers()).toBe(few);
    large.unmount();
  });
});
