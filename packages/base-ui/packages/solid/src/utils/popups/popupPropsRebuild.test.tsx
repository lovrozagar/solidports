/*
 * A popup part's props are a static list whose changing parts are read per key (getters and
 * accessor sources): opening or closing updates the affected attributes without rebuilding the
 * element's props chain, which re-reads every prop. Each part gets a user prop with a counting
 * getter; it is re-read only when the part's props chain is rebuilt.
 */
import { describe, expect, it } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';
import { Dialog } from '@solidports/base-ui/dialog';
import { Menu } from '@solidports/base-ui/menu';
import { Popover } from '@solidports/base-ui/popover';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { Tooltip } from '@solidports/base-ui/tooltip';

function probe(name: string, counts: Record<string, number>) {
  counts[name] = 0;
  return {
    get 'data-probe'() {
      counts[name] += 1;
      return name;
    },
  };
}

const settle = async () => {
  flush();
  await flushMicrotasks();
  await new Promise((resolve) => setTimeout(resolve, 30));
  flush();
};

describe('popup parts do not rebuild their props on open and close', () => {
  const { render } = createRenderer();

  it('keeps triggers and popups stable while the popups open and close', async () => {
    const counts: Record<string, number> = {};
    const [open, setOpen] = createSignal(false);
    const items = ['a', 'b'];
    render(() => (
      <>
        <Dialog.Root open={open()}>
          <Dialog.Trigger {...probe('DialogTrigger', counts)}>D</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup {...probe('DialogPopup', counts)}>c</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <Popover.Root open={open()}>
          <Popover.Trigger>P</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup {...probe('PopoverPopup', counts)}>c</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Tooltip.Root open={open()}>
          <Tooltip.Trigger {...probe('TooltipTrigger', counts)}>T</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup {...probe('TooltipPopup', counts)}>c</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <PreviewCard.Root open={open()}>
          <PreviewCard.Trigger href="#" {...probe('PreviewCardTrigger', counts)}>
            L
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup {...probe('PreviewCardPopup', counts)}>c</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
        <Menu.Root open={open()}>
          <Menu.Trigger {...probe('MenuTrigger', counts)}>M</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup {...probe('MenuPopup', counts)}>
                <Menu.Item>a</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Combobox.Root items={items} open={open()}>
          <Combobox.Input />
          <Combobox.Trigger {...probe('ComboboxTrigger', counts)}>v</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup {...probe('ComboboxPopup', counts)}>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </>
    ));
    await settle();
    const mounted = { ...counts };

    setOpen(true);
    await settle();
    const opened = { ...counts };
    // The open state reached the attributes.
    expect(document.querySelector('[data-probe="TooltipTrigger"]')).toHaveAttribute(
      'data-popup-open',
    );
    expect(document.querySelector('[data-probe="DialogTrigger"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(document.querySelector('[data-probe="ComboboxTrigger"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    setOpen(false);
    await settle();
    expect(document.querySelector('[data-probe="TooltipTrigger"]')).not.toHaveAttribute(
      'data-popup-open',
    );
    expect(document.querySelector('[data-probe="DialogTrigger"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    const delta = (name: string, from: Record<string, number>, to: Record<string, number>) =>
      (to[name] ?? 0) - (from[name] ?? 0);

    // Triggers whose props are fully per key: no rebuild at all.
    for (const name of ['TooltipTrigger', 'PreviewCardTrigger']) {
      expect([name, delta(name, mounted, opened), delta(name, opened, counts)]).toEqual([
        name,
        0,
        0,
      ]);
    }
    // Triggers ending in a button prop getter rebuild at most once per change (the getter's
    // memo re-runs when a handler source changes; plan 7 step 3.4 removes it).
    for (const name of ['DialogTrigger', 'ComboboxTrigger']) {
      expect(delta(name, mounted, opened)).toBeLessThanOrEqual(1);
      expect(delta(name, opened, counts)).toBeLessThanOrEqual(1);
    }
    // Popups mount on open (one read) and do not rebuild on close.
    for (const name of [
      'DialogPopup',
      'PopoverPopup',
      'TooltipPopup',
      'PreviewCardPopup',
      'MenuPopup',
      'ComboboxPopup',
    ]) {
      expect([name, delta(name, mounted, opened)]).toEqual([name, 1]);
      expect([name, delta(name, opened, counts)]).toEqual([name, 0]);
    }
  });

  it('keeps a submenu trigger stable while the highlight moves onto and off it', async () => {
    const counts: Record<string, number> = {};
    render(() => (
      <Menu.Root open>
        <Menu.Trigger>M</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>a</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger {...probe('SubmenuTrigger', counts)}>s</Menu.SubmenuTrigger>
              </Menu.SubmenuRoot>
              <Menu.Item>c</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await settle();
    const popup = document.querySelector('[role="menu"]') as HTMLElement;
    popup.focus();
    const trigger = document.querySelector('[data-probe="SubmenuTrigger"]') as HTMLElement;
    const before = counts.SubmenuTrigger;
    let highlightedOnce = false;
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) {
      (document.activeElement ?? popup).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await settle();
      highlightedOnce ||= trigger.hasAttribute('data-highlighted');
    }
    expect(highlightedOnce).toBe(true);
    // The highlight passed over the trigger (its roving tabindex followed), without a rebuild.
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(counts.SubmenuTrigger - before).toBe(0);
  });
});
