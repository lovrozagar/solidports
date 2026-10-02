import { expect, vi } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

describe('<Tooltip.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Trigger, () => ({
    refInstanceof: window.HTMLButtonElement,
    render(node, props) {
      return render(() => <Tooltip.Root>{node(props!)}</Tooltip.Root>);
    },
  }));

  it('throws a descriptive error when rendered without a root or a handle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tooltip.Trigger>Trigger</Tooltip.Trigger>)).to.throw(
        'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('removes `data-popup-open` as soon as `open` becomes false', async () => {
    function TooltipWithPreventedUnmount() {
      const [open, setOpen] = createSignal(false);

      return (
        <Tooltip.Root
          open={open()}
          onOpenChange={(nextOpen, eventDetails) => {
            if (!nextOpen) {
              eventDetails.preventUnmountOnClose();
            }
            setOpen(nextOpen);
          }}
        >
          <Tooltip.Trigger data-testid="trigger" delay={0} closeDelay={0}>
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    const { user } = render(() => <TooltipWithPreventedUnmount />);
    const trigger = screen.getByTestId('trigger');

    await user.hover(trigger);
    await waitFor(() => {
      expect(trigger).to.have.attribute('data-popup-open');
    });

    await user.unhover(trigger);
    await waitFor(() => {
      expect(trigger).not.to.have.attribute('data-popup-open');
    });

    expect(screen.getByText('Content')).not.to.equal(null);
  });

  it('opens when the rendered trigger element has its own id', async () => {
    const { user } = render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={0}
          closeDelay={0}
          render={(props) => (
            <button {...props} id="custom-button" data-testid="trigger" type="button" />
          )}
        >
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    expect(trigger).to.have.attribute('id', 'custom-button');

    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).not.to.equal(null);
    });
    expect(trigger).to.have.attribute('data-popup-open');
  });

  it.skipIf(isJSDOM)(
    'opens on delayed hover when rendered as a disabled toolbar button',
    async () => {
      const { user } = render(() => (
        <Toolbar.Root>
          <Tooltip.Root>
            <Tooltip.Trigger
              delay={20}
              render={(props) => <Toolbar.Button {...props} disabled data-testid="trigger" />}
            >
              Push
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup">Nothing to push</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Toolbar.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.to.have.attribute('disabled');
      expect(trigger).to.have.attribute('aria-disabled', 'true');

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.to.equal(null);
      });
    },
  );
});
