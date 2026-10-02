import { createRenderer, describeConformance, flushMicrotasks, isJSDOM, act } from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';
import { PATIENT_CLICK_THRESHOLD } from '../../utils/constants';

// Solid: local copies of React's `#test-utils` pointer helpers.
function enterWithMouse(element: HTMLElement, init?: MouseEventInit) {
  fireEvent.pointerEnter(element, { pointerType: 'mouse', ...init });
  fireEvent.mouseEnter(element, init);
  fireEvent.mouseMove(element, init);
}

async function resetBrowserPointer() {
  if (!isJSDOM) {
    const { userEvent } = await import('vitest/browser');
    await userEvent.unhover(document.body);
  }
}

describe('<Popover.Trigger />', () => {
  beforeEach(resetBrowserPointer);

  const { render } = createRenderer();

  describeConformance(Popover.Trigger, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) => render(() => <Popover.Root open>{node(props!)}</Popover.Root>),
    testComponentPropWith: 'button',
  }));

  it('throws a descriptive error when rendered without a root or a handle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Popover.Trigger>Toggle</Popover.Trigger>)).to.throw(
        'Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('prop: disabled', () => {
    it('disables the popover', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger disabled />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).to.have.attribute('disabled');
      expect(trigger).to.have.attribute('data-disabled');

      await user.click(trigger);
      expect(screen.queryByText('Content')).to.equal(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.to.equal(trigger);
    });

    it('custom element', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger disabled render="span" nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).to.not.have.attribute('disabled');
      expect(trigger).to.have.attribute('data-disabled');
      expect(trigger).to.have.attribute('aria-disabled', 'true');

      await user.click(trigger);
      expect(screen.queryByText('Content')).to.equal(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.to.equal(trigger);
    });

    it('does not open on hover when disabled', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger disabled openOnHover delay={0} render="span" nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.hover(trigger);
      await flushMicrotasks();

      expect(screen.queryByText('Content')).to.equal(null);
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('openOnHover opened by touch', () => {
    function MultiTriggerPopover() {
      return (
        <Popover.Root>
          {(rootProps) => (
            <>
              <Popover.Trigger
                payload="One"
                openOnHover
                delay={0}
                closeDelay={0}
                style={{ 'pointer-events': 'none' }}
              >
                One
              </Popover.Trigger>
              <Popover.Trigger
                payload="Two"
                openOnHover
                delay={0}
                closeDelay={0}
                style={{ 'pointer-events': 'none' }}
              >
                Two
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <span data-testid="content">{rootProps.payload as string}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </>
          )}
        </Popover.Root>
      );
    }

    async function pressTrigger(trigger: HTMLElement, pointerType: 'mouse' | 'touch') {
      await act(async () => {
        fireEvent.pointerDown(trigger, { pointerType });
        fireEvent.mouseDown(trigger);
        fireEvent.click(trigger, { detail: 1 });
      });
    }

    function hoverTrigger(trigger: HTMLElement) {
      enterWithMouse(trigger);
    }

    // A touch tap leaves the pointer parked wherever the cursor happens to be, so hover must stay
    // disarmed until the popover is reopened by some other means. Otherwise a stray hover over a
    // sibling trigger silently swaps the content the user just tapped for.
    it('keeps ownership on the tapped trigger when a sibling trigger is hovered', async () => {
      render(() => <MultiTriggerPopover />);

      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });

      await pressTrigger(one, 'touch');

      expect(screen.getByTestId('content')).toHaveTextContent('One');

      hoverTrigger(two);
      await flushMicrotasks();

      expect(screen.getByTestId('content')).toHaveTextContent('One');
      expect(two).toHaveAttribute('aria-expanded', 'false');
    });

    // The same hover must still take over when the popover was opened with a mouse, so the guard
    // above can't be a blanket disable.
    it('hands ownership to a hovered sibling trigger when opened by mouse', async () => {
      render(() => <MultiTriggerPopover />);

      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });

      await pressTrigger(one, 'mouse');

      expect(screen.getByTestId('content')).toHaveTextContent('One');

      hoverTrigger(two);
      await flushMicrotasks();

      expect(screen.getByTestId('content')).toHaveTextContent('Two');
      expect(two).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open by clicking', async () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger />
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      act(() => trigger.click());
      expect(trigger).to.have.attribute('data-popup-open');
      expect(trigger).to.have.attribute('data-pressed');
    });

    it('should have the data-popup-open but not the data-pressed attribute when open by hover', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={0} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      await user.hover(trigger);

      expect(trigger).to.have.attribute('data-popup-open');
      expect(trigger).not.to.have.attribute('data-pressed');
    });

    it('should not have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true` and `delay=0`', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      await user.hover(trigger);

      act(() => trigger.click());
      expect(trigger).to.have.attribute('data-popup-open');
    });

    it('should have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true`', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      await user.hover(trigger);
      act(() => trigger.click());
      expect(trigger).to.have.attribute('data-popup-open');
      expect(trigger).to.have.attribute('data-pressed');
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    const { clock, render: renderFakeTimers } = createRenderer();

    clock.withFakeTimers();

    it('does not close the popover if the user clicks too quickly', async () => {
      renderFakeTimers(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseMove(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD - 1);

      fireEvent.click(trigger);

      expect(trigger).to.have.attribute('data-popup-open');
    });

    it('closes the popover if the user clicks patiently', async () => {
      renderFakeTimers(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);

      expect(trigger).not.to.have.attribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', async () => {
      renderFakeTimers(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD - 1);

      fireEvent.click(trigger);
      fireEvent.mouseLeave(trigger);

      expect(trigger).to.have.attribute('data-popup-open');

      clock.tick(1);

      expect(trigger).to.have.attribute('data-popup-open');
    });

    it('does not stick if the user clicks patiently', async () => {
      renderFakeTimers(() => (
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);
      fireEvent.mouseLeave(trigger);

      expect(trigger).not.to.have.attribute('data-popup-open');
    });

    it('sticks when clicked before the hover delay completes', async () => {
      renderFakeTimers(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(100);

      // User clicks impatiently to open
      fireEvent.click(trigger);

      expect(trigger).to.have.attribute('data-popup-open');

      fireEvent.mouseLeave(trigger);

      expect(trigger).to.have.attribute('data-popup-open');
    });

    it('should keep the popover open when re-hovered and clicked within the patient threshold', async () => {
      render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={100}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(100);
      await flushMicrotasks();

      expect(screen.getByText('Content')).not.to.equal(null);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      fireEvent.click(trigger);
      expect(screen.getByText('Content')).not.to.equal(null);
    });
  });

  it.skipIf(isJSDOM)(
    'should toggle closed with Enter or Space when rendering a <div>',
    async () => {
      // Real browser input (as React), so queued initial focus lands between keystrokes.
      const { userEvent: user } = await import('vitest/browser');

      try {
        render(() => (
          <div>
            <Popover.Root>
              <Popover.Trigger render="div" nativeButton={false} data-testid="div-trigger">
                Toggle
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <button data-testid="other-button">Other button</button>
          </div>
        ));

        const trigger = screen.getByTestId('div-trigger');

        await act(async () => trigger.focus());
        await user.keyboard('[Enter]');
        expect(screen.queryByText('Content')).not.to.equal(null);

        await user.tab({ shift: true });
        expect(document.activeElement).to.equal(trigger);

        await user.keyboard('[Enter]');
        await waitFor(() => {
          expect(screen.queryByText('Content')).to.equal(null);
        });

        await user.keyboard('[Enter]');
        expect(screen.queryByText('Content')).not.to.equal(null);

        await user.tab({ shift: true });
        expect(document.activeElement).to.equal(trigger);

        await user.keyboard('[Space]');
        expect(screen.queryByText('Content')).to.equal(null);

        await user.keyboard('[Space]');
        expect(screen.queryByText('Content')).not.to.equal(null);

        await user.tab({ shift: true });
        expect(document.activeElement).to.equal(trigger);

        await user.keyboard('[Space]');
        expect(screen.queryByText('Content')).to.equal(null);
      } finally {
        cleanup();
      }
    },
  );
});
