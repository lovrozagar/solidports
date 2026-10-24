/*
 * A hover-opened menu's safe-polygon pointer-events mutation (`blockPointerEvents`) must not
 * outlive the menu: unmounted while the mutation is applied, the scope would keep
 * `pointer-events: none` and the page would take no clicks. Menu applies it synchronously, in the
 * floating hover hook's effect, whose cleanup clears it (NavigationMenu.Trigger defers it to a
 * microtask: `navigation-menu/trigger/NavigationMenuTrigger.pointerEvents.test.tsx`). Popover,
 * PreviewCard and Tooltip use `safePolygon()`'s default `blockPointerEvents: false`, so they never
 * apply it.
 */
import { flush } from 'solid-js';
import { screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer } from '#test-utils';

/** Every element left with `pointer-events: none` (the safe polygon's scope). */
const blocked = () =>
  [...new Set([document.body, ...document.querySelectorAll<HTMLElement>('[style]')])]
    .filter((el) => el.style.pointerEvents === 'none')
    .map((el) => el.tagName.toLowerCase());

afterEach(() => {
  document.body.style.removeProperty('pointer-events');
});

describe('a hover-opened menu unmounted while it blocks pointer events', () => {
  const { render } = createRenderer();

  it('leaves no pointer-events mutation behind after a submenu opened on hover', async () => {
    const view = render(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Item 1</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" delay={0}>
                  Item 2
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Item 2.1</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await userEvent.hover(screen.getByTestId('submenu-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('submenu')).not.toBe(null);
    });
    // The mutation is applied while the submenu is open: the guard below is not vacuous.
    expect(blocked()).not.toEqual([]);
    view.unmount();
    flush();
    await Promise.resolve();
    expect(blocked()).toEqual([]);
  });

  it('leaves no pointer-events mutation behind after a root menu opened on hover', async () => {
    const view = render(() => (
      <Menu.Root>
        <Menu.Trigger data-testid="trigger" openOnHover delay={0}>
          Open
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu">
              <Menu.Item>Item 1</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await userEvent.hover(screen.getByTestId('trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('menu')).not.toBe(null);
    });
    expect(blocked()).not.toEqual([]);
    view.unmount();
    flush();
    await Promise.resolve();
    expect(blocked()).toEqual([]);
  });
});
