import { expect, vi, describe, it } from 'vitest';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, For } from 'solid-js';

describe('<Tooltip.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Trigger, () => ({
    refInstanceof: window.HTMLButtonElement,
    render(node, props) {
      return render(() => <Tooltip.Root>{node(props!)}</Tooltip.Root>);
    },
  }));

  // Solid: D32's class guard. Each trigger builds its hover and focus interactions on its first
  // intent, so two tooltips on one page must each open from their own first contact.
  describe('two tooltips on one page', () => {
    function twoTooltips() {
      return render(() => (
        <div>
          <For each={['first', 'second']}>
            {(name) => (
              <Tooltip.Root>
                <Tooltip.Trigger data-testid={`${name}-trigger`} delay={0}>
                  {name}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid={`${name}-popup`}>{`${name} tip`}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </For>
        </div>
      ));
    }

    it('opens the second on hover when its first intent is the pointer entering', async () => {
      twoTooltips();
      const second = screen.getByTestId('second-trigger');
      fireEvent.pointerEnter(second, { pointerType: 'mouse' });
      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second, { movementX: 1, movementY: 1 });
      await flushMicrotasks();
      await waitFor(() => {
        expect(second).toHaveAttribute('data-popup-open');
      });
      expect(screen.getByTestId('first-trigger')).not.toHaveAttribute('data-popup-open');
    });

    it('opens the second on focus after the first opened on focus and closed', async () => {
      twoTooltips();
      const first = screen.getByTestId('first-trigger');
      const second = screen.getByTestId('second-trigger');
      await act(async () => first.focus());
      await waitFor(() => {
        expect(first).toHaveAttribute('data-popup-open');
      });
      await act(async () => second.focus());
      await waitFor(() => {
        expect(second).toHaveAttribute('data-popup-open');
      });
      await waitFor(() => {
        expect(first).not.toHaveAttribute('data-popup-open');
      });
    });
  });

  it('throws a descriptive error when rendered without a root or a handle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tooltip.Trigger>Trigger</Tooltip.Trigger>)).toThrow(
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
          <Tooltip.Trigger
            data-testid="trigger"
            delay={0}
            closeDelay={0}
            style={{ 'pointer-events': 'none' }}
          >
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

    render(() => <TooltipWithPreventedUnmount />);
    const trigger = screen.getByTestId('trigger');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    await act(async () => flushMicrotasks());
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);

    fireEvent.mouseLeave(trigger);
    await act(async () => flushMicrotasks());
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);
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

    expect(trigger).toHaveAttribute('id', 'custom-button');

    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).not.toBe(null);
    });
    expect(trigger).toHaveAttribute('data-popup-open');
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

      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });
    },
  );

  it('ignores a text-node hover target inside the trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>Trigger</Tooltip.Trigger>
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    const text = trigger.firstChild;
    expect(text).toBeTruthy();
    text?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    trigger.dispatchEvent(new FocusEvent('focus'));
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('treats focus inside a nested tooltip trigger as nested', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner">Inner</Tooltip.Trigger>
          </Tooltip.Root>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));

    screen.getByTestId('inner').dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    expect(screen.getByTestId('outer')).not.toHaveAttribute('data-popup-open');
  });
});
