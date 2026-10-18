/*
 * A popup root's interactions gate reads `mounted()` before `open()` (regate2's select and combobox
 * close): the gate then reads the lazy unmount machinery on the open that builds it, not first on a
 * close. These pin the two things the order must keep: a root that never opens builds no machinery,
 * and after a close and unmount the gate is back on `open`, so a trigger opens the popup again.
 */
import { flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@solidjs/testing-library';
import { Combobox } from '@solidports/base-ui/combobox';
import { Dialog } from '@solidports/base-ui/dialog';
import { Menu } from '@solidports/base-ui/menu';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { Popover } from '@solidports/base-ui/popover';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { Select } from '@solidports/base-ui/select';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer, isJSDOM } from '#test-utils';
import type { JSX } from '@solidjs/web';

const machinery = vi.hoisted(() => ({ built: 0 }));

vi.mock('../useTransitionStatus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useTransitionStatus')>();
  return {
    ...actual,
    useTransitionStatus: (...args: Parameters<typeof actual.useTransitionStatus>) => {
      machinery.built += 1;
      return actual.useTransitionStatus(...args);
    },
  };
});

const CLOSED_ROOTS: [string, () => JSX.Element][] = [
  [
    'Select',
    () => (
      <Select.Root>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">A</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
  ],
  [
    'Combobox',
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
    'Menu',
    () => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>A</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  ],
  [
    'Dialog',
    () => (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup>Content</Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
  ],
  [
    'Popover',
    () => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  ],
  [
    'PreviewCard',
    () => (
      <PreviewCard.Root>
        <PreviewCard.Trigger href="#">Link</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
  ],
  [
    'Tooltip',
    () => (
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>Hover</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ),
  ],
  [
    'NavigationMenu',
    () => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
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

describe('popup interaction gate', () => {
  const { render } = createRenderer();

  // vi.mock of a library module does not reach the bundled runtime in browser mode.
  // NavigationMenu builds one at mount, as it did before the gates' order changed: it defers less
  // than the other roots (components/navigation-menu.md), which 5.7 owns.
  const BUILT_AT_MOUNT: Record<string, number> = { NavigationMenu: 1 };

  it.skipIf(!isJSDOM).each(CLOSED_ROOTS)(
    'a closed %s root that never opens builds no more transition machinery than before',
    (name, ui) => {
      machinery.built = 0;
      render(ui);
      flush();
      expect(machinery.built).toBe(BUILT_AT_MOUNT[name] ?? 0);
    },
  );

  it.each([
    [
      'Popover',
      () => (
        <Popover.Root>
          <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ),
    ],
    [
      'Dialog',
      () => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup">Content</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    ],
    [
      'Menu',
      () => (
        <Menu.Root>
          <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup">
                <Menu.Item>A</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
    ],
  ] as const)('a %s trigger opens the popup again after a close and unmount', async (_, ui) => {
    render(ui);
    const open = async () => {
      fireEvent.click(screen.getByTestId('trigger'));
      flush();
      await Promise.resolve();
      flush();
    };
    const closeAndUnmount = async () => {
      fireEvent.keyDown(screen.getByTestId('popup'), { key: 'Escape' });
      flush();
      // Unmounted once the exit settles (no animation in jsdom: the next frame).
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      });
      flush();
    };
    await open();
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    await closeAndUnmount();
    expect(screen.queryByTestId('popup')).toBeNull();
    await open();
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });
});
