/*
 * The shared item indicator's cost (D32's sweep): the dev runtime's reactive nodes one more item's
 * indicator adds to an open Select or Combobox, net of the item, and the indicator on the native
 * path. A mounted (`keepMounted`) indicator and an unselected one, as the bench renders them.
 */
import { DEV, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { afterEach, describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { Select } from '@solidports/base-ui/select';
import { createRenderer } from '#test-utils';
import { renderPathOf } from './renderPath';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

const values = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);

type Shape = 'none' | 'mounted' | 'unselected';

/** Each list's indicator, at D32's port; the slow path's in the comment. */
const BUDGET = {
  select: { mounted: 3, unselected: 1 }, // slow: mounted 20, unselected 1
  combobox: { mounted: 3, unselected: 1 }, // slow: mounted 24, unselected 6
};

describe('item indicator cost', () => {
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

  const indicatorOf = (
    Indicator: (props: { keepMounted?: boolean; children?: JSX.Element }) => JSX.Element,
    shape: Shape,
  ) => (shape === 'none' ? null : <Indicator keepMounted={shape === 'mounted'}>✓</Indicator>);

  const lists = {
    select: (shape: Shape) => (n: number) => () => (
      <Select.Root open>
        <Select.Trigger>
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                {values(n).map((value) => (
                  <Select.Item value={value}>
                    {indicatorOf(Select.ItemIndicator, shape)}
                    <Select.ItemText>{value}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
    combobox: (shape: Shape) => (n: number) => () => (
      <Combobox.Root open>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                {values(n).map((value) => (
                  <Combobox.Item value={value}>
                    {indicatorOf(Combobox.ItemIndicator, shape)}
                    {value}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
  };
  const kinds = Object.keys(lists) as (keyof typeof lists)[];

  /** Nodes one more item's indicator adds to an open list of four, net of the item. */
  const perIndicator = (kind: keyof typeof lists, shape: Shape) => {
    const perItem = (s: Shape) => nodes(lists[kind](s)(5)) - nodes(lists[kind](s)(4));
    return perItem(shape) - perItem('none');
  };

  it.each(kinds)('a mounted %s indicator renders on the native path', (kind) => {
    const view = render(lists[kind]('mounted')(2));
    flush();
    const indicators = [...document.querySelectorAll('span[aria-hidden="true"]')].filter(
      (el) => el.textContent === '✓',
    );
    expect(indicators).toHaveLength(2);
    expect(new Set(indicators.map((el) => renderPathOf(el)))).toEqual(new Set(['native']));
    view.unmount();
  });

  it.each(kinds)('a %s indicator stays within its native budget', (kind) => {
    const mounted = perIndicator(kind, 'mounted');
    const unselected = perIndicator(kind, 'unselected');
    expect({ mounted, unselected }, `${kind} indicator nodes`).toEqual(BUDGET[kind]);
  });
});
