import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { Switch } from '@solidports/base-ui/switch';
import { describe, expect, it, vi } from 'vitest';
import { SwitchRootContext } from '../root/SwitchRootContext';

const testContext: SwitchRootContext = {
  checked: false,
  disabled: false,
  readOnly: false,
  required: false,
  dirty: false,
  touched: false,
  filled: false,
  focused: false,
  valid: null,
};

describe('<Switch.Thumb />', () => {
  const { render } = createRenderer();

  describeConformance(Switch.Thumb, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => {
      return render(() => (
        <SwitchRootContext value={testContext}>{node(props!)}</SwitchRootContext>
      ));
    },
  }));

  it('throws a descriptive error when rendered outside <Switch.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the halted render also reports a `REACTIVITY_HALTED` warning in a microtask, and
    // hands the error to `reportError` (the uncaught-error channel) where the platform has one.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reportErrorSpy =
      typeof globalThis.reportError === 'function'
        ? vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
        : undefined;

    try {
      expect(() => render(() => <Switch.Thumb />)).toThrow(
        'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      reportErrorSpy?.mockRestore();
    }
  });
});
