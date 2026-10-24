/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for the Menu item kinds D32's sweep put on the native path: one open menu renders through
 * the native paths, then, alone, with those parts forced onto the slow path (`part`), and the two
 * must produce the same normalized document, the same focused element and the same events after
 * each step. Each step drains the microtasks its handlers queue, as a user's next event would.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Step = () => void;

const byLabel = (label: string) => document.querySelector<HTMLElement>(`[data-label="${label}"]`)!;

describe('native parity: menu checkbox items and indicators', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (controls: Controls) => Step[]) {
    const [disabled, setDisabled] = createSignal(false);
    const [controlled, setControlled] = createSignal(false);
    const events: string[] = [];
    const indicator = (props: Record<string, unknown>) =>
      part(Menu.CheckboxItemIndicator, slow, 'span', { children: '✓', ...props });
    const view = render(() => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              {part(Menu.CheckboxItem, slow, 'div', {
                'data-label': 'plain',
                get children() {
                  return ['Plain', indicator({})];
                },
              })}
              {part(Menu.CheckboxItem, slow, 'div', {
                'data-label': 'checked',
                defaultChecked: true,
                closeOnClick: true,
                onCheckedChange: (checked: boolean) => events.push(`checked:${checked}`),
                get children() {
                  return ['Checked', indicator({ keepMounted: true })];
                },
              })}
              {part(Menu.CheckboxItem, slow, 'div', {
                'data-label': 'controlled',
                get checked() {
                  return controlled();
                },
                onCheckedChange: (
                  checked: boolean,
                  details: { cancel: () => void; reason: string },
                ) => {
                  events.push(`controlled:${checked}:${details.reason}`);
                  if (checked) {
                    details.cancel();
                  }
                },
                get children() {
                  return ['Controlled', indicator({})];
                },
              })}
              {part(Menu.CheckboxItem, slow, 'div', {
                'data-label': 'canceling',
                onCheckedChange: (checked: boolean, details: { cancel: () => void }) => {
                  events.push(`canceling:${checked}`);
                  details.cancel();
                },
                get children() {
                  return ['Canceling', indicator({})];
                },
              })}
              {part(Menu.CheckboxItem, slow, 'div', {
                'data-label': 'disabled',
                defaultChecked: true,
                get disabled() {
                  return disabled();
                },
                onClick: () => events.push('disabled:click'),
                get children() {
                  return ['Disabled', indicator({})];
                },
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();
    const controls: Controls = { setDisabled, setControlled };
    const record = () => {
      const paths = [
        ...document.body.querySelectorAll('[role="menuitemcheckbox"], span[aria-hidden]'),
      ].map((el) => renderPathOf(el));
      expect(paths).not.toContain(slow ? 'native' : 'slow');
      const focused = document.activeElement;
      return {
        tree: normalizeTree(document.body).replace(/mui-cl-\d+/g, 'mui-cl-#'),
        focused: focused?.getAttribute('data-label') ?? focused?.tagName ?? null,
        events: events.join(','),
        bodyPointerEvents: document.body.style.pointerEvents,
      };
    };
    const trees = [record()];
    for (const step of steps(controls)) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await Promise.resolve();
      flush();
      trees.push(record());
    }
    view.unmount();
    view.container.remove();
    return trees;
  }

  interface Controls {
    setDisabled: (disabled: boolean) => void;
    setControlled: (checked: boolean) => void;
  }

  it('CheckboxItem and its indicator render the same DOM, focus and events through a session', async () => {
    const steps = ({ setDisabled, setControlled }: Controls): Step[] => [
      () => fireEvent.click(byLabel('plain')),
      () => fireEvent.click(byLabel('plain')),
      () => fireEvent.mouseMove(byLabel('controlled')),
      () => byLabel('controlled').focus(),
      () => fireEvent.keyDown(byLabel('controlled'), { key: ' ' }),
      () => fireEvent.keyDown(byLabel('controlled'), { key: 'Enter' }),
      () => setControlled(true),
      () => fireEvent.click(byLabel('controlled')),
      () => byLabel('plain').focus(),
      () => fireEvent.keyDown(byLabel('plain'), { key: 'Enter' }),
      () => fireEvent.keyUp(byLabel('plain'), { key: ' ' }),
      () => setDisabled(true),
      () => fireEvent.click(byLabel('disabled')),
      () => fireEvent.keyDown(byLabel('disabled'), { key: 'Enter' }),
      () => setDisabled(false),
      () => fireEvent.click(byLabel('disabled')),
      () => fireEvent.click(byLabel('canceling')),
      () => fireEvent.click(byLabel('checked')),
    ];
    const native = await snapshots(false, steps);
    expect(await snapshots(true, steps)).toEqual(native);
  });
});

describe('native parity: menu radio items and indicators', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (controls: RadioControls) => Step[]) {
    const [groupDisabled, setGroupDisabled] = createSignal(false);
    const [itemDisabled, setItemDisabled] = createSignal(false);
    const events: string[] = [];
    const item = (value: string, extra: Record<string, unknown> = {}) =>
      part(Menu.RadioItem, slow, 'div', {
        'data-label': value,
        value,
        ...extra,
        get children() {
          return [
            value,
            part(Menu.RadioItemIndicator, slow, 'span', {
              children: '●',
              keepMounted: value === 'c',
            }),
          ];
        },
      });
    const view = render(() => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.RadioGroup
                defaultValue="a"
                onValueChange={(value: unknown, details: { reason: string }) =>
                  events.push(`value:${String(value)}:${details.reason}`)
                }
                disabled={groupDisabled()}
              >
                {item('a')}
                {item('b', {
                  get disabled() {
                    return itemDisabled();
                  },
                })}
                {item('c', { closeOnClick: true })}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();
    const record = () => {
      const paths = [
        ...document.body.querySelectorAll('[role="menuitemradio"], span[aria-hidden]'),
      ].map((el) => renderPathOf(el));
      expect(paths).not.toContain(slow ? 'native' : 'slow');
      const focused = document.activeElement;
      return {
        tree: normalizeTree(document.body).replace(/mui-cl-\d+/g, 'mui-cl-#'),
        focused: focused?.getAttribute('data-label') ?? focused?.tagName ?? null,
        events: events.join(','),
        bodyPointerEvents: document.body.style.pointerEvents,
      };
    };
    const trees = [record()];
    for (const step of steps({ setGroupDisabled, setItemDisabled })) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await Promise.resolve();
      flush();
      trees.push(record());
    }
    view.unmount();
    view.container.remove();
    return trees;
  }

  interface RadioControls {
    setGroupDisabled: (disabled: boolean) => void;
    setItemDisabled: (disabled: boolean) => void;
  }

  it('RadioItem and its indicator render the same DOM, focus and events through a session', async () => {
    const steps = ({ setGroupDisabled, setItemDisabled }: RadioControls): Step[] => [
      () => fireEvent.click(byLabel('b')),
      () => fireEvent.mouseMove(byLabel('a')),
      () => byLabel('a').focus(),
      () => fireEvent.keyDown(byLabel('a'), { key: ' ' }),
      () => byLabel('b').focus(),
      () => fireEvent.keyDown(byLabel('b'), { key: 'Enter' }),
      () => setItemDisabled(true),
      () => fireEvent.click(byLabel('a')),
      () => fireEvent.click(byLabel('b')),
      () => setItemDisabled(false),
      () => setGroupDisabled(true),
      () => fireEvent.click(byLabel('b')),
      () => fireEvent.keyDown(byLabel('b'), { key: 'Enter' }),
      () => setGroupDisabled(false),
      () => fireEvent.click(byLabel('c')),
    ];
    const native = await snapshots(false, steps);
    expect(await snapshots(true, steps)).toEqual(native);
  });
});
