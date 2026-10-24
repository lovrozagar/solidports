/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for Combobox.ChipRemove on the native path (D32's sweep): one multiple combobox renders
 * its remove buttons natively, then, alone, forced onto the slow path (`part`), and the two must
 * produce the same normalized document, the same focused element, the same value changes and the
 * same canceled events after each step. Each step drains the microtasks its handlers queue.
 */
import { createSignal, flush, For } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../../test/parityHarness';
import { renderPathOf } from '../../utils/renderPath';

type Step = () => void;
type PreventableEvent = Event & { preventBaseUIHandler?: () => void };

interface Controls {
  setDisabled: (disabled: boolean) => void;
  setReadOnly: (readOnly: boolean) => void;
  setRemoveDisabled: (disabled: boolean) => void;
}

const remove = (value: string) => document.querySelector<HTMLElement>(`[data-remove="${value}"]`)!;

describe('native parity: combobox chip remove buttons', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (controls: Controls) => Step[]) {
    const [value, setValue] = createSignal<string[]>(['a', 'b', 'c', 'd', 'e', 'f']);
    const [disabled, setDisabled] = createSignal(false);
    const [readOnly, setReadOnly] = createSignal(false);
    const [removeDisabled, setRemoveDisabled] = createSignal(false);
    const events: string[] = [];
    // Records each event the consumer sees, after the part's handlers ran (a document listener).
    const log = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const v = target?.getAttribute?.('data-remove');
      if (v) {
        events.push(`${event.type}:${v}:${event.defaultPrevented}`);
      }
    };
    const types = ['click', 'mousedown', 'pointerdown', 'keydown', 'keyup'];
    for (const type of types) {
      document.addEventListener(type, log);
    }
    const removeOf = (v: string) =>
      part(Combobox.ChipRemove, slow, 'button', {
        'data-remove': v,
        // `c`'s consumer keeps the part's handlers from running; `d`'s can be disabled alone.
        onClick: (event: PreventableEvent) => {
          events.push(`consumer-click:${v}`);
          if (v === 'c') {
            event.preventBaseUIHandler?.();
          }
        },
        onKeyDown: (event: KeyboardEvent) => events.push(`consumer-keydown:${v}:${event.key}`),
        ...(v === 'd'
          ? {
              get disabled() {
                return removeDisabled();
              },
            }
          : {}),
        children: '×',
      });
    const view = render(() => (
      <Combobox.Root
        multiple
        value={value()}
        onValueChange={(next: string[], details: { reason: string }) => {
          events.push(`value:${next.join('')}:${details.reason}`);
          setValue(next);
        }}
        disabled={disabled()}
        readOnly={readOnly()}
      >
        <Combobox.Chips>
          <For each={value()}>
            {(v) => (
              <Combobox.Chip data-chip={v}>
                {v}
                {removeOf(v)}
              </Combobox.Chip>
            )}
          </For>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                {['a', 'b', 'c', 'd', 'e', 'f'].map((v) => (
                  <Combobox.Item value={v}>{v}</Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    const record = () => {
      const paths = [...document.body.querySelectorAll('[data-remove]')].map((el) =>
        renderPathOf(el),
      );
      expect(paths).not.toContain(slow ? 'native' : 'slow');
      const focused = document.activeElement;
      return {
        tree: normalizeTree(document.body).replace(/mui-cl-\d+/g, 'mui-cl-#'),
        focused:
          focused?.getAttribute('data-remove') ??
          focused?.getAttribute('data-testid') ??
          focused?.tagName ??
          null,
        events: events.join(','),
      };
    };
    const trees = [record()];
    for (const step of steps({ setDisabled, setReadOnly, setRemoveDisabled })) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await Promise.resolve();
      flush();
      trees.push(record());
    }
    for (const type of types) {
      document.removeEventListener(type, log);
    }
    view.unmount();
    view.container.remove();
    return trees;
  }

  it('Combobox.ChipRemove renders the same DOM, focus, value changes and canceled events through a session', async () => {
    const steps = ({ setDisabled, setReadOnly, setRemoveDisabled }: Controls): Step[] => [
      () => fireEvent.mouseDown(remove('a')),
      () => fireEvent.pointerDown(remove('a')),
      () => fireEvent.click(remove('a')),
      () => fireEvent.keyDown(remove('b'), { key: 'Enter' }),
      () => fireEvent.keyDown(remove('e'), { key: ' ' }),
      () => fireEvent.keyDown(remove('f'), { key: 'x' }),
      () => fireEvent.keyUp(remove('f'), { key: ' ' }),
      // The consumer prevents the part's handlers: no removal.
      () => fireEvent.click(remove('c')),
      () => setRemoveDisabled(true),
      () => fireEvent.mouseDown(remove('d')),
      () => fireEvent.click(remove('d')),
      () => fireEvent.keyDown(remove('d'), { key: 'Enter' }),
      () => fireEvent.keyDown(remove('d'), { key: 'Tab' }),
      () => setRemoveDisabled(false),
      () => setReadOnly(true),
      () => fireEvent.click(remove('f')),
      () => fireEvent.keyDown(remove('f'), { key: 'Enter' }),
      () => fireEvent.keyDown(remove('f'), { key: 'Tab' }),
      () => setReadOnly(false),
      () => setDisabled(true),
      () => fireEvent.click(remove('f')),
      () => fireEvent.pointerDown(remove('f')),
      () => setDisabled(false),
      () => fireEvent.click(remove('d')),
    ];
    const native = await snapshots(false, steps);
    const slow = await snapshots(true, steps);
    expect(native).toEqual(slow);
  });
});
