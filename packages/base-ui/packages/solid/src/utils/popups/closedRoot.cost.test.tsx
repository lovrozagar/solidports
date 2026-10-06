/*
 * Reactive cost of a closed popup root (plan 7 step 5.3): the reactive nodes (owners and
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
import { Popover } from '@solidports/base-ui/popover';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { Select } from '@solidports/base-ui/select';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';

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
    const result = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    result.unmount();
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
      'Tooltip', // before: 110
      99,
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
      'Menu', // before: 189
      158,
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
      'ContextMenu', // before: 153
      120,
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
      'Popover', // before: 113
      113,
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
      'PreviewCard', // before: 99
      95,
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
      'Dialog', // before: 94
      94,
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
      'AlertDialog', // before: 94
      94,
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
      'Drawer', // before: 125
      125,
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
      188,
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
      210,
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
  ];

  it.each(roots)('a closed %s root stays within its node budget', (name, budget, root) => {
    const created = perRoot(root);
    expect(created, `${name} ${created}`).toBeLessThanOrEqual(budget);
  });
});
