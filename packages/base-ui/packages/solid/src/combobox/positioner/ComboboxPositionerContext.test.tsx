import { expect, vi, describe, it } from 'vitest';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { useComboboxPositionerContext } from './ComboboxPositionerContext';

describe('ComboboxPositionerContext', () => {
  const { render } = createRenderer();

  it('throws a descriptive error when a required consumer is outside the positioner', async () => {
    function Consumer() {
      useComboboxPositionerContext();
      return null;
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Solid: the uncaught render error also reaches `reportError` where the platform has one.
    const reportErrorSpy =
      typeof globalThis.reportError === 'function'
        ? vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
        : undefined;

    try {
      expect(() => render(Consumer)).toThrow(
        'Base UI: <Combobox.Popup> and <Combobox.Arrow> must be used within the <Combobox.Positioner> component',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
