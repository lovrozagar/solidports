import { vi, describe, it, expect } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';

describe('<NavigationMenu.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(NavigationMenu.Arrow, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <NavigationMenu.Root value="test">
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>{node(props!)}</NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      )),
  }));

  it('throws a descriptive error when rendered outside <NavigationMenu.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() =>
        render(() => (
          <NavigationMenu.Root>
            <NavigationMenu.Arrow />
          </NavigationMenu.Root>
        )),
      ).toThrow(
        'Base UI: NavigationMenuPositionerContext is missing. NavigationMenuPositioner parts must be placed within <NavigationMenu.Positioner>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
