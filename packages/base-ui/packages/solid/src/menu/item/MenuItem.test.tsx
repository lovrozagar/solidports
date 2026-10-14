import { expect, vi, describe, it } from 'vitest';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { splitProps } from '../../solid-1-compat';

describe('<Menu.Item />', () => {
  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  clock.withFakeTimers();

  describeConformance(Menu.Item, () => ({
    button: true,
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Menu.Root open>{node(props!)}</Menu.Root>),
  }));

  it('throws when rendered outside Menu.Root', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.Item />)).toThrow(
        'Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('calls the onClick handler when clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick} id="item">
                Item
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const item = screen.getByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
  });

  it('does not close the menu when onClick prevents Base UI handler', async () => {
    const onClick = vi.fn((event) => event.preventBaseUIHandler());
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    const item = screen.getByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('allows onMouseDown to call preventBaseUIHandler', async () => {
    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onMouseDown={(event) => event.preventBaseUIHandler()}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const item = screen.getByRole('menuitem');

    expect(() => fireEvent.mouseDown(item)).not.toThrow();
  });

  it('perf: does not rerender menu items unnecessarily', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    const renderItem1Spy = vi.fn();
    const renderItem2Spy = vi.fn();
    const renderItem3Spy = vi.fn();
    const renderItem4Spy = vi.fn();

    function LoggingRoot(props: any & { renderSpy: () => void }) {
      const [local, other] = splitProps(props, ['renderSpy', 'state']);

      local.renderSpy();
      return <li {...other} ref={props.ref} />;
    }

    const { user } = render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem1Spy,
                }}
                id="item-1"
              >
                1
              </Menu.Item>
              <Menu.Item
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem2Spy,
                }}
                id="item-2"
              >
                2
              </Menu.Item>
              <Menu.Item
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem3Spy,
                }}
                id="item-3"
              >
                3
              </Menu.Item>
              <Menu.Item
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem4Spy,
                }}
                id="item-4"
              >
                4
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const menuItems = screen.getAllByRole('menuitem');
    menuItems[0].focus();

    renderItem1Spy.mockClear();
    renderItem2Spy.mockClear();
    renderItem3Spy.mockClear();
    renderItem4Spy.mockClear();

    expect(renderItem1Spy.mock.calls.length).toBe(0);

    await user.keyboard('{ArrowDown}'); // highlights '2'

    await waitFor(() => {
      expect(menuItems[1]).toHaveAttribute('data-highlighted');
    });
    expect(menuItems[0]).not.toHaveAttribute('data-highlighted');

    // Solid updates the DOM state for plain menu items without re-invoking the custom render
    // component, so no item needs to rerender here.
    expect(renderItem1Spy.mock.calls.length).toBe(0);
    expect(renderItem2Spy.mock.calls.length).toBe(0);
    expect(renderItem3Spy.mock.calls.length).toBe(0);
    expect(renderItem4Spy.mock.calls.length).toBe(0);
  });

  describe('prop: closeOnClick', () => {
    it('closes the menu when the item is clicked by default', async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitem');
      await user.click(item);

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('when `closeOnClick=false` does not close the menu when the item is clicked', async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item closeOnClick={false}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitem');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('disabled state', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item
                  disabled
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                >
                  Item
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item = screen.getByRole('menuitem');
      item.focus();
      expect(item).toHaveFocus();

      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
    });

    it('skips a natively disabled item during keyboard navigation', async () => {
      const { user } = render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item
                  nativeButton
                  render={(props) => <button {...props} type="button" disabled />}
                >
                  2
                </Menu.Item>
                <Menu.Item>3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const [firstItem, , lastItem] = screen.getAllByRole('menuitem');
      await act(async () => {
        firstItem.focus();
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(lastItem).toHaveFocus();
      });

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(firstItem).toHaveFocus();
      });
    });
  });
});
