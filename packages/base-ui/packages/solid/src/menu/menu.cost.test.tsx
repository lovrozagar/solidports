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
import { FloorMenuItem, FloorMenuList } from '../../test/floor/menu';

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
