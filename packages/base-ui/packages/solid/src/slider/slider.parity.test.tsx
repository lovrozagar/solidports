 
/*
 * Parity for the Slider parts D32's sweep put on the native path (Root, Label, Value, Control,
 * Track, Indicator and Thumb): one slider renders through the native paths, then, alone, with those
 * parts forced onto the slow path (`part`), and the two must produce the same normalized document
 * after each step that changes it: focusing the thumb, stepping with the keyboard, jumping to the
 * ends, blurring, and turning disabled on and off.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Slider } from '@solidports/base-ui/slider';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Step = (container: HTMLElement) => void;

describe('native parity: slider parts', () => {
  const { render } = createRenderer();

  function snapshots(slow: boolean, steps: (setDisabled: (value: boolean) => void) => Step[]) {
    const [disabled, setDisabled] = createSignal(false);
    const view = render(() =>
      part(Slider.Root, slow, 'div', {
        defaultValue: 20,
        get disabled() {
          return disabled();
        },
        get children() {
          return [
            part(Slider.Label, slow, 'div', { children: 'Volume' }),
            part(Slider.Value, slow, 'output', {}),
            part(Slider.Control, slow, 'div', {
              get children() {
                return part(Slider.Track, slow, 'div', {
                  get children() {
                    return [
                      part(Slider.Indicator, slow, 'div', {}),
                      part(Slider.Thumb, slow, 'div', {}),
                    ];
                  },
                });
              },
            }),
          ];
        },
      }),
    );
    flush();
    const container = view.container;
    const paths = [...container.querySelectorAll('*')].map((el) => renderPathOf(el)).filter(Boolean);
    // Each tree took the path it stands for.
    if (slow) {
      expect(paths).not.toContain('native');
    } else {
      expect(paths).not.toContain('slow');
    }
    const trees = [normalizeTree(container)];
    for (const step of steps(setDisabled)) {
      step(container);
      flush();
      trees.push(normalizeTree(container));
    }
    view.unmount();
    return trees;
  }

  it('Slider parts render the same DOM through focus, keyboard steps and disabling', () => {
    const input = (container: HTMLElement) =>
      container.querySelector('input[type="range"]') as HTMLInputElement;
    const steps = (setDisabled: (value: boolean) => void): Step[] => [
      (container) => fireEvent.focus(input(container)),
      (container) => fireEvent.keyDown(input(container), { key: 'ArrowRight' }),
      (container) => fireEvent.keyDown(input(container), { key: 'PageUp' }),
      (container) => fireEvent.keyDown(input(container), { key: 'End' }),
      (container) => fireEvent.keyDown(input(container), { key: 'Home' }),
      (container) => fireEvent.blur(input(container)),
      () => setDisabled(true),
      () => setDisabled(false),
    ];
    expect(snapshots(false, steps)).toEqual(snapshots(true, steps));
  });
});
