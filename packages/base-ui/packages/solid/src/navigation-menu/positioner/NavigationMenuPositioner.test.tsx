import { beforeEach, expect, vi, describe, it } from 'vitest';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

const useNavigationMenuAnchorPositioningSpy = vi.hoisted(() => vi.fn());

vi.mock('../utils/useNavigationMenuAnchorPositioning', async () => {
  const actual = await vi.importActual<
    typeof import('../utils/useNavigationMenuAnchorPositioning')
  >('../utils/useNavigationMenuAnchorPositioning');

  return {
    ...actual,
    useNavigationMenuAnchorPositioning: ((
      ...args: Parameters<typeof actual.useNavigationMenuAnchorPositioning>
    ) => {
      useNavigationMenuAnchorPositioningSpy(...args);
      return actual.useNavigationMenuAnchorPositioning(...args);
    }) satisfies typeof actual.useNavigationMenuAnchorPositioning,
  };
});

describe('<NavigationMenu.Positioner />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    useNavigationMenuAnchorPositioningSpy.mockClear();
  });

  describeConformance(NavigationMenu.Positioner, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <NavigationMenu.Root value="test">
          <NavigationMenu.Portal>{node(props!)}</NavigationMenu.Portal>
        </NavigationMenu.Root>
      )),
  }));

  it('uses the layout viewport', async () => {
    await render(() => (
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner />
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));

    expect(useNavigationMenuAnchorPositioningSpy.mock.lastCall?.[0].shift).toEqual({
      rootBoundary: 'layoutViewport',
    });
  });

  it('throws a descriptive error when rendered outside <NavigationMenu.Portal>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() =>
        render(() => (
          <NavigationMenu.Root value="test">
            <NavigationMenu.Positioner />
          </NavigationMenu.Root>
        )),
      ).toThrow('Base UI: <NavigationMenu.Portal> is missing.');
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
