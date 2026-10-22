/*
 * What a selection change re-runs in an open Select (D32's batch 1 regate: select/multiple-1000
 * toggle 50 by click took 188 ms against 86 when every item read the whole value). Every item asks
 * "is my value selected". Read as a comparison against the value, a change re-evaluates every item;
 * read through the root's keyed membership, it re-runs only the items whose selection changed, so
 * the value's subscribers do not grow with the number of items.
 */
import { createRenderEffect, createRoot, createSignal, DEV, flush, getOwner } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Select } from '@solidports/base-ui/select';
import { createRenderer } from '#test-utils';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { SelectRootContext } from '../root/SelectRootContext';

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

describe('Select: a selection change re-runs only the items whose selection changed', () => {
  const { render } = createRenderer();

  function mount(count: number, multiple: boolean) {
    let root!: SelectRootContext;
    function RootProbe() {
      root = useSelectRootContext();
      return null;
    }
    const items = Array.from({ length: count }, (_, i) => `item-${i}`);
    const [value, setValue] = createSignal<string | string[] | null>(multiple ? [] : null);
    const view = render(() => (
      <Select.Root multiple={multiple} open value={value()}>
        <RootProbe />
        <Select.Trigger>
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes: written as the bench's select/1000 fixture writes it */}
                {items.map((item) => (
                  <Select.Item value={item}>
                    <Select.ItemText>{item}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    flush();
    const valueSubscribers = subscribers(() => root.store.state.value);
    const selected = () =>
      screen.queryAllByRole('option', { selected: true }).map((option) => option.textContent);
    const set = (next: string | string[] | null) => {
      setValue(next);
      flush();
    };
    return { valueSubscribers, selected, set, unmount: view.unmount };
  }

  it('a multiple value has as many subscribers at 300 items as at 30', () => {
    const small = mount(30, true);
    small.set(['item-20']);
    small.set(['item-20', 'item-3']);
    expect(small.selected()).toEqual(['item-3', 'item-20']);
    const few = small.valueSubscribers();
    small.unmount();
    const large = mount(300, true);
    large.set(['item-200']);
    large.set(['item-200', 'item-3']);
    expect(large.selected()).toEqual(['item-3', 'item-200']);
    expect(large.valueSubscribers()).toBe(few);
    large.unmount();
  });

  it('a single value has as many subscribers at 300 items as at 30', () => {
    const small = mount(30, false);
    small.set('item-20');
    expect(small.selected()).toEqual(['item-20']);
    const few = small.valueSubscribers();
    small.unmount();
    const large = mount(300, false);
    large.set('item-200');
    expect(large.selected()).toEqual(['item-200']);
    expect(large.valueSubscribers()).toBe(few);
    large.unmount();
  });
});
