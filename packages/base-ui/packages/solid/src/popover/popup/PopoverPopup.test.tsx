import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  waitSingleFrame,
  act,
  popupFocusPropsTests,
} from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { expect, vi, describe, it } from 'vitest';
import type { JSX } from '@solidjs/web';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

describe('<Popover.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(Popover.Popup, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>{node(props!)}</Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )),
  }));

  it('throws a descriptive error when rendered outside <Popover.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Popover.Popup />)).to.throw(
        'Base UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <Popover.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Popover.Root open>
            <Popover.Portal>
              <Popover.Popup />
            </Popover.Portal>
          </Popover.Root>
        )),
      ).to.throw(
        'Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('should render the children', async () => {
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    expect(screen.getByText('Content')).not.to.equal(null);
  });

  popupFocusPropsTests({
    render,
    createComponent: (props) => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup initialFocus={props.initialFocus} finalFocus={props.finalFocus}>
              {props.children}
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  });

  it.skipIf(isJSDOM)('focuses the popup when the active element becomes display:none', async () => {
    function TestComponent() {
      const [hidden, setHidden] = createSignal(false);

      return (
        <Popover.Root open>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">
                <button
                  data-testid="hide-button"
                  style={{ display: hidden() ? 'none' : undefined }}
                  onClick={() => setHidden(true)}
                >
                  Hide
                </button>
                <input />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    }

    const { user } = render(() => <TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('hide-button')).toHaveFocus();
    });

    await user.click(screen.getByTestId('hide-button'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
  });

  describe('openOnHover: delay + click', () => {
    const { render: renderFakeTimers, clock } = createRenderer();
    clock.withFakeTimers();

    it('returns focus to the trigger if opened by click before the hover delay completes', async () => {
      renderFakeTimers(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close>Close</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByText('Open');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(100);

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByText('Close')).not.to.equal(null);

      clock.tick(1000);
      await flushMicrotasks();

      fireEvent.click(screen.getByText('Close'));
      await flushMicrotasks();
      clock.tick(16);
      await flushMicrotasks();

      expect(trigger).toHaveFocus();
    });
  });

  describe('inside a toolbar', () => {
    function ToolbarPopover(props: { children: JSX.Element }) {
      return (
        <Toolbar.Root>
          <Toolbar.Button>First</Toolbar.Button>
          <Popover.Root>
            <Toolbar.Button render={{ component: Popover.Trigger }}>Open</Toolbar.Button>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>{props.children}</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Toolbar.Button>Last</Toolbar.Button>
        </Toolbar.Root>
      );
    }

    // The popup is portaled but still bubbles events up to `Toolbar.Root`, whose composite
    // handler would move the roving highlight and pull focus out of the open popup.
    it('does not relay composite keys from the popup to the toolbar', async () => {
      const { user } = render(() => (
        <ToolbarPopover>
          <button type="button">Inside</button>
        </ToolbarPopover>
      ));

      // The toolbar itself still navigates with the same key, so a passing assertion below can't
      // come from an inert toolbar.
      await user.keyboard('[Tab]');
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('button', { name: 'Open' });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('[Enter]');
      const insideButton = screen.getByRole('button', { name: 'Inside' });
      await waitFor(() => {
        expect(insideButton).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');
      await flushMicrotasks();

      expect(insideButton).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });

    // Shielding the toolbar must not disable the keys inside the popup: only propagation is
    // stopped, so native caret movement in popup content keeps working.
    it('keeps composite keys working inside the popup content', async () => {
      const { user } = render(() => (
        <ToolbarPopover>
          <input value="ab" />
        </ToolbarPopover>
      ));

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await act(async () => {
        input.setSelectionRange(0, 0);
      });
      await user.keyboard('[ArrowRight]');

      expect(input.selectionStart).to.equal(1);
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });
  });
});
