import { vi, describe, it, expect } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';

describe('<NavigationMenu.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(NavigationMenu.Icon, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) =>
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.Item>{node(props!)}</NavigationMenu.Item>
        </NavigationMenu.Root>
      )),
  }));

  it('throws a descriptive error when rendered outside <NavigationMenu.Item>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() =>
        render(() => (
          <NavigationMenu.Root>
            <NavigationMenu.Icon />
          </NavigationMenu.Root>
        )),
      ).toThrow('Base UI: NavigationMenuItem parts must be used within a <NavigationMenu.Item>.');
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
