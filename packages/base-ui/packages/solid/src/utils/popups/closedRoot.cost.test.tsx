/*
 * Reactive cost of a closed popup root: the reactive nodes (owners and
 * computations) one closed root with its trigger and unopened popup parts adds, counted with
 * Solid's dev `onOwner` hook. A closed root builds its interaction machinery on first intent or
 * open, so these stay at the cost of the store and the trigger element.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { AlertDialog } from '@solidports/base-ui/alert-dialog';
import { Combobox } from '@solidports/base-ui/combobox';
import { ContextMenu } from '@solidports/base-ui/context-menu';
import { Dialog } from '@solidports/base-ui/dialog';
import { Drawer } from '@solidports/base-ui/drawer';
import { Menu } from '@solidports/base-ui/menu';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { Popover } from '@solidports/base-ui/popover';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { Select } from '@solidports/base-ui/select';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { FloorPopoverRoot } from '../../../test/floor/popover';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

describe('closed popup root cost', () => {
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

  /** Nodes one extra copy of `root` adds next to one copy. */
  function perRoot(root: () => JSX.Element) {
    const one = nodes(() => <div>{root()}</div>);
    const two = nodes(() => (
      <div>
        {root()}
        {root()}
      </div>
    ));
    return two - one;
  }

  // Budgets are the counts after deferring the interactions; the comments give the counts before.
  const roots: [name: string, budget: number, root: () => JSX.Element][] = [
    [
      'Tooltip', // before: 110, then 73, 64, 63 (D32's closed-root unit and native trigger)
      49,
      () => (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ),
    ],
    [
      'Menu', // before: 189, then 120, 114 (D32's closed-root unit)
      113,
      () => (
        <Menu.Root>
          <Menu.Trigger>Trigger</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
    ],
    [
      'ContextMenu', // before: 153, then 80, 74 (D32's closed-root unit)
      73,
      () => (
        <ContextMenu.Root>
          <ContextMenu.Trigger>Area</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>
                <ContextMenu.Item>Item</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ),
    ],
    [
      'Popover', // before: 113, then 80 with the slow trigger, 66, 55 (D32's native trigger and closed-root unit)
      53,
      () => (
        <Popover.Root>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Popup</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ),
    ],
    [
      'PreviewCard', // before: 99, then 69, 56, 55 (D32's closed-root unit and native trigger)
      44,
      () => (
        <PreviewCard.Root>
          <PreviewCard.Trigger href="#">Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ),
    ],
    [
      'Dialog', // before: 94, then 63, 54, 53 (D32's closed-root unit and native trigger)
      40,
      () => (
        <Dialog.Root>
          <Dialog.Trigger>Trigger</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>Popup</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    ],
    [
      'AlertDialog', // before: 94, then 63, 54, 53 (D32's closed-root unit and native trigger)
      40,
      () => (
        <AlertDialog.Root>
          <AlertDialog.Trigger>Trigger</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>Popup</AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      ),
    ],
    [
      'Drawer', // before: 125, then 88, 73, 72 (D32's closed-root unit and native trigger)
      59,
      () => (
        <Drawer.Root>
          <Drawer.Trigger>Trigger</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Popup>Popup</Drawer.Popup>
          </Drawer.Portal>
        </Drawer.Root>
      ),
    ],
    [
      'Select', // before: 188
      108,
      () => (
        <Select.Root>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ),
    ],
    [
      'Combobox', // before: 210
      144,
      () => (
        <Combobox.Root items={['a']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ),
    ],
    [
      // Not deferred: its trigger's hover and click hooks cost one node each. Its list's
      // CompositeList keeps a JSX provider, two nodes more, for its items' effect order
      // (GOTCHA-019).
      'NavigationMenu',
      187,
      () => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Trigger</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content</NavigationMenu.Content>
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
      ),
    ],
  ];

  it.each(roots)('a closed %s root stays within its node budget', (name, budget, root) => {
    const created = perRoot(root);
    expect(created, `${name} ${created}`).toBeLessThanOrEqual(budget);
  });

  // A closed root alone, with no trigger or popup parts, against the floor's root (one open signal
  // and its context, `test/floor/popover.tsx`): what every popup family pays per root before any
  // intent (D32's closed-root unit). Budgets are the counts after it; the comments give the counts
  // before.
  const bareRoots: [name: string, budget: number, root: () => JSX.Element][] = [
    ['Popover', 25, () => <Popover.Root />], // before: 38, then 27
    ['Tooltip', 30, () => <Tooltip.Root />], // before: 40, then 31
    ['PreviewCard', 27, () => <PreviewCard.Root />], // before: 39, then 28
    ['Dialog', 21, () => <Dialog.Root />], // before: 31, then 22
    ['AlertDialog', 21, () => <AlertDialog.Root />], // before: 31, then 22
    ['Drawer', 40, () => <Drawer.Root />], // before: 56, then 41
  ];

  it.each(bareRoots)(
    'a closed %s root alone stays within its node budget',
    (name, budget, root) => {
      const created = perRoot(root);
      const floor = perRoot(() => <FloorPopoverRoot />);
      expect(created, `${name} ${created}, floor ${floor}`).toBeLessThanOrEqual(budget);
    },
  );
});
