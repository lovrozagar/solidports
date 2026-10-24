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
const values = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);
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

/** A grid list's Row at D32's port; the slow path's in the comment. */
const ROW_BUDGET = 3; // slow 12

describe('combobox row cost', () => {
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

  // An open grid list of rows, each with one item; `rows` false renders the items alone.
  const grid = (rows: boolean) => (n: number) => () => (
    <Combobox.Root open grid>
      <Combobox.Input />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
              {itemsOf(n).map((it) =>
                rows ? (
                  <Combobox.Row>
                    <Combobox.Item value={it}>{it.label}</Combobox.Item>
                  </Combobox.Row>
                ) : (
                  <Combobox.Item value={it}>{it.label}</Combobox.Item>
                ),
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );

  it('a Row renders on the native path', () => {
    const view = render(grid(true)(2));
    flush();
    const rows = [...document.querySelectorAll('[role="row"]')];
    expect(rows.map((el) => renderPathOf(el))).toEqual(['native', 'native']);
    view.unmount();
  });

  it('a Row stays within its native budget', () => {
    const perItem = (rows: boolean) => nodes(grid(rows)(5)) - nodes(grid(rows)(4));
    const cost = perItem(true) - perItem(false);
    expect(cost, `Combobox.Row ${cost} nodes`).toBe(ROW_BUDGET);
  });
});

/** A multiple combobox's chip at D32's port; the slow path's in the comment. */
const CHIP_BUDGET = 6; // slow 16
/** A chip's remove button, net of the chip; the slow path's in the comment. */
const CHIP_REMOVE_BUDGET = 2; // slow 10

describe('combobox chip cost', () => {
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

  // A closed multiple combobox with one chip per selected value, as the bench's multiple-1000
  // fixture writes it (`remove`: with each chip's remove button).
  const chips = (remove: boolean) => (n: number) => () => (
    <Combobox.Root multiple defaultValue={values(n)}>
      <Combobox.Chips>
        {/* eslint-disable-next-line solid/prefer-for -- the chips never change */}
        {values(n).map((value) => (
          <Combobox.Chip>
            {value}
            {remove ? <Combobox.ChipRemove>×</Combobox.ChipRemove> : null}
          </Combobox.Chip>
        ))}
        <Combobox.Input />
      </Combobox.Chips>
    </Combobox.Root>
  );

  it('a Chip renders on the native path', () => {
    const view = render(chips(false)(2));
    flush();
    const rendered = [...document.querySelectorAll('[tabindex="-1"]')].filter(
      (el) => el.tagName === 'DIV',
    );
    expect(rendered.map((el) => renderPathOf(el))).toEqual(['native', 'native']);
    view.unmount();
  });

  it('a ChipRemove renders on the native path', () => {
    const view = render(chips(true)(2));
    flush();
    const buttons = [...document.querySelectorAll('button')].filter((el) => el.textContent === '×');
    expect(buttons.map((el) => renderPathOf(el))).toEqual(['native', 'native']);
    view.unmount();
  });

  it('a ChipRemove stays within its native budget', () => {
    const perChip = (remove: boolean) => nodes(chips(remove)(5)) - nodes(chips(remove)(4));
    const cost = perChip(true) - perChip(false);
    expect(cost, `Combobox.ChipRemove ${cost} nodes`).toBe(CHIP_REMOVE_BUDGET);
  });

  it('a Chip stays within its native budget', () => {
    const cost = nodes(chips(false)(5)) - nodes(chips(false)(4));
    expect(cost, `Combobox.Chip ${cost} nodes`).toBe(CHIP_BUDGET);
  });
});
