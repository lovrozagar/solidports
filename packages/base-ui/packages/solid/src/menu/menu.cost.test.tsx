/*
 * An open Menu's items against the hand-written floor (`test/floor/menu.tsx`, D32's sweep): the
 * dev runtime's reactive nodes one more open `Menu.Item` adds, at most the floor item's plus 25%,
 * and the item on the native path.
 */
import { DEV, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import {
  FloorMenuCheckboxItem,
  FloorMenuItem,
  FloorMenuItemIndicator,
  FloorMenuList,
} from '../../test/floor/menu';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

const labels = (n: number) => Array.from({ length: n }, (_, i) => `Item ${i}`);

describe('menu cost against the hand-written floor', () => {
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
    <Menu.Root open>
      <Menu.Trigger>Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            {/* eslint-disable-next-line solid/prefer-for -- the menu never changes: written as the bench's menu/500 fixture writes it */}
            {labels(n).map((label) => (
              <Menu.Item>{label}</Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );

  const floor = (n: number) => () => {
    const [active, setActive] = createSignal(-1);
    return (
      <FloorMenuList active={active} setActive={setActive} onActivate={() => {}}>
        {/* eslint-disable-next-line solid/prefer-for -- the floor's menu never changes: a plain map is the minimum a hand-written menu writes */}
        {labels(n).map((label, index) => (
          <FloorMenuItem index={index}>{label}</FloorMenuItem>
        ))}
      </FloorMenuList>
    );
  };

  /** Nodes one more item adds to an open menu of four. */
  const perItem = (shape: (n: number) => () => JSX.Element) => nodes(shape(5)) - nodes(shape(4));

  it('the floor renders the same item DOM as an open Menu.Item', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      const items = [...document.querySelectorAll('[role="menuitem"]')].map((el) => {
        const wrapper = document.createElement('div');
        wrapper.append(el.cloneNode(true));
        return normalizeTree(wrapper);
      });
      view.unmount();
      return items;
    };
    expect(html(floor(2))).toEqual(html(part(2)));
  });

  it('an open Menu.Item renders on the native path', () => {
    const view = render(part(2));
    flush();
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    expect(items.map((el) => renderPathOf(el))).toEqual(['native', 'native']);
    view.unmount();
  });

  it('an open Menu.Item costs at most the floor item plus 25%', () => {
    const budget = perItem(floor);
    const cost = perItem(part);
    expect(cost, `open Menu.Item ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });
});

/** Each item kind's count at D32's port; the slow path's in the comment. */
const BUDGET = {
  checkbox: 15, // with its indicator; slow 53, floor 13
  radio: 14, // with its indicator; slow 52, floor 13
};

describe('menu item kinds against the hand-written floor', () => {
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

  const menu = (children: () => JSX.Element) => () => (
    <Menu.Root open>
      <Menu.Trigger>Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>{children()}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
  const always = () => true;

  // Checked items, each with its indicator: one more of each per copy.
  const library = {
    checkbox: (n: number) =>
      menu(() =>
        labels(n).map((label) => (
          <Menu.CheckboxItem defaultChecked>
            {label}
            <Menu.CheckboxItemIndicator>✓</Menu.CheckboxItemIndicator>
          </Menu.CheckboxItem>
        )),
      ),
    radio: (n: number) =>
      menu(() => (
        <Menu.RadioGroup defaultValue="on">
          {/* eslint-disable-next-line solid/prefer-for -- the menu never changes */}
          {labels(n).map((label) => (
            <Menu.RadioItem value="on">
              {label}
              <Menu.RadioItemIndicator>●</Menu.RadioItemIndicator>
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      )),
  };
  const floor = {
    checkbox: (n: number) => () => {
      const [active, setActive] = createSignal(-1);
      return (
        <FloorMenuList active={active} setActive={setActive} onActivate={() => {}}>
          {/* eslint-disable-next-line solid/prefer-for -- the floor's menu never changes */}
          {labels(n).map((label, index) => (
            <FloorMenuCheckboxItem index={index} checked={always}>
              {label}
              <FloorMenuItemIndicator checked={always}>✓</FloorMenuItemIndicator>
            </FloorMenuCheckboxItem>
          ))}
        </FloorMenuList>
      );
    },
    radio: (n: number) => () => {
      const [active, setActive] = createSignal(-1);
      return (
        <FloorMenuList active={active} setActive={setActive} onActivate={() => {}}>
          <div role="group">
            {/* eslint-disable-next-line solid/prefer-for -- the floor's menu never changes */}
            {labels(n).map((label, index) => (
              <FloorMenuCheckboxItem role="menuitemradio" index={index} checked={always}>
                {label}
                <FloorMenuItemIndicator checked={always}>●</FloorMenuItemIndicator>
              </FloorMenuCheckboxItem>
            ))}
          </div>
        </FloorMenuList>
      );
    },
  };
  const selector = { checkbox: '[role="menuitemcheckbox"]', radio: '[role="menuitemradio"]' };

  /** The normalized HTML and render paths of each element `selector` matches, and of its indicator. */
  function parts(ui: () => JSX.Element, query: string) {
    const view = render(ui);
    flush();
    const els = [...document.querySelectorAll(query)];
    const html = els.map((el) => {
      const wrapper = document.createElement('div');
      wrapper.append(el.cloneNode(true));
      return normalizeTree(wrapper);
    });
    const paths = els.flatMap((el) => [
      renderPathOf(el),
      renderPathOf(el.querySelector('span[aria-hidden]')!),
    ]);
    view.unmount();
    return { html, paths };
  }

  const perCopy = (shape: (n: number) => () => JSX.Element) => nodes(shape(5)) - nodes(shape(4));
  const kinds = Object.keys(BUDGET) as (keyof typeof BUDGET)[];

  it.each(kinds)('the floor renders the same %s item DOM', (kind) => {
    expect(parts(floor[kind](2), selector[kind]).html).toEqual(
      parts(library[kind](2), selector[kind]).html,
    );
  });

  it.each(kinds)('a %s item and its indicator render on the native path', (kind) => {
    expect(parts(library[kind](2), selector[kind]).paths).toEqual(Array(4).fill('native'));
  });

  it.each(kinds)('a %s item with its indicator stays within its native budget', (kind) => {
    const cost = perCopy(library[kind]);
    const base = perCopy(floor[kind]);
    expect(cost, `${kind} ${cost} nodes, floor ${base}`).toBeLessThanOrEqual(BUDGET[kind]);
  });
});
