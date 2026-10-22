/* eslint-disable testing-library/no-container -- compares the rendered documents directly */
/*
 * Parity for the parts D32's sweep put on the native path: the Popover and Tooltip triggers and the
 * Select, Menu and Combobox items (with Select's item text and indicator). Each tree renders through
 * the native paths, then, alone, with every swept part forced onto the slow path (`part`), and the
 * two must produce the same normalized document, closed and after the steps that change the parts'
 * state. A native part that wrote an attribute of its own (a stray `data-*` from its model, a
 * missing state attribute) differs here.
 *
 * The two trees render one after the other, not side by side as `mountParity` does: popups react to
 * each other across a page (a press on one popover's trigger is an outside press for another, and
 * opening a tooltip closes the open one), so a side-by-side open would compare two different
 * states. The document body is compared, since the popups render through portals.
 */
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { Menu } from '@solidports/base-ui/menu';
import { Popover } from '@solidports/base-ui/popover';
import { Select } from '@solidports/base-ui/select';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../../test/parityHarness';
import { renderPathOf } from '../renderPath';

type Step = (body: HTMLElement) => void;

/** The normalized body, portal ids renumbered as `normalizeTree` renumbers part ids. */
function snapshot(body: HTMLElement) {
  const ids = new Map<string, string>();
  return normalizeTree(body).replace(/mui-[A-Za-z0-9-]+/g, (id) => {
    if (!ids.has(id)) {
      ids.set(id, `mui-#${ids.size}`);
    }
    return ids.get(id)!;
  });
}

const byTestId = (id: string) => (body: HTMLElement) =>
  body.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('native parity: popup parts', () => {
  const { render } = createRenderer();

  /** The normalized document after mount and after each step, for one path. */
  function snapshots(make: (slow: boolean) => JSX.Element, slow: boolean, steps: Step[]) {
    const view = render(() => make(slow));
    flush();
    const body = document.body;
    const paths = [...body.querySelectorAll('*')].map((el) => renderPathOf(el)).filter(Boolean);
    // Each tree took the path it stands for.
    if (slow) {
      expect(paths).not.toContain('native');
    } else {
      expect(paths).toContain('native');
    }
    const trees = [snapshot(body)];
    for (const step of steps) {
      step(body);
      flush();
      trees.push(snapshot(body));
    }
    view.unmount();
    // The next tree renders alone: its container is the body's only content.
    view.container.remove();
    return trees;
  }

  function expectParity(make: (slow: boolean) => JSX.Element, steps: Step[] = []) {
    const native = snapshots(make, false, steps);
    const slow = snapshots(make, true, steps);
    // Index 0 is the tree after mount, index n the tree after step n.
    expect(native).toEqual(slow);
  }

  it('Popover.Trigger renders the same DOM closed, open and closed again', () => {
    const trigger = byTestId('trigger');
    expectParity(
      (slow) => (
        <Popover.Root>
          {part(Popover.Trigger, slow, 'button', { children: 'Open', 'data-testid': 'trigger' })}
        </Popover.Root>
      ),
      [(body) => fireEvent.click(trigger(body)), (body) => fireEvent.click(trigger(body))],
    );
  });

  it('Tooltip.Trigger renders the same DOM closed, disabled and open', () => {
    expectParity((slow) => (
      <Tooltip.Root>{part(Tooltip.Trigger, slow, 'button', { children: 'Tip' })}</Tooltip.Root>
    ));
    expectParity((slow) => (
      <Tooltip.Root>
        {part(Tooltip.Trigger, slow, 'button', { children: 'Tip', disabled: true })}
      </Tooltip.Root>
    ));
    expectParity((slow) => (
      <Tooltip.Root defaultOpen>
        {part(Tooltip.Trigger, slow, 'button', { children: 'Tip' })}
      </Tooltip.Root>
    ));
  });

  it('Select.Item, ItemText and ItemIndicator render the same DOM open and after a selection', () => {
    expectParity(
      (slow) => (
        <Select.Root open defaultValue="b">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List>
                  {/* eslint-disable-next-line solid/prefer-for -- a fixed list, written as the Select parity fixture writes it */}
                  {['a', 'b', 'c'].map((value) =>
                    part(Select.Item, slow, 'div', {
                      value,
                      'data-testid': `item-${value}`,
                      get children() {
                        return [
                          part(Select.ItemText, slow, 'div', { children: value }),
                          part(Select.ItemIndicator, slow, 'span', { children: '✓' }),
                        ];
                      },
                    }),
                  )}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ),
      [(body) => fireEvent.click(byTestId('item-c')(body))],
    );
  });

  it('Menu.Item renders the same DOM open and with a highlight', () => {
    expectParity(
      (slow) => (
        <Menu.Root open>
          <Menu.Trigger>Menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {/* eslint-disable-next-line solid/prefer-for -- a fixed list, written as the Menu parity fixture writes it */}
                {['One', 'Two', 'Three'].map((label) =>
                  part(Menu.Item, slow, 'div', { children: label, 'data-testid': label }),
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
      [(body) => fireEvent.mouseMove(byTestId('Two')(body), { movementX: 1, movementY: 1 })],
    );
  });

  it('Combobox.Item renders the same DOM open and after a selection', () => {
    expectParity(
      (slow) => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} open>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) =>
                    part(Combobox.Item, slow, 'div', {
                      value: item,
                      children: item,
                      'data-testid': item,
                    })
                  }
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ),
      [(body) => fireEvent.click(byTestId('banana')(body))],
    );
  });
});
