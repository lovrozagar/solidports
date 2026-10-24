/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for the shared item indicator D32's sweep put on the native path (Select.ItemIndicator and
 * Combobox.ItemIndicator): one open list renders its indicators natively, then, alone, forced onto
 * the slow path (`part`), and both must produce the same normalized document and the same element
 * identities after each step. A plain indicator unmounts when its item is deselected and is created
 * again on reselect, as upstream's `keepMounted || selected` gate does; a `keepMounted` one keeps
 * its element, so a reselect while its exit transition runs reuses it.
 */
import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { afterEach, describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { Select } from '@solidports/base-ui/select';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from './renderPath';

type Step = () => void;
type Indicator = (props: Record<string, unknown>) => JSX.Element;
type IndicatorPart = (props: Record<string, unknown>) => JSX.Element;
type List = (indicator: Indicator, value: () => string | null) => JSX.Element;

/** The three items: default children, `keepMounted` with an exit transition, custom children. */
const ITEMS = [
  { value: 'a', props: {} },
  { value: 'b', props: { keepMounted: true, class: 'exit', children: '✓' } },
  { value: 'c', props: { children: '●' } },
] as const;

const TRANSITION = '.exit { transition: opacity 200ms; } .exit[data-ending-style] { opacity: 0; }';

let style: HTMLStyleElement | undefined;
afterEach(() => {
  style?.remove();
  style = undefined;
});

describe('native parity: item indicators', () => {
  const { render } = createRenderer();

  async function snapshots(
    Indicator: IndicatorPart,
    slow: boolean,
    list: List,
    steps: (set: (v: string | null) => void) => Step[],
  ) {
    style = document.createElement('style');
    style.textContent = TRANSITION;
    document.head.append(style);
    const [value, setValue] = createSignal<string | null>(null);
    const indicator: Indicator = (props) => part(Indicator, slow, 'span', props);
    const view = render(() => list(indicator, value));
    flush();
    const ids = new WeakMap<Element, number>();
    let next = 0;
    const record = () => {
      const spans = [...document.body.querySelectorAll('[data-item] span[aria-hidden]')];
      expect(spans.map((el) => renderPathOf(el))).not.toContain(slow ? 'native' : 'slow');
      const identity = spans.map((el) => {
        if (!ids.has(el)) {
          ids.set(el, next);
          next += 1;
        }
        return `${el.closest('[data-item]')!.getAttribute('data-item')}:${ids.get(el)}`;
      });
      return {
        tree: normalizeTree(document.body).replace(/mui-cl-\d+/g, 'mui-cl-#'),
        identity: identity.join(','),
      };
    };
    const trees = [record()];
    for (const step of steps(setValue)) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await Promise.resolve();
      flush();
      trees.push(record());
    }
    // Every transition finished: the keepMounted indicator settles on its final state.
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    flush();
    trees.push(record());
    view.unmount();
    view.container.remove();
    return trees;
  }

  const session = (set: (v: string | null) => void): Step[] => [
    () => set('a'),
    () => set('b'),
    () => set('c'),
    // Deselected and reselected in the same tick: b's exit transition is still running.
    () => set('b'),
    () => set(null),
    () => set('b'),
    () => set('a'),
    () => set(null),
  ];

  it('Select.ItemIndicator renders the same DOM and element identities through a session', async () => {
    const list: List = (indicator, value) => (
      <Select.Root open value={value()}>
        <Select.Trigger>
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                {ITEMS.map((item) => (
                  <Select.Item value={item.value} data-item={item.value}>
                    {indicator(item.props)}
                    <Select.ItemText>{item.value}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    );
    const native = await snapshots(Select.ItemIndicator as IndicatorPart, false, list, session);
    const slow = await snapshots(Select.ItemIndicator as IndicatorPart, true, list, session);
    expect(native).toEqual(slow);
  });

  it('Combobox.ItemIndicator renders the same DOM and element identities through a session', async () => {
    const list: List = (indicator, value) => (
      <Combobox.Root open value={value()}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                {ITEMS.map((item) => (
                  <Combobox.Item value={item.value} data-item={item.value}>
                    {indicator(item.props)}
                    {item.value}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    );
    const native = await snapshots(Combobox.ItemIndicator as IndicatorPart, false, list, session);
    const slow = await snapshots(Combobox.ItemIndicator as IndicatorPart, true, list, session);
    expect(native).toEqual(slow);
  });
});
