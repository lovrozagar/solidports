import { createSignal } from 'solid-js';
import { expect, vi, describe, beforeEach, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { act, createRenderer, resetBrowserPointer } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';

describe('filtered Menu items', () => {
  beforeEach(resetBrowserPointer);

  const { render } = createRenderer();

  it('keeps focus on the input when items are pressed', async () => {
    const handleItemClick = vi.fn();
    const { user } = render(() => (
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item closeOnClick={false} onClick={handleItemClick}>
                    Rename
                  </Menu.Item>
                  <Menu.LinkItem href="#details">Open details</Menu.LinkItem>
                  <Menu.CheckboxItem>Show details</Menu.CheckboxItem>
                  <Menu.RadioGroup>
                    <Menu.RadioItem value="date">Sort by date</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await user.click(input);

    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(input).toHaveFocus();
    expect(handleItemClick).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('menuitem', { name: 'Open details' }));
    expect(input).toHaveFocus();

    const checkboxItem = screen.getByRole('menuitemcheckbox', { name: 'Show details' });
    await user.click(checkboxItem);
    expect(input).toHaveFocus();
    expect(checkboxItem).toHaveAttribute('aria-checked', 'true');

    const radioItem = screen.getByRole('menuitemradio', { name: 'Sort by date' });
    await user.click(radioItem);
    expect(input).toHaveFocus();
    expect(radioItem).toHaveAttribute('aria-checked', 'true');
  });

  // Solid: the harness's `toBeVisible` is jest-dom's, which checks ancestors. These menus open
  // without a trigger, so their positioner keeps `opacity: 0` in both ports; assert presence.
  describe('item text resolution', () => {
    it('matches text that a descendant rendered after the item registered', async () => {
      let setLabel: (label: string) => void = () => {};
      function AsyncLabel() {
        const [label, setLabelState] = createSignal('Loading');
        setLabel = (next) => setLabelState(next);
        return <>{label()}</>;
      }

      const { user } = render(() => (
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>
                      <AsyncLabel />
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await act(async () => setLabel('Rename'));
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'rename');

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    });

    it('stops matching text that a descendant no longer renders', async () => {
      let setLabel: (label: string) => void = () => {};
      function AsyncLabel() {
        const [label, setLabelState] = createSignal('Rename');
        setLabel = (next) => setLabelState(next);
        return <>{label()}</>;
      }

      const { user } = render(() => (
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item data-testid="async-item">
                      <AsyncLabel />
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await act(async () => setLabel(''));
      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'rename');

      await waitFor(() => {
        expect(screen.queryByTestId('async-item')).toBe(null);
      });
    });

    it('matches an item whose children are an array while it is filtered out', async () => {
      const { user } = render(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>
                      {'Re'}
                      {'name'}
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });

      // Hide it, so its DOM node goes away and only the children remain as a text source.
      await user.type(input, 'del');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });

      fireEvent.input(input, { target: { value: 'rena' } });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      });
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });

    it('keeps the rendered text of a hidden item whose children render different text', async () => {
      const translations: Record<string, string> = { Rename: 'Zmień nazwę', Delete: 'Usuń' };
      function Translate(props: { children: string }) {
        return <>{translations[props.children]}</>;
      }

      function Test(props: { value: string; tick: number }) {
        return (
          <Menu.FilterProvider value={props.value}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-tick={props.tick}>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>
                        <Translate>Rename</Translate>
                      </Menu.Item>
                      <Menu.Item>
                        <Translate>Delete</Translate>
                      </Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      }

      const [testProps, setTestProps] = createSignal<Parameters<typeof Test>[0]>({
        value: '',
        tick: 0,
      });
      const setProps = async (next: Partial<Parameters<typeof Test>[0]>) =>
        act(() => setTestProps((previous) => ({ ...previous, ...next })));
      render(() => <Test {...testProps()} />);

      await setProps({ value: 'usu', tick: 0 });
      expect(screen.queryByRole('menuitem', { name: 'Zmień nazwę' })).toBe(null);

      // Re-render the hidden item with the same children.
      await setProps({ value: 'usu', tick: 1 });

      await setProps({ value: 'zmie', tick: 1 });
      expect(screen.getByRole('menuitem', { name: 'Zmień nazwę' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Usuń' })).toBe(null);
    });

    it('matches the new children of an item that changed while it was filtered out', async () => {
      function Test(props: { value: string; label: string }) {
        return (
          <Menu.FilterProvider value={props.value}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>{props.label}</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      }

      const [testProps, setTestProps] = createSignal<Parameters<typeof Test>[0]>({
        value: '',
        label: 'Rename',
      });
      const setProps = async (next: Partial<Parameters<typeof Test>[0]>) =>
        act(() => setTestProps((previous) => ({ ...previous, ...next })));
      render(() => <Test {...testProps()} />);

      await setProps({ value: 'del', label: 'Rename' });
      await setProps({ value: 'del', label: 'Duplicate' });
      await setProps({ value: 'dup', label: 'Duplicate' });

      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    });

    it('matches the updated text of an item rendered through its render element', async () => {
      function Test(props: { value: string; name: string }) {
        return (
          <Menu.FilterProvider value={props.value}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item render={{ component: 'div', children: props.name }} />
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      }

      const [testProps, setTestProps] = createSignal<Parameters<typeof Test>[0]>({
        value: '',
        name: 'One',
      });
      const setProps = async (next: Partial<Parameters<typeof Test>[0]>) =>
        act(() => setTestProps((previous) => ({ ...previous, ...next })));
      render(() => <Test {...testProps()} />);

      await setProps({ value: '', name: 'Two' });
      await setProps({ value: 'two', name: 'Two' });

      expect(screen.getByRole('menuitem', { name: 'Two' })).toBeInTheDocument();
    });

    it('matches a render element whose text changed while the item was filtered out', async () => {
      function Test(props: { value: string; name: string }) {
        return (
          <Menu.FilterProvider value={props.value}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item render={{ component: 'div', children: props.name }} />
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      }

      const [testProps, setTestProps] = createSignal<Parameters<typeof Test>[0]>({
        value: 'two',
        name: 'One',
      });
      const setProps = async (next: Partial<Parameters<typeof Test>[0]>) =>
        act(() => setTestProps((previous) => ({ ...previous, ...next })));
      render(() => <Test {...testProps()} />);
      expect(screen.queryByRole('menuitem', { name: 'One' })).toBe(null);

      await setProps({ value: 'two', name: 'Two' });

      expect(screen.getByRole('menuitem', { name: 'Two' })).toBeInTheDocument();
    });
  });

  describe('disabled items', () => {
    let onDisabledClick = vi.fn();
    beforeEach(() => {
      onDisabledClick = vi.fn();
    });

    function DisabledItemMenu() {
      return (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.Item disabled onClick={onDisabledClick}>
                      Archive
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    it('keeps a disabled item reachable with the arrow keys', async () => {
      const { user } = render(() => <DisabledItemMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowDown]');

      // Menus keep disabled items discoverable rather than skipping them.
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Archive' }).id,
      );
    });

    it('does not activate a highlighted disabled item with Enter', async () => {
      const { user } = render(() => <DisabledItemMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowDown][Enter]');

      expect(onDisabledClick).not.toHaveBeenCalled();
      expect(screen.getByRole('menu')).toBeVisible();
    });
  });
});
