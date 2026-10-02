import { expect, vi, describe, it } from 'vitest';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { useComboboxItemContext } from './ComboboxItemContext';

describe('ComboboxItemContext', () => {
  const { render } = createRenderer();

  it('throws a descriptive error when used outside <Combobox.Item>', async () => {
    function Consumer() {
      useComboboxItemContext();
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
        'Base UI: ComboboxItemContext is missing. ComboboxItem parts must be placed within <Combobox.Item>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
