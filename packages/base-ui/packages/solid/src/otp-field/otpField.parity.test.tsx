 
/*
 * Parity for the OTPField parts D32's sweep put on the native path (Root and Input): one field
 * renders through the native paths, then, alone, with those parts forced onto the slow path
 * (`part`), and the two must produce the same normalized document after each step that changes it:
 * typing into the slots, deleting, pasting a code, and turning disabled on and off.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { OTPField } from '@solidports/base-ui/otp-field';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Step = (container: HTMLElement) => void;

/** A paste with `value` on the clipboard: a browser's `ClipboardEvent` needs a real `DataTransfer`. */
function pasteText(target: HTMLElement, value: string) {
  const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, 'clipboardData', { value: { getData: () => value } });
  fireEvent(target, pasteEvent);
}

describe('native parity: OTP field parts', () => {
  const { render } = createRenderer();

  function snapshots(slow: boolean, steps: (setDisabled: (value: boolean) => void) => Step[]) {
    const [disabled, setDisabled] = createSignal(false);
    const view = render(() =>
      part(OTPField.Root, slow, 'div', {
        length: 4,
        get disabled() {
          return disabled();
        },
        get children() {
          return Array.from({ length: 4 }, () => part(OTPField.Input, slow, 'input', {}));
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

  it('OTPField parts render the same DOM through typing, deleting, pasting and disabling', () => {
    const slot = (container: HTMLElement, index: number) =>
      container.querySelectorAll<HTMLInputElement>('[role="group"] input')[index];
    const steps = (setDisabled: (value: boolean) => void): Step[] => [
      (container) => fireEvent.focus(slot(container, 0)),
      (container) => fireEvent.input(slot(container, 0), { target: { value: '1' } }),
      (container) => fireEvent.input(slot(container, 1), { target: { value: '2' } }),
      (container) => fireEvent.keyDown(slot(container, 1), { key: 'Backspace' }),
      (container) => pasteText(slot(container, 0), '9876'),
      (container) => fireEvent.blur(slot(container, 3)),
      () => setDisabled(true),
      () => setDisabled(false),
    ];
    expect(snapshots(false, steps)).toEqual(snapshots(true, steps));
  });
});
