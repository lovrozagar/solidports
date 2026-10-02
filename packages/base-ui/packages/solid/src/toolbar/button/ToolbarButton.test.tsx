import { act, createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { AlertDialog } from '@solidports/base-ui/alert-dialog';
import { Dialog } from '@solidports/base-ui/dialog';
import { Menu } from '@solidports/base-ui/menu';
import { Popover } from '@solidports/base-ui/popover';
import { Select } from '@solidports/base-ui/select';
import { Switch } from '@solidports/base-ui/switch';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { mergeProps } from '@solidports/base-ui/merge-props';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { expect, vi } from 'vitest';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { NOOP } from '../../utils/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';

const testCompositeContext: CompositeRootContext = {
  highlightItemOnHover: () => false,
  highlightedIndex: () => 0,
  onHighlightedIndexChange: NOOP,
  relayKeyboardEvent: NOOP,
};

const testToolbarContext: ToolbarRootContext = {
  disabled: () => false,
  orientation: () => 'horizontal',
};

describe('<Toolbar.Button />', () => {
  const { render } = createRenderer();

  describeConformance(Toolbar.Button, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) => {
      return render(() => (
        <ToolbarRootContext value={testToolbarContext}>
          <CompositeRootContext value={testCompositeContext}>{node(props!)}</CompositeRootContext>
        </ToolbarRootContext>
      ));
    },
    testComponentPropWith: 'button',
  }));

  describe('ARIA attributes', () => {
    it('renders a button', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
        </Toolbar.Root>
      ));

      expect(screen.getByTestId('button')).to.equal(screen.getByRole('button'));
    });
  });

  describe('prop: nativeButton', () => {
    it('custom element: dispatches real clicks from Space keyboard activation', async () => {
      const handleClick = vi.fn();
      const handleRenderClick = vi.fn();
      const handleCaptureClick = vi.fn();
      const handleAncestorClick = vi.fn();

      const { user } = render(() => (
        <div onClick={handleAncestorClick}>
          <Toolbar.Root>
            <Toolbar.Button
              nativeButton={false}
              render={(props) => (
                <span
                  {...mergeProps<'span'>(props, {
                    onClick: handleRenderClick,
                    // Solid: no `onClickCapture` JSX prop; register the capture listener directly.
                    ref: (element: HTMLSpanElement) =>
                      element.addEventListener('click', handleCaptureClick, true),
                  })}
                />
              )}
              onClick={handleClick}
            >
              Save
            </Toolbar.Button>
          </Toolbar.Root>
        </div>
      ));

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');

      expect(handleCaptureClick).toHaveBeenCalledTimes(1);
      expect(handleRenderClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleAncestorClick).toHaveBeenCalledTimes(1);
    });

    it('custom element: dispatches real clicks from Enter keyboard activation', async () => {
      const handleClick = vi.fn();
      const handleRenderClick = vi.fn();
      const handleCaptureClick = vi.fn();
      const handleAncestorClick = vi.fn();

      const { user } = render(() => (
        <div onClick={handleAncestorClick}>
          <Toolbar.Root>
            <Toolbar.Button
              nativeButton={false}
              render={(props) => (
                <span
                  {...mergeProps<'span'>(props, {
                    onClick: handleRenderClick,
                    // Solid: no `onClickCapture` JSX prop; register the capture listener directly.
                    ref: (element: HTMLSpanElement) =>
                      element.addEventListener('click', handleCaptureClick, true),
                  })}
                />
              )}
              onClick={handleClick}
            >
              Save
            </Toolbar.Button>
          </Toolbar.Root>
        </div>
      ));

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(handleCaptureClick).toHaveBeenCalledTimes(1);
      expect(handleRenderClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleAncestorClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn().mockName('handleMouseDown');
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const { user } = render(() => (
        <Toolbar.Root>
          <Toolbar.Button
            disabled
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
          />
        </Toolbar.Root>
      ));

      const button = screen.getByRole('button');

      expect(button).to.not.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).to.have.attribute('aria-disabled', 'true');

      await user.click(button);
      await user.keyboard(`[Space]`);
      await user.keyboard(`[Enter]`);
      expect(handleClick).toHaveBeenCalledTimes(0);
      expect(handleMouseDown).toHaveBeenCalledTimes(0);
      expect(handlePointerDown).toHaveBeenCalledTimes(0);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
    });

    it('uses the disabled attribute when focusableWhenDisabled is false', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
        </Toolbar.Root>
      ));

      const button = screen.getByRole('button');

      expect(button).to.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).not.to.have.attribute('aria-disabled');
    });

    it.skipIf(isJSDOM)('allows hover handlers while blocking activation', async () => {
      const handleClick = vi.fn();
      const handleMouseMove = vi.fn();

      const { user } = render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled onClick={handleClick} onMouseMove={handleMouseMove} />
        </Toolbar.Root>
      ));

      const button = screen.getByRole('button');

      expect(button).not.to.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).to.have.attribute('aria-disabled', 'true');

      await user.hover(button);

      expect(handleMouseMove).toHaveBeenCalled();

      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(0);
    });
  });

  describe('rendering other Base UI components', () => {
    describe('Switch', () => {
      it('renders a switch', async () => {
        vi.spyOn(console, 'error')
          .mockName('console.error')
          .mockImplementation(() => {});

        render(() => (
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" render={{ component: Switch.Root }} />
          </Toolbar.Root>
        ));

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: A component that acts as a button expected a native <button> because ' +
              'the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, ' +
              'which can impact forms and accessibility. Use a real <button> in the `render` prop, or ' +
              'set `nativeButton` to `false`.',
          ),
        );

        expect(screen.getByTestId('button')).to.equal(screen.getByRole('switch'));
      });

      it('handles interactions', async () => {
        vi.spyOn(console, 'error')
          .mockName('console.error')
          .mockImplementation(() => {});

        const handleCheckedChange = vi.fn();
        const handleClick = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Toolbar.Button
              onClick={handleClick}
              render={{
                component: Switch.Root,
                defaultChecked: false,
                onCheckedChange: handleCheckedChange,
              }}
            />
          </Toolbar.Root>
        ));

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: A component that acts as a button expected a native <button> because ' +
              'the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, ' +
              'which can impact forms and accessibility. Use a real <button> in the `render` prop, or ' +
              'set `nativeButton` to `false`.',
          ),
        );

        const switchElement = screen.getByRole('switch');
        expect(switchElement).to.have.attribute('data-unchecked');

        await user.keyboard('[Tab]');
        expect(switchElement).to.have.attribute('tabindex', '0');

        await user.click(switchElement);
        expect(handleCheckedChange).toHaveBeenCalledTimes(1);
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(switchElement).to.have.attribute('data-checked');

        await user.keyboard('[Enter]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(2);
        expect(handleClick).toHaveBeenCalledTimes(2);
        expect(switchElement).to.have.attribute('data-unchecked');

        await user.keyboard('[Space]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(3);
        expect(handleClick).toHaveBeenCalledTimes(3);
        expect(switchElement).to.have.attribute('data-checked');
      });

      it('disabled state', async () => {
        vi.spyOn(console, 'error')
          .mockName('console.error')
          .mockImplementation(() => {});

        const handleCheckedChange = vi.fn();
        const handleClick = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Toolbar.Button
              disabled
              onClick={handleClick}
              render={{
                component: Switch.Root,
                onCheckedChange: handleCheckedChange,
              }}
            />
          </Toolbar.Root>
        ));

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: A component that acts as a button expected a native <button> because ' +
              'the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, ' +
              'which can impact forms and accessibility. Use a real <button> in the `render` prop, or ' +
              'set `nativeButton` to `false`.',
          ),
        );

        const switchElement = screen.getByRole('switch');

        expect(switchElement).to.not.have.attribute('disabled');
        expect(switchElement).to.have.attribute('data-disabled');
        expect(switchElement).to.have.attribute('aria-disabled', 'true');

        await user.keyboard('[Tab]');
        expect(switchElement).to.have.attribute('tabindex', '0');

        await user.keyboard('[Enter]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(0);
        expect(handleClick).toHaveBeenCalledTimes(0);

        await user.keyboard('[Space]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(0);
        expect(handleClick).toHaveBeenCalledTimes(0);

        await user.click(switchElement);
        expect(handleCheckedChange).toHaveBeenCalledTimes(0);
        expect(handleClick).toHaveBeenCalledTimes(0);
      });
    });

    describe('Menu', () => {
      it('renders a menu trigger', async () => {
        render(() => (
          <Toolbar.Root>
            <Menu.Root>
              <Toolbar.Button
                data-testid="button"
                render={{ children: 'Toggle', component: Menu.Trigger }}
              />
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="item-1">1</Menu.Item>
                    <Menu.Item data-testid="item-2">2</Menu.Item>
                    <Menu.Item data-testid="item-3">3</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Toolbar.Root>
        ));

        expect(screen.getByTestId('button')).to.have.attribute('aria-haspopup', 'menu');
      });

      it('handles interactions', async () => {
        const handleOpenChange = vi.fn();
        const handleClick = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Menu.Root onOpenChange={handleOpenChange}>
              <Toolbar.Button
                data-testid="button"
                onClick={handleClick}
                render={{
                  children: 'Toggle',
                  component: Menu.Trigger,
                }}
              />
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="item-1">1</Menu.Item>
                    <Menu.Item data-testid="item-2">2</Menu.Item>
                    <Menu.Item data-testid="item-3">3</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByRole('menu')).to.equal(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        await user.keyboard('[Enter]');
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).not.to.equal(null);

        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowUp]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[Escape]');
        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });

        expect(handleOpenChange).toHaveBeenCalledTimes(2);

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
      });

      it('disabled state', async () => {
        const handleOpenChange = vi.fn();
        const handleClick = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Menu.Root onOpenChange={handleOpenChange}>
              <Toolbar.Button
                data-testid="button"
                disabled
                onClick={handleClick}
                render={{
                  children: 'Toggle',
                  component: Menu.Trigger,
                }}
              />
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="item-1">1</Menu.Item>
                    <Menu.Item data-testid="item-2">2</Menu.Item>
                    <Menu.Item data-testid="item-3">3</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Toolbar.Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        expect(trigger).to.not.have.attribute('disabled');
        expect(trigger).to.have.attribute('data-disabled');
        expect(trigger).to.have.attribute('aria-disabled', 'true');

        expect(screen.queryByRole('menu')).to.equal(null);

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        await user.keyboard('[ArrowUp]');
        await user.keyboard('[ArrowDown]');

        expect(handleClick).toHaveBeenCalledTimes(0);
        expect(handleOpenChange).toHaveBeenCalledTimes(0);
        expect(screen.queryByRole('menu')).to.equal(null);
      });
    });

    describe('Select', () => {
      it('renders a select trigger', async () => {
        render(() => (
          <Toolbar.Root>
            <Select.Root defaultValue="a">
              <Toolbar.Button data-testid="button" render={{ component: Select.Trigger }} />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Toolbar.Root>
        ));

        const trigger = screen.getByTestId('button');
        expect(trigger).to.equal(screen.getByRole('combobox'));
        expect(trigger).to.have.attribute('aria-haspopup', 'listbox');
      });

      it.skipIf(!isJSDOM)('handles interactions', async () => {
        const handleValueChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Select.Root defaultValue="a" onValueChange={handleValueChange}>
              <Toolbar.Button data-testid="button" render={{ component: Select.Trigger }} />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup data-testid="popup">
                    <Select.Item value="a" data-testid="item-a">
                      a
                    </Select.Item>
                    <Select.Item value="b" data-testid="item-b">
                      b
                    </Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByRole('listbox')).to.equal(null);

        const trigger = screen.getByTestId('button');
        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        await user.keyboard('[ArrowDown]');
        expect(screen.queryByRole('listbox')).to.equal(screen.getByTestId('popup'));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'a' })).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'b' })).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).to.equal(null);
        });

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange).toHaveBeenCalledWith('b', expect.anything());
      });

      it('disabled state', async () => {
        await expect(async () => {
          const onValueChange = vi.fn();
          const onOpenChange = vi.fn();
          const { user } = render(() => (
            <Toolbar.Root>
              <Select.Root
                defaultValue="a"
                onValueChange={onValueChange}
                onOpenChange={onOpenChange}
              >
                <Toolbar.Button
                  disabled
                  render={{ component: Select.Trigger, nativeButton: false }}
                />
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.Item value="a" />
                      <Select.Item value="b" />
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Toolbar.Root>
          ));

          expect(screen.queryByRole('listbox')).to.equal(null);

          const trigger = screen.getByRole('combobox');
          expect(trigger).to.not.have.attribute('disabled');
          expect(trigger).to.have.attribute('data-disabled');
          expect(trigger).to.have.attribute('aria-disabled', 'true');

          await user.keyboard('[Tab]');
          expect(trigger).toHaveFocus();

          expect(onOpenChange).toHaveBeenCalledTimes(0);
          expect(onValueChange).toHaveBeenCalledTimes(0);

          await user.keyboard('[ArrowUp]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[Enter]');
          await user.keyboard('[Space]');

          expect(onOpenChange).toHaveBeenCalledTimes(0);
          expect(onValueChange).toHaveBeenCalledTimes(0);
        }).toErrorDev([
          'Base UI: A component that acts as a button expected a non-<button> because ' +
            'the `nativeButton` prop is false. Rendering a <button> keeps native behavior while Base UI ' +
            'applies non-native attributes and handlers, which can add unintended extra attributes ' +
            '(such as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' +
            '`nativeButton` to `true`.',
        ]);
      });
    });

    describe('Dialog', () => {
      it('renders a dialog trigger', async () => {
        render(() => (
          <Toolbar.Root>
            <Dialog.Root modal={false}>
              <Toolbar.Button
                render={{
                  component: Dialog.Trigger,
                  'data-testid': 'trigger',
                }}
              />
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Popup>
                  <Dialog.Title>title text</Dialog.Title>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Toolbar.Root>
        ));

        expect(screen.getByTestId('trigger')).to.equal(screen.getByRole('button'));
      });

      it('handles interactions', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Dialog.Root modal={false} onOpenChange={onOpenChange}>
              <Toolbar.Button render={{ component: Dialog.Trigger }} />
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Popup>
                  <Dialog.Title>title text</Dialog.Title>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByText('title text')).to.equal(null);

        const trigger = screen.getByRole('button');
        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        expect(onOpenChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Enter]');
        expect(screen.queryByText('title text')).not.to.equal(null);
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenNthCalledWith(1, true, expect.anything());

        await user.keyboard('[Escape]');
        expect(screen.queryByText('title text')).to.equal(null);
        expect(onOpenChange).toHaveBeenCalledTimes(2);
        expect(onOpenChange).toHaveBeenNthCalledWith(2, false, expect.anything());

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
      });

      it('disabled state', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Dialog.Root modal={false} onOpenChange={onOpenChange}>
              <Toolbar.Button disabled render={{ component: Dialog.Trigger }} />
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Popup>
                  <Dialog.Title>title text</Dialog.Title>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByText('title text')).to.equal(null);

        const trigger = screen.getByRole('button');
        expect(trigger).to.not.have.attribute('disabled');
        expect(trigger).to.have.attribute('data-disabled');
        expect(trigger).to.have.attribute('aria-disabled', 'true');

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        expect(onOpenChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        await user.keyboard('[ArrowUp]');
        await user.keyboard('[ArrowDown]');
        expect(onOpenChange).toHaveBeenCalledTimes(0);
      });

      it('prevents composite keydowns from escaping', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Dialog.Root modal={false} onOpenChange={onOpenChange}>
              <Toolbar.Button render={{ component: Dialog.Trigger }}>dialog</Toolbar.Button>
              <Dialog.Portal>
                <Dialog.Popup />
              </Dialog.Portal>
            </Dialog.Root>

            <Toolbar.Button>empty</Toolbar.Button>
          </Toolbar.Root>
        ));

        expect(screen.queryByRole('dialog')).to.equal(null);

        const trigger = screen.getByRole('button', { name: 'dialog' });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toHaveFocus();
        });

        await user.keyboard('{ArrowRight}');

        expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
      });
    });

    describe('AlertDialog', () => {
      it('renders an alert dialog trigger', async () => {
        render(() => (
          <Toolbar.Root>
            <AlertDialog.Root>
              <Toolbar.Button
                render={{
                  component: AlertDialog.Trigger,
                  'data-testid': 'trigger',
                }}
              />
              <AlertDialog.Portal>
                <AlertDialog.Backdrop />
                <AlertDialog.Popup>
                  <AlertDialog.Title>title text</AlertDialog.Title>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </Toolbar.Root>
        ));

        expect(screen.getByTestId('trigger')).to.equal(screen.getByRole('button'));
      });

      it('handles interactions', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <AlertDialog.Root onOpenChange={onOpenChange}>
              <Toolbar.Button render={{ component: AlertDialog.Trigger }} />
              <AlertDialog.Portal>
                <AlertDialog.Backdrop />
                <AlertDialog.Popup>
                  <AlertDialog.Title>title text</AlertDialog.Title>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByText('title text')).to.equal(null);

        const trigger = screen.getByRole('button');
        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        expect(onOpenChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Enter]');
        expect(screen.queryByText('title text')).to.not.equal(null);
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenNthCalledWith(1, true, expect.anything());

        await user.keyboard('[Escape]');
        expect(screen.queryByText('title text')).to.equal(null);
        expect(onOpenChange).toHaveBeenCalledTimes(2);
        expect(onOpenChange).toHaveBeenNthCalledWith(2, false, expect.anything());

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
      });

      it('disabled state', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <AlertDialog.Root onOpenChange={onOpenChange}>
              <Toolbar.Button disabled render={{ component: AlertDialog.Trigger }} />
              <AlertDialog.Portal>
                <AlertDialog.Backdrop />
                <AlertDialog.Popup>
                  <AlertDialog.Title>title text</AlertDialog.Title>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByText('title text')).to.equal(null);

        const trigger = screen.getByRole('button');
        expect(trigger).to.not.have.attribute('disabled');
        expect(trigger).to.have.attribute('data-disabled');
        expect(trigger).to.have.attribute('aria-disabled', 'true');

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        expect(onOpenChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        await user.keyboard('[ArrowUp]');
        await user.keyboard('[ArrowDown]');
        expect(onOpenChange).toHaveBeenCalledTimes(0);
      });

      it('prevents composite keydowns from escaping', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <AlertDialog.Root onOpenChange={onOpenChange}>
              <Toolbar.Button render={{ component: AlertDialog.Trigger }}>dialog</Toolbar.Button>
              <AlertDialog.Portal>
                <AlertDialog.Popup />
              </AlertDialog.Portal>
            </AlertDialog.Root>

            <Toolbar.Button>empty</Toolbar.Button>
          </Toolbar.Root>
        ));

        expect(screen.queryByRole('dialog')).to.equal(null);

        const trigger = screen.getByRole('button', { name: 'dialog' });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('alertdialog')).toHaveFocus();
        });

        await user.keyboard('{ArrowRight}');

        expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
      });
    });

    describe('Popover', () => {
      it('renders a popover trigger', async () => {
        render(() => (
          <Toolbar.Root>
            <Popover.Root>
              <Toolbar.Button
                render={{
                  component: Popover.Trigger,
                  'data-testid': 'trigger',
                }}
              />
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </Toolbar.Root>
        ));

        expect(screen.getByTestId('trigger')).to.equal(screen.getByRole('button'));
        expect(screen.getByRole('button')).to.have.attribute('aria-haspopup', 'dialog');
      });

      it('handles interactions', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Popover.Root onOpenChange={onOpenChange}>
              <Toolbar.Button render={{ component: Popover.Trigger }} />
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByText('Content')).to.equal(null);

        const trigger = screen.getByRole('button');
        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        expect(onOpenChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Enter]');
        expect(screen.queryByText('Content')).not.to.equal(null);
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenNthCalledWith(1, true, expect.anything());

        await user.keyboard('[Escape]');
        expect(onOpenChange).toHaveBeenCalledTimes(2);
        expect(onOpenChange).toHaveBeenNthCalledWith(2, false, expect.anything());

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
      });

      it('disabled state', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Popover.Root onOpenChange={onOpenChange}>
              <Toolbar.Button disabled render={{ component: Popover.Trigger }} />
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </Toolbar.Root>
        ));

        expect(screen.queryByText('Content')).to.equal(null);

        const trigger = screen.getByRole('button');
        expect(trigger).to.not.have.attribute('disabled');
        expect(trigger).to.have.attribute('data-disabled');
        expect(trigger).to.have.attribute('aria-disabled', 'true');

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        expect(onOpenChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        await user.keyboard('[ArrowUp]');
        await user.keyboard('[ArrowDown]');
        expect(onOpenChange).toHaveBeenCalledTimes(0);
      });
    });

    describe('Toggle and ToggleGroup', () => {
      it('renders toggle and toggle group', async () => {
        render(() => (
          <Toolbar.Root>
            <Toolbar.Button render={{ component: Toggle, value: 'apple' }} />
            <ToggleGroup>
              <Toolbar.Button render={{ component: Toggle, value: 'one' }} />
              <Toolbar.Button render={{ component: Toggle, value: 'two' }} />
            </ToggleGroup>
          </Toolbar.Root>
        ));

        expect(screen.getAllByRole('button').length).to.equal(3);
        screen.getAllByRole('button').forEach((button) => {
          expect(button).to.have.attribute('aria-pressed');
        });
      });

      it('handles interactions', async () => {
        const onPressedChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Toolbar.Button render={{ component: Toggle, onPressedChange }} value="apple" />
            <ToggleGroup>
              <Toolbar.Button render={{ component: Toggle, onPressedChange }} value="one" />
              <Toolbar.Button render={{ component: Toggle, onPressedChange }} value="two" />
            </ToggleGroup>
          </Toolbar.Root>
        ));

        const [button1, button2, button3] = screen.getAllByRole('button');

        [button1, button2, button3].forEach((button) => {
          expect(button).to.have.attribute('aria-pressed', 'false');
        });
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(button1).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onPressedChange).toHaveBeenCalledTimes(1);
        expect(button1).to.have.attribute('aria-pressed', 'true');

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button2).toHaveFocus();
        });

        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(2);
        expect(button2).to.have.attribute('aria-pressed', 'true');

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button3).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onPressedChange).toHaveBeenCalledTimes(3);
        expect(button3).to.have.attribute('aria-pressed', 'true');
      });

      it('disabled state', async () => {
        const onPressedChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <Toolbar.Button
              disabled
              render={{ component: Toggle, onPressedChange }}
              value="apple"
            />
            <ToggleGroup>
              <Toolbar.Button
                disabled
                render={{ component: Toggle, onPressedChange }}
                value="one"
              />
              <Toolbar.Button
                disabled
                render={{ component: Toggle, onPressedChange }}
                value="two"
              />
            </ToggleGroup>
          </Toolbar.Root>
        ));
        const [button1, button2, button3] = screen.getAllByRole('button');

        [button1, button2, button3].forEach((button) => {
          expect(button).to.have.attribute('aria-pressed', 'false');
          expect(button).to.not.have.attribute('disabled');
          expect(button).to.have.attribute('data-disabled');
          expect(button).to.have.attribute('aria-disabled', 'true');
        });
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(button1).toHaveFocus();
        });
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button2).toHaveFocus();
        });
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button3).toHaveFocus();
        });
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(0);
      });

      it('navigates and selects direct ToggleGroup > Toggle children', async () => {
        const onValueChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <ToggleGroup defaultValue={['one']} onValueChange={onValueChange}>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" />
              <Toggle value="three" data-testid="three" />
            </ToggleGroup>
          </Toolbar.Root>
        ));

        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');
        const three = screen.getByTestId('three');

        expect(one).to.have.attribute('aria-pressed', 'true');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        // toggles past the first must be reachable (previously treated as disabled)
        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(two).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(three).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onValueChange).toHaveBeenCalledTimes(1);
        // exclusive selection replaces the previous value
        expect(onValueChange.mock.calls[0][0]).toEqual(['three']);
        expect(one).to.have.attribute('aria-pressed', 'false');
        expect(three).to.have.attribute('aria-pressed', 'true');
      });

      it.skipIf(isJSDOM)('skips disabled direct ToggleGroup > Toggle children', async () => {
        const { user } = render(() => (
          <Toolbar.Root>
            <ToggleGroup>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" disabled />
              <Toggle value="three" data-testid="three" />
            </ToggleGroup>
          </Toolbar.Root>
        ));

        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');
        const three = screen.getByTestId('three');

        expect(two).toBeDisabled();

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(three).toHaveFocus();
        });
        expect(two).not.to.have.attribute('tabindex', '0');
      });

      it('supports multiple selection for direct ToggleGroup > Toggle children', async () => {
        const onValueChange = vi.fn();
        const { user } = render(() => (
          <Toolbar.Root>
            <ToggleGroup multiple defaultValue={['one']} onValueChange={onValueChange}>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" />
            </ToggleGroup>
          </Toolbar.Root>
        ));

        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(two).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onValueChange.mock.calls[0][0]).toEqual(['one', 'two']);
        expect(one).to.have.attribute('aria-pressed', 'true');
        expect(two).to.have.attribute('aria-pressed', 'true');
      });

      it('supports a controlled ToggleGroup value', async () => {
        function App() {
          const [value, setValue] = createSignal<string[]>([]);
          return (
            <Toolbar.Root>
              <ToggleGroup value={value()} onValueChange={setValue}>
                <Toggle value="one" data-testid="one" />
                <Toggle value="two" data-testid="two" />
              </ToggleGroup>
            </Toolbar.Root>
          );
        }

        const { user } = render(() => <App />);
        const one = screen.getByTestId('one');

        expect(one).to.have.attribute('aria-pressed', 'false');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(one).to.have.attribute('aria-pressed', 'true');
      });

      it('disables direct ToggleGroup children when Toolbar.Group is disabled', async () => {
        const { user } = render(() => (
          <Toolbar.Root>
            <Toolbar.Button data-testid="before" />
            <Toolbar.Group disabled>
              <ToggleGroup>
                <Toggle value="one" data-testid="one" />
                <Toggle value="two" data-testid="two" />
              </ToggleGroup>
            </Toolbar.Group>
            <Toolbar.Button data-testid="after" />
          </Toolbar.Root>
        ));

        const before = screen.getByTestId('before');
        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');
        const after = screen.getByTestId('after');

        [one, two].forEach((toggle) => {
          expect(toggle).toBeDisabled();
          expect(toggle).to.have.attribute('data-disabled');
        });

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(before).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(after).toHaveFocus();
        });
        expect(one).not.to.have.attribute('tabindex', '0');
        expect(two).not.to.have.attribute('tabindex', '0');
      });

      it.skipIf(isJSDOM)('skips a direct Toggle that becomes disabled at runtime', async () => {
        const [twoDisabled, setTwoDisabled] = createSignal<boolean | undefined>(undefined);

        function App() {
          return (
            <Toolbar.Root>
              <ToggleGroup>
                <Toggle value="one" data-testid="one" />
                <Toggle value="two" data-testid="two" disabled={twoDisabled()} />
                <Toggle value="three" data-testid="three" />
              </ToggleGroup>
            </Toolbar.Root>
          );
        }

        const { user } = render(() => <App />);

        const one = screen.getByTestId('one');
        const three = screen.getByTestId('three');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        act(() => setTwoDisabled(true));

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      });
    });
  });
});
