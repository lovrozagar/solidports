 
/*
 * Parity for the Field and Fieldset parts D32's sweep put on the native path (Fieldset.Root and
 * Legend, Field.Root, Label, Control, Description and Error): one form renders through the native
 * paths, then, alone, with those parts forced onto the slow path (`part`), and the two must produce
 * the same normalized document after each step that changes the field: focusing, typing, blurring,
 * clearing a required value, a custom error and disabling the fieldset.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Field } from '@solidports/base-ui/field';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Step = (container: HTMLElement) => void;

function snapshot(container: HTMLElement) {
  return normalizeTree(container);
}

describe('native parity: field parts', () => {
  const { render } = createRenderer();

  function snapshots(slow: boolean, steps: Step[]) {
    const [disabled, setDisabled] = createSignal(false);
    const view = render(() =>
      part(Fieldset.Root, slow, 'fieldset', {
        get disabled() {
          return disabled();
        },
        get children() {
          return [
            part(Fieldset.Legend, slow, 'div', { children: 'Account' }),
            part(Field.Root, slow, 'div', {
              name: 'username',
              validationMode: 'onBlur',
              validate: (value: unknown) => (value === 'admin' ? 'Reserved' : null),
              get children() {
                return [
                  part(Field.Label, slow, 'label', { children: 'Username' }),
                  part(Field.Control, slow, 'input', { required: true, 'data-testid': 'control' }),
                  part(Field.Description, slow, 'p', { children: 'Pick a name' }),
                  part(Field.Error, slow, 'div', {}),
                  part(Field.Error, slow, 'div', { match: 'valueMissing', children: 'Required' }),
                ];
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
    const trees = [snapshot(container)];
    for (const step of [...steps, () => setDisabled(true), () => setDisabled(false)]) {
      step(container);
      flush();
      trees.push(snapshot(container));
    }
    view.unmount();
    return trees;
  }

  it('Field parts render the same DOM through focus, input, blur, errors and disabling', () => {
    const control = (container: HTMLElement) =>
      container.querySelector('[data-testid="control"]') as HTMLInputElement;
    const steps: Step[] = [
      (container) => fireEvent.focus(control(container)),
      (container) => fireEvent.input(control(container), { target: { value: 'ada' } }),
      (container) => fireEvent.blur(control(container)),
      (container) => fireEvent.focus(control(container)),
      (container) => fireEvent.input(control(container), { target: { value: '' } }),
      (container) => fireEvent.blur(control(container)),
      (container) => fireEvent.input(control(container), { target: { value: 'admin' } }),
      (container) => fireEvent.blur(control(container)),
    ];
    expect(snapshots(false, steps)).toEqual(snapshots(true, steps));
  });
});
