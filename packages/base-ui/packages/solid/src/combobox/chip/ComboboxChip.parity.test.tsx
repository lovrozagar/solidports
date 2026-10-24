/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for Combobox.Chip on the native path (D32's sweep): one multiple combobox renders its
 * chips natively, then, alone, forced onto the slow path (`part`), and the two must produce the
 * same normalized document, the same focused element and the same value changes after each step.
 * Each step drains the microtasks its handlers queue, as a user's next event would.
 */
import { createSignal, flush, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../../test/parityHarness';
import { renderPathOf } from '../../utils/renderPath';

type Step = () => void;

interface Controls {
  setDisabled: (disabled: boolean) => void;
  setReadOnly: (readOnly: boolean) => void;
  setDirection: (direction: 'ltr' | 'rtl') => void;
}

const chip = (value: string) => document.querySelector<HTMLElement>(`[data-chip="${value}"]`)!;
const key = (value: string, k: string) => () => fireEvent.keyDown(chip(value), { key: k });

describe('native parity: combobox chips', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (controls: Controls) => Step[]) {
    const [value, setValue] = createSignal<string[]>(['a', 'b', 'c', 'd', 'e']);
    const [disabled, setDisabled] = createSignal(false);
    const [readOnly, setReadOnly] = createSignal(false);
    const [direction, setDirection] = createSignal<'ltr' | 'rtl'>('ltr');
    const events: string[] = [];
    const chipOf = (v: string): JSX.Element =>
      part(Combobox.Chip, slow, 'div', {
        'data-chip': v,
        // The consumer's handler runs first and can keep the chip's from running.
        onKeyDown: (event: KeyboardEvent & { preventBaseUIHandler?: () => void }) => {
          events.push(`keydown:${v}:${event.key}`);
          if (v === 'e' && event.key === 'Backspace') {
            event.preventBaseUIHandler?.();
          }
        },
        get children() {
          return [v, <Combobox.ChipRemove>×</Combobox.ChipRemove>];
        },
      });
    const view = render(() => (
      <DirectionProvider direction={direction()}>
        <Combobox.Root
          multiple
          value={value()}
          onValueChange={(next: string[], details: { reason: string }) => {
            events.push(`value:${next.join('')}:${details.reason}`);
            setValue(next);
          }}
          onOpenChange={(open: boolean, details: { reason: string }) =>
            events.push(`open:${open}:${details.reason}`)
          }
          disabled={disabled()}
          readOnly={readOnly()}
        >
          <Combobox.Chips>
            <For each={value()}>{(v) => chipOf(v)}</For>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                  {['a', 'b', 'c', 'd', 'e'].map((v) => (
                    <Combobox.Item value={v}>{v}</Combobox.Item>
                  ))}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </DirectionProvider>
    ));
    flush();
    const record = () => {
      const paths = [...document.body.querySelectorAll('[data-chip]')].map((el) =>
        renderPathOf(el),
      );
      expect(paths).not.toContain(slow ? 'native' : 'slow');
      const focused = document.activeElement;
      return {
        tree: normalizeTree(document.body).replace(/mui-cl-\d+/g, 'mui-cl-#'),
        focused:
          focused?.getAttribute('data-chip') ??
          focused?.getAttribute('data-testid') ??
          focused?.tagName ??
          null,
        events: events.join(','),
      };
    };
    const trees = [record()];
    for (const step of steps({ setDisabled, setReadOnly, setDirection })) {
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

  it('Combobox.Chip renders the same DOM, focus and value changes through a session', async () => {
    const steps = ({ setDisabled, setReadOnly, setDirection }: Controls): Step[] => [
      () => chip('a').focus(),
      key('a', 'ArrowRight'),
      key('b', 'ArrowRight'),
      () => chip('e').focus(),
      key('e', 'ArrowRight'),
      () => chip('b').focus(),
      key('b', 'ArrowLeft'),
      key('a', 'ArrowLeft'),
      key('a', 'x'),
      key('a', 'Shift'),
      key('c', 'Enter'),
      key('c', ' '),
      key('d', 'ArrowDown'),
      key('d', 'Escape'),
      () => chip('e').focus(),
      // The consumer prevents the chip's handler: no removal.
      key('e', 'Backspace'),
      key('b', 'Backspace'),
      key('a', 'Delete'),
      () => setDirection('rtl'),
      () => chip('c').focus(),
      key('c', 'ArrowLeft'),
      key('d', 'ArrowRight'),
      () => setDirection('ltr'),
      () => setReadOnly(true),
      key('c', 'Backspace'),
      key('c', 'ArrowRight'),
      () => setReadOnly(false),
      () => setDisabled(true),
      key('c', 'Delete'),
      () => setDisabled(false),
      key('e', 'Delete'),
      key('c', 'ArrowUp'),
    ];
    const native = await snapshots(false, steps);
    const slow = await snapshots(true, steps);
    expect(native).toEqual(slow);
  });
});
