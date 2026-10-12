import { expect, vi } from 'vitest';
import {
  act,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  popupFocusPropsTests,
  wait,
} from '#test-utils';
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

  it('uses an aria-label instead of the trigger label', async () => {
    render(() => (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup aria-label="Commands" />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const popup = screen.getByRole('menu', { name: 'Commands' });
    expect(popup).not.toHaveAttribute('aria-labelledby');
  });

  it('uses aria-labelledby from a render element', async () => {
    render(() => (
      <Menu.Root open>
        <span id="commands-label">Commands</span>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup
              render={(props) => <section {...props} aria-labelledby="commands-label" />}
            />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    expect(screen.getByRole('menu', { name: 'Commands' })).toHaveAttribute(
      'aria-labelledby',
      'commands-label',
    );
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

  it('enters the items at the list boundary when an arrow key leaves custom popup content', async () => {
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <button type="button">Custom</button>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const one = await screen.findByRole('menuitem', { name: 'One' });
    await act(async () => one.focus());
    await user.keyboard('[ArrowDown]');
    // Mid-list, so continuing from the highlight would reach Three instead.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());

    await act(async () => screen.getByRole('button', { name: 'Custom' }).focus());
    await user.keyboard('[ArrowDown]');

    await waitFor(() => expect(one).toHaveFocus());
  });

  it('moves focus into the items when the boundary item is already highlighted', async () => {
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <a href="#profile">Profile</a>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await act(async () => screen.getByRole('button', { name: 'Open' }).focus());
    await user.keyboard('[Enter]');

    const one = await screen.findByRole('menuitem', { name: 'One' });
    await waitFor(() => expect(one).toHaveAttribute('data-highlighted'));
    await act(async () => screen.getByRole('link', { name: 'Profile' }).focus());
    expect(one).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(one).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
  });

  it('moves focus into the items when the last item is already highlighted', async () => {
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <a href="#profile">Profile</a>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await act(async () => screen.getByRole('button', { name: 'Open' }).focus());
    await user.keyboard('[ArrowUp]');

    const three = await screen.findByRole('menuitem', { name: 'Three' });
    await waitFor(() => expect(three).toHaveAttribute('data-highlighted'));
    await act(async () => screen.getByRole('link', { name: 'Profile' }).focus());
    expect(three).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowUp]');
    await waitFor(() => expect(three).toHaveFocus());

    await user.keyboard('[ArrowUp]');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
  });

  popupFocusPropsTests({
    render,
    initialFocus: false,
    createComponent: (props) => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup finalFocus={props.finalFocus}>
              {props.children}
              <Menu.Item>Close</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  });

  describe('prop: finalFocus', () => {
    it('receives the interaction type of the item press that closed the menu', async () => {
      const finalFocus = vi.fn(() => true);

      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup finalFocus={finalFocus}>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByText('Open');

      await user.click(trigger);
      const item = await screen.findByText('Close');
      fireEvent.pointerDown(item, { pointerType: 'mouse' });
      fireEvent.click(item, { detail: 1 });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocus).toHaveBeenLastCalledWith('mouse');

      await user.keyboard('{Enter}');
      await screen.findByText('Close');
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
    });

    it('receives the mouse interaction type after a drag-release item selection', async () => {
      const finalFocus = vi.fn(() => true);

      render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup finalFocus={finalFocus}>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByText('Open');
      fireEvent.mouseDown(trigger);
      const item = await screen.findByText('Close');

      // Drag-release selection is only armed 200ms after the trigger press.
      await act(() => wait(200));
      fireEvent.mouseUp(item);

      await waitFor(() => {
        expect(screen.queryByText('Close')).toBe(null);
      });
      expect(finalFocus).toHaveBeenLastCalledWith('mouse');
    });
  });
});
