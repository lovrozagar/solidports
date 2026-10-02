import { vi } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { Select } from '@solidports/base-ui/select';

describe('<Select.ItemText />', () => {
  const { render } = createRenderer();

  describeConformance(Select.ItemText, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Select.Root open>
          <Select.Positioner>
            <Select.Item value="">{node(props!)}</Select.Item>
          </Select.Positioner>
        </Select.Root>
      ));
    },
  }));

  it('throws a descriptive error when rendered outside <Select.Item>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Solid: the uncaught render error also reaches `reportError` where the platform has one.
    const reportErrorSpy =
      typeof globalThis.reportError === 'function'
        ? vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
        : undefined;

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() =>
        render(() => (
          <Select.Root open>
            <Select.Positioner>
              <Select.ItemText />
            </Select.Positioner>
          </Select.Root>
        )),
      ).toThrow(
        'Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      reportErrorSpy?.mockRestore();
    }
  });
});
