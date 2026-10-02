import { expect, vi, describe, it } from 'vitest';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { screen } from '@solidjs/testing-library';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Toolbar.Separator />', () => {
  const { render } = createRenderer();

  describeConformance(Toolbar.Separator, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props = {}) => render(() => <Toolbar.Root>{node(props)}</Toolbar.Root>),
  }));

  it.each([
    ['horizontal', 'vertical'],
    ['vertical', 'horizontal'],
  ] as const)(
    'uses a %s separator in a %s toolbar',
    async (separatorOrientation, toolbarOrientation) => {
      await render(() => (
        <Toolbar.Root orientation={toolbarOrientation}>
          <Toolbar.Separator />
        </Toolbar.Root>
      ));

      expect(screen.getByRole('separator')).toHaveAttribute(
        'aria-orientation',
        separatorOrientation,
      );
    },
  );

  it('allows its orientation to be overridden', async () => {
    await render(() => (
      <Toolbar.Root orientation="horizontal">
        <Toolbar.Separator orientation="horizontal" />
      </Toolbar.Root>
    ));

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('throws a descriptive error when rendered outside Toolbar.Root', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering throws synchronously instead of rejecting a render promise.
      expect(() => render(() => <Toolbar.Separator />)).toThrow(
        'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
