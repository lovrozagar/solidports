/*
 * An open Select's items against the hand-written floor (`test/floor/select.tsx`, plan 3 leaf 5.6.0):
 * the dev runtime's reactive nodes one more open `Select.Item` (with its `ItemText` and an unselected
 * `ItemIndicator`, as the bench renders them) adds, at most the floor item's plus 25%, and the item
 * on the native path.
 */
import { DEV, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Select } from '@solidports/base-ui/select';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import { useSelectRootContext } from './root/SelectRootContext';
import { FloorSelectItem, FloorSelectItemText, FloorSelectList } from '../../test/floor/select';

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

describe('select cost against the hand-written floor', () => {
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

  const part = (n: number) => () => (
    <Select.Root open>
      <Select.Trigger>
        <Select.Value placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.List>
              {/* eslint-disable-next-line solid/prefer-for -- the list never changes: written as the bench's select/1000 fixture writes it */}
              {values(n).map((value) => (
                <Select.Item value={value}>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                  <Select.ItemText>{value}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );

  const floor = (n: number) => () => {
    const [active, setActive] = createSignal(-1);
    const [value, setValue] = createSignal<unknown>(null);
    return (
      <FloorSelectList active={active} setActive={setActive} value={value} onSelect={setValue}>
        {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written list writes */}
        {values(n).map((item, index) => (
          <FloorSelectItem value={item} index={index} indicator={() => <span>✓</span>}>
            <FloorSelectItemText>{item}</FloorSelectItemText>
          </FloorSelectItem>
        ))}
      </FloorSelectList>
    );
  };

  /** Nodes one more item adds to an open list of four. */
  const perItem = (shape: (n: number) => () => JSX.Element) => nodes(shape(5)) - nodes(shape(4));

  it('the floor renders the same option DOM as an open Select.Item', () => {
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

  it('an open Select.Item renders on the native path', () => {
    const view = render(part(2));
    flush();
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options.map((el) => renderPathOf(el))).toEqual(['native', 'native']);
    view.unmount();
  });

  it('an open Select.Item costs at most the floor item plus 25%', () => {
    const budget = perItem(floor);
    const cost = perItem(part);
    expect(cost, `open Select.Item ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });
  // Multiple selection reads no keyed selector: each item's selection is its own memo, so a toggle
  // re-runs only the items whose selection changed (regate b1: select/multiple-1000 toggle 50 by
  // click took 188 ms against 86 when every item's bindings re-ran on each toggle).
  it('a multiple Select toggle re-runs only the toggled item', () => {
    let activeReads = 0;
    function CountActiveReads() {
      const { store } = useSelectRootContext();
      const select = store.select.bind(store);
      (store as { select: typeof store.select }).select = ((key: string, ...args: unknown[]) => {
        if (key === 'isActive') {
          activeReads += 1;
        }
        return (select as (...a: unknown[]) => unknown)(key, ...args);
      }) as typeof store.select;
      return null;
    }
    const [value, setValue] = createSignal<string[]>([]);
    const view = render(() => (
      <Select.Root multiple open value={value()}>
        <CountActiveReads />
        <Select.Trigger>
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes: written as the bench's select/1000 fixture writes it */}
                {values(20).map((item) => (
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
    activeReads = 0;
    setValue(['v3']);
    flush();
    expect(activeReads, `items re-read their highlight ${activeReads} times`).toBeLessThanOrEqual(
      2,
    );
    view.unmount();
  });
});
