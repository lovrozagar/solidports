import { expect, vi, describe, it } from 'vitest';
import { createRenderer, flushMicrotasks } from '#test-utils';
import {
  useComboboxDerivedItemsContext,
  useComboboxFloatingContext,
  useComboboxRootContext,
} from './ComboboxRootContext';

describe('ComboboxRootContext', () => {
  const { render } = createRenderer();

  const cases = [
    {
      useContext: useComboboxRootContext,
      message:
        'Base UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    },
    {
      useContext: useComboboxFloatingContext,
      message:
        'Base UI: ComboboxFloatingContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    },
    {
      useContext: useComboboxDerivedItemsContext,
      message:
        'Base UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    },
  ];

  cases.forEach(({ useContext, message }) => {
    it(`throws when its provider is missing: ${message}`, async () => {
      function Consumer() {
        useContext();
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
        expect(() => render(Consumer)).toThrow(message);
      } finally {
        await flushMicrotasks();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        reportErrorSpy?.mockRestore();
      }
    });
  });
});
