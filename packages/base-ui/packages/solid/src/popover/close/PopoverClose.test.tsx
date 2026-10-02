import { act, createRenderer, describeConformance } from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { REASONS } from '../../utils/reasons';

function isElementOrAncestorInert(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.getAttribute('aria-hidden') === 'true' ||
      current.hasAttribute('inert') ||
      current.hasAttribute('data-base-ui-inert')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

describe('<Popover.Close />', () => {
  const { render } = createRenderer();

  describeConformance(Popover.Close, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) =>
      render(() => (
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node(props!)}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )),

    testComponentPropWith: 'button',
  }));

  it('renders when popover is closed', async () => {
    render(() => (
      <Popover.Root>
        <Popover.Close aria-label="Close popover" />
      </Popover.Root>
    ));

    expect(screen.queryByRole('button', { name: 'Close popover' })).not.to.equal(null);
  });

  it('should close popover when clicked', async () => {
    render(() => (
      <Popover.Root defaultOpen>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    expect(screen.queryByText('Content')).not.to.equal(null);

    fireEvent.click(screen.getByTestId('close'));

    expect(screen.queryByText('Content')).to.equal(null);
  });

  it('keeps the trigger when closing with a tooltip trigger close button', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Popover.Root defaultOpen onOpenChange={handleOpenChange}>
        <Popover.Trigger id="trigger-1">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close
                data-testid="close"
                render={(popoverCloseProps) => (
                  <Tooltip.Root>
                    <Tooltip.Trigger {...popoverCloseProps}>Close</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner>
                        <Tooltip.Popup>Tooltip</Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                )}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    expect(screen.queryByText('Content')).not.to.equal(null);

    fireEvent.click(screen.getByTestId('close'));

    expect(screen.queryByText('Content')).to.equal(null);
    expect(handleOpenChange.mock.calls[0][0]).to.equal(false);
    expect(handleOpenChange.mock.calls[0][1].reason).to.equal(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger?.id).to.equal('trigger-1');
  });

  // `triggerId` can point at a trigger that isn't mounted (for example while a controlled id is
  // being handed over), but the popup is still anchored to the element it opened against, so the
  // close event has to report that element rather than nothing.
  it('falls back to the active trigger element when the active trigger id is unregistered', async () => {
    const handleOpenChange = vi.fn();
    let repoint: () => void = () => {};

    function App() {
      const [triggerId, setTriggerId] = createSignal<string | null>('trigger-1');
      repoint = () => setTriggerId('unregistered');

      return (
        <Popover.Root open triggerId={triggerId()} onOpenChange={handleOpenChange}>
          <Popover.Trigger id="trigger-1">Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                Content
                <Popover.Close data-testid="close" />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    }

    render(() => <App />);

    await act(async () => {
      repoint();
    });

    fireEvent.click(screen.getByTestId('close'));

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).to.equal(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger).to.equal(
      screen.getByRole('button', {
        name: 'Trigger',
      }),
    );
  });

  it('reports no trigger when the active trigger id has no mounted trigger', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Popover.Root defaultOpen defaultTriggerId="never-mounted" onOpenChange={handleOpenChange}>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    fireEvent.click(screen.getByTestId('close'));

    expect(screen.queryByText('Content')).to.equal(null);
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).to.equal(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger).to.equal(undefined);
  });

  it('enables modal focus management when `modal=true` and close is rendered', async () => {
    render(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Popover.Root defaultOpen modal>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close aria-label="Close popover" />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    ));

    await waitFor(() => {
      expect(isElementOrAncestorInert(screen.getByTestId('outside'))).to.equal(true);
    });
  });

  it('enables modal focus management when `modal="trap-focus"` and close is rendered', async () => {
    render(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Popover.Root defaultOpen modal="trap-focus">
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close aria-label="Close popover" />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    ));

    await waitFor(() => {
      expect(isElementOrAncestorInert(screen.getByTestId('outside'))).to.equal(true);
    });
  });
});
