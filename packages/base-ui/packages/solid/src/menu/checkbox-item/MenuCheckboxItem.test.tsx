import { act, createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect, describe, it, vi } from 'vitest';
import { splitProps } from '../../solid-1-compat';

describe('<Menu.CheckboxItem />', () => {
  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  clock.withFakeTimers();

  describeConformance(Menu.CheckboxItem, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Menu.Root open>{node(props!)}</Menu.Root>),
  }));

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

    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.CheckboxItem
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem1Spy,
                }}
                id="item-1"
              >
                1
              </Menu.CheckboxItem>
              <Menu.CheckboxItem
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem2Spy,
                }}
                id="item-2"
              >
                2
              </Menu.CheckboxItem>
              <Menu.CheckboxItem
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem3Spy,
                }}
                id="item-3"
              >
                3
              </Menu.CheckboxItem>
              <Menu.CheckboxItem
                render={{
                  component: LoggingRoot,
                  renderSpy: renderItem4Spy,
                }}
                id="item-4"
              >
                4
              </Menu.CheckboxItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const menuItems = screen.getAllByRole('menuitemcheckbox');
    menuItems[0].focus();

    renderItem1Spy.mockClear();
    renderItem2Spy.mockClear();
    renderItem3Spy.mockClear();
    renderItem4Spy.mockClear();

    expect(renderItem1Spy.mock.calls.length).toBe(0);

    fireEvent.keyDown(menuItems[0], { key: 'ArrowDown' }); // highlights '2'

    await waitFor(() => {
      expect(menuItems[1]).toHaveAttribute('data-highlighted');
    });
    expect(menuItems[0]).not.toHaveAttribute('data-highlighted');
    // Solid updates the DOM state for menu checkbox items without re-invoking the custom render
    // component, so no item needs to rerender here.
    expect(renderItem1Spy.mock.calls.length).toBe(0);
    expect(renderItem2Spy.mock.calls.length).toBe(0);
    expect(renderItem3Spy.mock.calls.length).toBe(0);
    expect(renderItem4Spy.mock.calls.length).toBe(0);
  });

  describe('state management', () => {
    it('toggles the checked state when clicked', async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it(`toggles the checked state when Space is pressed`, async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      trigger.focus();
      await user.keyboard('[ArrowDown]');
      const item = screen.getByRole('menuitemcheckbox');

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      await user.keyboard(`[Space]`);
      expect(item).toHaveAttribute('data-checked', '');

      await user.keyboard(`[Space]`);
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it.skipIf(isJSDOM)(
      'does not toggle when Space is pressed during an active typeahead session',
      async () => {
        const onCheckedChange = vi.fn();
        const { user } = render(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item One</Menu.CheckboxItem>
                  <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item Two</Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const [itemOne, itemTwo] = screen.getAllByRole('menuitemcheckbox');

        await act(async () => {
          itemOne.focus();
        });

        await user.keyboard('Item T');

        await waitFor(() => {
          expect(itemTwo).toHaveFocus();
        });

        await user.keyboard('[Space]');
        await user.keyboard('[Space]');

        expect(onCheckedChange.mock.calls.length > 0).toBe(false);
        expect(itemTwo).toHaveAttribute('aria-checked', 'false');
      },
    );

    it(`toggles the checked state when Enter is pressed`, async ({ skip }) => {
      if (isJSDOM) {
        skip();
      }

      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      trigger.focus();

      await user.keyboard('[ArrowDown]');
      const item = screen.getByRole('menuitemcheckbox');

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      await user.keyboard(`[Enter]`);
      expect(item).toHaveAttribute('data-checked', '');
    });

    it('calls `onCheckedChange` when the item is clicked', async () => {
      const onCheckedChange = vi.fn();
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(1);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(true);

      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(2);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(false);
    });

    it('does not toggle when `onCheckedChange` cancels the event', async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  onCheckedChange={(_, eventDetails) => {
                    eventDetails.cancel();
                  }}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-checked');
    });

    it('keeps the state when closed and reopened', async () => {
      const { user } = render(() => (
        <Menu.Root modal={false}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      trigger.focus();

      await user.keyboard('{Enter}');

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');

      const itemAfterReopen = screen.getByRole('menuitemcheckbox');
      expect(itemAfterReopen).toHaveAttribute('aria-checked', 'true');
      expect(itemAfterReopen).toHaveAttribute('data-checked');
    });

    it.each([
      { checked: true, ariaChecked: 'true', dataState: 'checked' },
      { checked: false, ariaChecked: 'false', dataState: 'unchecked' },
    ])(
      'adds the state and ARIA attributes when checked=$checked',
      async ({ checked, ariaChecked, dataState }) => {
        const { user } = await render(() => (
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked}>Item</Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);

        const item = screen.getByRole('menuitemcheckbox');
        expect(item).toHaveAttribute('aria-checked', ariaChecked);
        expect(item).toHaveAttribute(`data-${dataState}`, '');
      },
    );

    it('toggles with Space after closing during typeahead and reopening', async () => {
      const { user } = await render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Settings</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByRole('menuitemcheckbox')).toHaveFocus();
      });

      await user.keyboard('s[Escape]');
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('[Enter]');
      const item = screen.getByRole('menuitemcheckbox');
      await waitFor(() => {
        expect(item).toHaveFocus();
      });
      expect(item).toHaveAttribute('aria-checked', 'false');

      await user.keyboard('[Space]');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('prop: closeOnClick', () => {
    it('when `closeOnClick=true`, closes the menu when the item is clicked', async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem closeOnClick>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('does not close the menu when the item is clicked by default', async () => {
      const { user } = render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleCheckedChange = vi.fn();
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  disabled
                  onCheckedChange={handleCheckedChange}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item = screen.getByRole('menuitemcheckbox');
      item.focus();
      expect(item).toHaveFocus();

      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);
    });
  });
});
