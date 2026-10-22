/*
 * Parity for the NumberField parts D32's sweep put on the native path (Root, ScrubArea, Group,
 * Input, Increment and Decrement): one number field renders through the native paths, then, alone,
 * with those parts forced onto the slow path (`part`), and the two must produce the same normalized
 * document after each step that changes the field: stepping up to the max, stepping down, typing,
 * blurring, and turning read-only and disabled on and off.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { NumberField } from '@solidports/base-ui/number-field';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Step = (container: HTMLElement) => void;

describe('native parity: number field parts', () => {
  const { render } = createRenderer();

  function snapshots(slow: boolean, steps: (flags: Flags) => Step[]) {
    const [readOnly, setReadOnly] = createSignal(false);
    const [disabled, setDisabled] = createSignal(false);
    const view = render(() =>
      part(NumberField.Root, slow, 'div', {
        defaultValue: 4,
        max: 5,
        min: 3,
        get readOnly() {
          return readOnly();
        },
        get disabled() {
          return disabled();
        },
        get children() {
          return [
            part(NumberField.ScrubArea, slow, 'span', { children: 'Amount' }),
            part(NumberField.Group, slow, 'div', {
              get children() {
                return [
                  part(NumberField.Decrement, slow, 'button', {
                    'data-testid': 'decrement',
                  } as NumberField.Decrement.Props),
                  part(NumberField.Input, slow, 'input', {
                    'data-testid': 'input',
                  } as NumberField.Input.Props),
                  part(NumberField.Increment, slow, 'button', {
                    'data-testid': 'increment',
                  } as NumberField.Increment.Props),
                ];
              },
            }),
          ];
        },
      }),
    );
    flush();
    const container = view.container;
    const paths = [...container.querySelectorAll('*')]
      .map((el) => renderPathOf(el))
      .filter(Boolean);
    // Each tree took the path it stands for.
    if (slow) {
      expect(paths).not.toContain('native');
    } else {
      expect(paths).not.toContain('slow');
    }
    const trees = [normalizeTree(container)];
    for (const step of steps({ setReadOnly, setDisabled })) {
      step(container);
      flush();
      trees.push(normalizeTree(container));
    }
    view.unmount();
    return trees;
  }

  interface Flags {
    setReadOnly: (value: boolean) => void;
    setDisabled: (value: boolean) => void;
  }

  it('NumberField parts render the same DOM through stepping, typing, read-only and disabled', () => {
    const byTestId = (container: HTMLElement, id: string) =>
      container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const steps = (flags: Flags): Step[] => [
      (container) => fireEvent.click(byTestId(container, 'increment')),
      (container) => fireEvent.click(byTestId(container, 'increment')),
      (container) => fireEvent.click(byTestId(container, 'decrement')),
      (container) => fireEvent.focus(byTestId(container, 'input')),
      (container) => fireEvent.input(byTestId(container, 'input'), { target: { value: '3' } }),
      (container) => fireEvent.blur(byTestId(container, 'input')),
      () => flags.setReadOnly(true),
      () => flags.setReadOnly(false),
      () => flags.setDisabled(true),
      () => flags.setDisabled(false),
    ];
    expect(snapshots(false, steps)).toEqual(snapshots(true, steps));
  });
});
