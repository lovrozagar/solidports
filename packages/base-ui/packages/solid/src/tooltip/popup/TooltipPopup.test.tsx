import { expect, vi } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen } from '@solidjs/testing-library';

describe('<Tooltip.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Popup, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>{node(props!)}</Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
    },
  }));

  it('should render the children', async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    expect(screen.getByText('Content')).not.to.equal(null);
  });

  it('throws a descriptive error when rendered outside <Tooltip.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tooltip.Root open>
            <Tooltip.Portal>
              <Tooltip.Popup />
            </Tooltip.Portal>
          </Tooltip.Root>
        )),
      ).to.throw(
        'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
