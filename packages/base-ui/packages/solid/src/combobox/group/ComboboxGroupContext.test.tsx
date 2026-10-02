import { expect, vi, describe, it } from 'vitest';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { useComboboxGroupContext } from './ComboboxGroupContext';

describe('ComboboxGroupContext', () => {
  const { render } = createRenderer();

  it('throws a descriptive error when used outside <Combobox.Group>', async () => {
    function Consumer() {
      useComboboxGroupContext();
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
        'Base UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
