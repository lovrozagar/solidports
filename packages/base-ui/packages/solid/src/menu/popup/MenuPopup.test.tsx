import { expect, vi } from 'vitest';
import { createRenderer, describeConformance, act, flushMicrotasks } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { ToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';

describe('<Menu.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.Popup, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>{node(props!)}</Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )),
  }));

  it('throws when rendered outside Menu.Positioner', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Menu.Root open>
            <Menu.Popup />
          </Menu.Root>
        )),
      ).to.throw(
        'Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('stops toolbar navigation keys without blocking ordinary key events', async () => {
    const onParentKeyDown = vi.fn();

    render(() => (
      <ToolbarRootContext value={{ disabled: () => false, orientation: () => 'horizontal' }}>
        <div onKeyDown={onParentKeyDown}>
          <Menu.Root>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </ToolbarRootContext>
    ));

    const popup = screen.getByTestId('popup');
    fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' }),
    );
    expect(onParentKeyDown).not.toHaveBeenCalled();

    fireEvent(popup, new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F1' }));
    expect(onParentKeyDown).toHaveBeenCalled();
    expect(onParentKeyDown.mock.calls.every(([event]) => event.key === 'F1')).to.equal(true);
  });

  describe('prop: finalFocus', () => {
    it('should focus the trigger by default when closed', async () => {
      render(() => (
        <div>
          <input />
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Close</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <input />
        </div>
      ));

      const trigger = screen.getByText('Open');
      act(() => trigger.click());
      const closeButton = screen.getByText('Close');
      act(() => closeButton.click());
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('should focus the element provided to the prop when closed', async () => {
      function TestComponent() {
        let inputRef: HTMLInputElement | undefined;
        return (
          <div>
            <input />
            <Menu.Root>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup finalFocus={inputRef}>
                    <Menu.Item>Close</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <input />
            <input data-testid="input-to-focus" ref={inputRef} />
            <input />
          </div>
        );
      }

      const { user } = render(() => <TestComponent />);

      const trigger = screen.getByText('Open');
      await user.click(trigger);

      const closeButton = await screen.findByText('Close');
      await user.click(closeButton);

      const inputToFocus = screen.getByTestId('input-to-focus');

      await waitFor(() => {
        expect(inputToFocus).toHaveFocus();
      });
    });

    it('should focus the element provided to `finalFocus` as a function when closed', async () => {
      function TestComponent() {
        let ref!: HTMLInputElement;
        const getRef = () => ref;
        return (
          <div>
            <Menu.Root>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup finalFocus={getRef}>
                    <Menu.Item>Close</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <input data-testid="input-to-focus" ref={ref} />
          </div>
        );
      }

      const { user } = render(() => <TestComponent />);

      const trigger = screen.getByText('Open');
      await user.click(trigger);

      const closeButton = await screen.findByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByTestId('input-to-focus')).toHaveFocus();
      });
    });

    it('should not move focus when finalFocus is false', async () => {
      function TestComponent() {
        return (
          <div>
            <Menu.Root>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup finalFocus={false}>
                    <Menu.Item>Close</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = render(() => <TestComponent />);
      const trigger = screen.getByText('Open');

      await user.click(trigger);
      await user.click(await screen.findByText('Close'));

      await waitFor(() => {
        expect(trigger).not.toHaveFocus();
      });
    });

    it('should move focus to trigger when finalFocus returns true', async () => {
      function TestComponent() {
        return (
          <div>
            <Menu.Root>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup finalFocus={() => true}>
                    <Menu.Item>Close</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = render(() => <TestComponent />);
      const trigger = screen.getByText('Open');

      await user.click(trigger);
      await user.click(await screen.findByText('Close'));

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('uses default behavior when finalFocus returns null', async () => {
      function TestComponent() {
        return (
          <div>
            <Menu.Root>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup finalFocus={() => null}>
                    <Menu.Item>Close</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = render(() => <TestComponent />);
      const trigger = screen.getByText('Open');
      await user.click(trigger);
      await user.click(await screen.findByText('Close'));
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });
  });
});
