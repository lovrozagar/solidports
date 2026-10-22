/*
 * An open Combobox's items against the hand-written floor (`test/floor/combobox.tsx`, D32's
 * sweep): the dev runtime's reactive nodes one more open `Combobox.Item` adds, at most the floor
 * item's plus 25%, and the item on the native path.
 */
import { DEV, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import { FloorComboboxItem, FloorComboboxList } from '../../test/floor/combobox';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

type Item = { value: string; label: string };
const itemsOf = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Item ${i}` }));

describe('combobox cost against the hand-written floor', () => {
  const { render } = createRenderer();

  function nodes(ui: () => JSX.Element) {
    count = 0;
    hooks.onOwner = counting;
    const view = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    view.unmount();
    return created;
  }

  // As the bench's combobox/1000 fixture writes it: the root's `items` and a render function.
  const part = (n: number) => () => (
    <Combobox.Root items={itemsOf(n)} open itemToStringLabel={(it: Item) => it.label}>
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
  );

  const floor = (n: number) => () => {
    const [active, setActive] = createSignal(-1);
    const [value, setValue] = createSignal<unknown>(null);
    return (
      <FloorComboboxList active={active} setActive={setActive} value={value} onSelect={setValue}>
        {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written list writes */}
        {itemsOf(n).map((it, index) => (
          <FloorComboboxItem value={it} index={index}>
            {it.label}
          </FloorComboboxItem>
        ))}
      </FloorComboboxList>
    );
  };

  /** Nodes one more item adds to an open list of four. */
  const perItem = (shape: (n: number) => () => JSX.Element) => nodes(shape(5)) - nodes(shape(4));

  it('the floor renders the same option DOM as an open Combobox.Item', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      const options = [...document.querySelectorAll('[role="option"]')].map((el) => {
        const wrapper = document.createElement('div');
        wrapper.append(el.cloneNode(true));
        return normalizeTree(wrapper);
      });
      view.unmount();
      return options;
    };
    expect(html(floor(2))).toEqual(html(part(2)));
  });

  it('an open Combobox.Item renders on the native path', () => {
    const view = render(part(2));
    flush();
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options.map((el) => renderPathOf(el))).toEqual(['native', 'native']);
    view.unmount();
  });

  it('an open Combobox.Item costs at most the floor item plus 25%', () => {
    const budget = perItem(floor);
    const cost = perItem(part);
    expect(cost, `open Combobox.Item ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });
});
