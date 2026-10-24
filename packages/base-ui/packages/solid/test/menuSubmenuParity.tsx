/*
 * The submenu-trigger parity session (`MenuSubmenuTrigger.parity.test.tsx`, and its VoiceOver
 * twin, which mocks the platform module): one open menu with a hover submenu and a click submenu,
 * rendered with its submenu triggers native or forced onto the slow path (`part`). After each step
 * it records the trigger's full attribute set, the whole normalized document and the focused
 * element: closed, a touch hover that opens nothing, hover-open, closed by moving away, click-open,
 * closed by a second click, keyboard-open with ArrowRight and Enter, closed with ArrowLeft, by
 * focus returning through the submenu's focus guard, and with Escape.
 */
import { flush } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';
import type { JSX } from '@solidjs/web';
import { Menu } from '@solidports/base-ui/menu';
import { act } from '#test-utils';
import { normalizeTree, part } from './parityHarness';
import { renderPathOf } from '../src/utils/renderPath';

type Render = (ui: () => JSX.Element) => {
  user: {
    hover(el: Element): Promise<void>;
    click(el: Element): Promise<void>;
    keyboard(keys: string): Promise<void>;
  };
  unmount(): void;
  container: HTMLElement;
};

const byLabel = (label: string) => document.querySelector<HTMLElement>(`[data-label="${label}"]`)!;

/**
 * The element's attributes, sorted, ids normalized. An empty `style` (what a removed transition
 * override leaves, when an animation frame applied one) styles nothing and is dropped.
 */
function attributes(el: Element) {
  return [...el.attributes]
    .filter((a) => !(a.name === 'style' && a.value === ''))
    .map(
      (a) =>
        `${a.name}=${a.value.replace(/base-ui-[0-9A-Za-z:-]+/g, 'id').replace(/mui-cl-\d+/g, 'mui-cl-#')}`,
    )
    .sort()
    .join(' ');
}

export async function submenuSession(render: Render, slow: boolean) {
  const trigger = (label: string, extra: Record<string, unknown> = {}) =>
    part(Menu.SubmenuTrigger, slow, 'div', { 'data-label': label, children: label, ...extra });
  const submenu = (label: string, extra: Record<string, unknown>) => (
    <Menu.SubmenuRoot>
      {trigger(label, extra)}
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid={`${label}-popup`}>
            <Menu.Item data-label={`${label}-item`}>{`${label} item`}</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
  const view = render(() => (
    <Menu.Root open>
      <Menu.Trigger>Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item data-label="other">Other</Menu.Item>
            {submenu('hover', { delay: 0 })}
            {submenu('click', { openOnHover: false })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ));
  flush();
  const open = (label: string) => document.querySelector(`[data-testid="${label}-popup"]`) != null;
  const record = () => {
    const triggers = ['hover', 'click'].map((label) => byLabel(label));
    expect(triggers.map((el) => renderPathOf(el))).toEqual([
      slow ? 'slow' : 'native',
      slow ? 'slow' : 'native',
    ]);
    const focused = document.activeElement;
    return {
      hover: attributes(triggers[0]),
      click: attributes(triggers[1]),
      open: ['hover', 'click'].filter(open).join(','),
      focused: focused?.getAttribute('data-label') ?? focused?.tagName ?? null,
      tree: normalizeTree(document.body)
        .replace(/mui-cl-\d+/g, 'mui-cl-#')
        .replace(/ style=""/g, ''),
    };
  };
  // A step's end state: its popup's enter or exit transition done (an animation frame decides when
  // the starting style goes, so a snapshot taken earlier would catch either phase).
  const settle = async () => {
    await waitFor(() =>
      expect(document.querySelector('[data-starting-style], [data-ending-style]')).toBe(null),
    );
    flush();
  };
  const trees = [record()];
  const step = async (run: () => Promise<void>, until: () => boolean) => {
    await run();
    await waitFor(() => expect(until()).toBe(true));
    await settle();
    trees.push(record());
  };
  // A touch pointer's hover opens nothing (the hover props record the pointer type).
  await step(
    async () => {
      fireEvent.pointerEnter(byLabel('hover'), { pointerType: 'touch' });
      fireEvent.mouseEnter(byLabel('hover'));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });
    },
    () => true,
  );
  fireEvent.pointerLeave(byLabel('hover'), { pointerType: 'touch' });
  fireEvent.mouseLeave(byLabel('hover'));
  // Hover-open, then closed by moving to another item.
  await step(
    () => view.user.hover(byLabel('hover')),
    () => open('hover'),
  );
  await step(
    () => view.user.hover(byLabel('other')),
    () => !open('hover'),
  );
  // Click-open, closed by a second click.
  await step(
    () => view.user.click(byLabel('click')),
    () => open('click'),
  );
  await step(
    () => view.user.click(byLabel('click')),
    () => !open('click'),
  );
  // Keyboard: ArrowRight opens (list navigation), ArrowLeft closes; Enter opens, Escape closes.
  await step(
    async () => {
      await act(async () => byLabel('click').focus());
      await view.user.keyboard('{ArrowRight}');
    },
    () => open('click'),
  );
  await step(
    () => view.user.keyboard('{ArrowLeft}'),
    () => !open('click'),
  );
  await step(
    async () => {
      await act(async () => byLabel('click').focus());
      await view.user.keyboard('{Enter}');
    },
    () => open('click'),
  );
  // Focus returning through the submenu's inside guard to the trigger closes it.
  await step(
    async () => {
      const guard = document
        .querySelector('[data-testid="click-popup"]')
        ?.parentElement?.querySelector<HTMLElement>(
          '[data-base-ui-focus-guard][data-type="inside"]',
        );
      expect(guard).toBeTruthy();
      await act(async () => guard!.focus());
    },
    () => !open('click'),
  );
  await step(
    async () => {
      await act(async () => byLabel('click').focus());
      await view.user.keyboard('{Enter}');
    },
    () => open('click'),
  );
  await step(
    () => view.user.keyboard('{Escape}'),
    () => !open('click'),
  );
  expect(screen.queryByTestId('click-popup')).toBe(null);
  view.unmount();
  view.container.remove();
  return trees;
}
