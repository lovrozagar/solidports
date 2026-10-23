/*
 * NavigationMenu's Item, Icon and Link against the hand-written floor
 * (`test/floor/navigationMenu.tsx`, D32's sweep): each renders the floor's DOM on the native path,
 * and the dev runtime's reactive nodes one more copy adds stay at its native budget.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import {
  FloorNavigationMenuIcon,
  FloorNavigationMenuItem,
  FloorNavigationMenuLink,
} from '../../test/floor/navigationMenu';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

/** Each part's count at D32's port; the slow path's in the comment. */
const BUDGET = {
  item: 2, // slow 12, floor 3
  icon: 3, // slow 11, floor 3
  link: 2, // slow 20, floor 5
};

const never = () => false;
const noop = () => {};

/** A root whose item `a` is open, its content holding `children`. */
function OpenRoot(props: { children?: JSX.Element }) {
  return (
    <NavigationMenu.Root defaultValue="a">
      <NavigationMenu.List>
        <NavigationMenu.Item value="a">
          <NavigationMenu.Trigger>Trigger</NavigationMenu.Trigger>
          <NavigationMenu.Content>{props.children}</NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

/** A closed root whose list holds `children`. */
function ClosedRoot(props: { children?: JSX.Element }) {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>{props.children}</NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

const copies = (n: number, shape: () => JSX.Element) => Array.from({ length: n }, shape);

describe('navigation menu cost against the hand-written floor', () => {
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

  /** Nodes one more copy adds next to four, in `wrap`. */
  const perCopy = (wrap: (n: number) => () => JSX.Element) => nodes(wrap(5)) - nodes(wrap(4));

  const library = {
    item: (n: number) => () => (
      <ClosedRoot>{copies(n, () => <NavigationMenu.Item />)}</ClosedRoot>
    ),
    icon: (n: number) => () => (
      <ClosedRoot>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>{copies(n, () => <NavigationMenu.Icon />)}</NavigationMenu.Trigger>
        </NavigationMenu.Item>
      </ClosedRoot>
    ),
    link: (n: number) => () => (
      <OpenRoot>{copies(n, () => <NavigationMenu.Link href="#a">Link</NavigationMenu.Link>)}</OpenRoot>
    ),
  };
  const floor = {
    item: (n: number) => () => <ul>{copies(n, () => <FloorNavigationMenuItem />)}</ul>,
    icon: (n: number) => () => <div>{copies(n, () => <FloorNavigationMenuIcon open={never} />)}</div>,
    link: (n: number) => () => (
      <div>
        {copies(n, () => (
          <FloorNavigationMenuLink href="#a" active={never} onNavigate={noop}>
            Link
          </FloorNavigationMenuLink>
        ))}
      </div>
    ),
  };

  /** The normalized HTML of each element `selector` matches after `ui` renders. */
  function parts(ui: () => JSX.Element, selector: string) {
    const view = render(ui);
    flush();
    const html = [...document.querySelectorAll(selector)].map((el) => {
      const wrapper = document.createElement('div');
      wrapper.append(el.cloneNode(true));
      return normalizeTree(wrapper);
    });
    const paths = [...document.querySelectorAll(selector)].map((el) => renderPathOf(el));
    view.unmount();
    return { html, paths };
  }

  it.each([
    ['item', 'li'],
    ['icon', 'span[aria-hidden]'],
    ['link', 'a'],
  ] as const)('the floor renders the same %s DOM', (name, selector) => {
    expect(parts(floor[name](2), selector).html).toEqual(parts(library[name](2), selector).html);
  });

  it.each([
    ['item', 'li'],
    ['icon', 'span[aria-hidden]'],
    ['link', 'a'],
  ] as const)('a plain %s renders on the native path', (name, selector) => {
    expect(parts(library[name](2), selector).paths).toEqual(['native', 'native']);
  });

  it.each(Object.keys(BUDGET) as (keyof typeof BUDGET)[])(
    'a %s stays within its native budget',
    (name) => {
      const cost = perCopy(library[name]);
      const base = perCopy(floor[name]);
      expect(cost, `${name} ${cost} nodes, floor ${base}`).toBeLessThanOrEqual(BUDGET[name]);
    },
  );
});
