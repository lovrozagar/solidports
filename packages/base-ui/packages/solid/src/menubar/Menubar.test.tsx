import {
  act,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  wait,
} from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { Menubar } from '@solidports/base-ui/menubar';
import {
  cleanup,
  fireEvent,
  render as solidRender,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { spy } from 'sinon';
import { createRoot, createSignal, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { expect, afterEach, vi } from 'vitest';
import { useMenubarContext } from './MenubarContext';

describe('<Menubar />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(Menubar, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => {
      return render(() => <Menubar>{node(props!)}</Menubar>);
    },
  }));

  it('throws when the menubar context is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function ContextConsumer() {
      useMenubarContext();
      return null;
    }

    try {
      expect(() => render(() => <ContextConsumer />)).to.throw(
        'Base UI: MenubarContext is missing. Menubar parts must be placed within <Menubar>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('ignores a delayed touch click immediately after focus opens another menu', async () => {
    const { user } = render(() => <ContainedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));
    await screen.findByTestId('file-menu');

    const editTrigger = screen.getByTestId('edit-trigger');

    // The focus-open below starts a 300ms wall-clock cooldown during which touch clicks
    // are ignored. Freeze timers so the cooldown cannot expire before the first click
    // on a loaded machine, and advance past its expiry explicitly.
    vi.useFakeTimers();
    try {
      await act(async () => {
        editTrigger.focus();
      });
      screen.getByTestId('edit-menu');

      fireEvent(
        editTrigger,
        new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
      );
      expect(screen.queryByTestId('edit-menu')).not.to.equal(null);

      await act(async () => {
        vi.advanceTimersByTime(310);
      });
    } finally {
      vi.useRealTimers();
    }

    fireEvent(
      editTrigger,
      new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
    );

    await waitFor(() => {
      expect(screen.queryByTestId('edit-menu')).to.equal(null);
    });
  });

  it('keeps focus on an outside target when a triggerless menubar menu closes', async () => {
    function TestComponent() {
      const [open, setOpen] = createSignal(true);

      return (
        <>
          <button data-testid="outside" type="button">
            Outside
          </button>
          <Menubar>
            <Menu.Root open={open()} onOpenChange={setOpen}>
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup data-testid="triggerless-menu">
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>
        </>
      );
    }

    const { user } = render(() => <TestComponent />);
    const outside = screen.getByTestId('outside');

    await user.click(outside);

    await waitFor(() => {
      expect(screen.getByTestId('triggerless-menu')).not.to.have.attribute('data-open');
    });
    expect(outside).toHaveFocus();
  });

  // All these tests run for contained, detached and multiple contained triggers.
  // The rendered menubar has the same structure in most cases.
  describe.for([
    { Component: ContainedTriggerMenubar, name: 'contained triggers' },
    { Component: DetachedTriggerMenubar, name: 'detached triggers' },
    { Component: MultipleContainedTriggersMenubar, name: 'multiple contained triggers' },
  ])('when using $name', ({ Component: TestMenubar }) => {
    describe.skipIf(isJSDOM)('click interactions', () => {
      afterEach(async () => {
        cleanup();
      });

      it('should open the menu after clicking on its trigger and close it when clicking again', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await user.click(fileTrigger, { delay: 30 });
        await screen.findByTestId('file-menu');

        // Click again to close the menu
        await user.click(fileTrigger, { delay: 30 });
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).to.equal(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('hover behavior', async () => {
      afterEach(async () => {
        cleanup();
      });

      it('should not open submenus on hover when no submenu is already open', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await user.hover(fileTrigger);

        // The file menu should not be open because no submenu is already open
        expect(screen.queryByTestId('file-menu')).to.equal(null);
      });

      it('should open submenus on hover when another submenu is already open', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await screen.findByTestId('file-menu');
        await waitFor(() => {
          expect(screen.getByRole('menubar')).to.have.attribute('data-has-submenu-open');
        });

        // Now hover over the edit trigger, it should open because a submenu is already open
        const editTrigger = screen.queryByTestId('edit-trigger');
        expect(editTrigger).not.to.equal(null);

        await user.hover(editTrigger!);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.to.equal(null);
        });

        // The file menu should now be closed
        expect(screen.queryByTestId('file-menu')).to.equal(null);

        // Continue hovering to the view trigger
        const viewTrigger = screen.getByTestId('view-trigger');
        await user.hover(viewTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('view-menu')).not.to.equal(null);
        });

        // The edit menu should now be closed
        expect(screen.queryByTestId('edit-menu')).to.equal(null);
      });

      it('should open nested submenus on hover when parent menu is open', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('file-menu')).not.to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).to.have.attribute('data-has-submenu-open');
        });

        await wait(50);

        // Now hover over the share submenu trigger
        const shareTrigger = await screen.findByTestId('share-trigger');
        await user.hover(shareTrigger);

        // The share submenu should open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.to.equal(null);
        });
      });

      it('should open another menu on hover when a nested submenu is open', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('file-menu')).not.to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).to.have.attribute('data-has-submenu-open');
        });

        // Now hover over the share submenu trigger
        const shareTrigger = await screen.findByTestId('share-trigger');
        await user.hover(shareTrigger);

        // The share submenu should open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.to.equal(null);
        });

        // Hover over the first item in the share submenu
        await user.hover(screen.getByTestId('share-item-1'));

        // Now hover over the edit menubar trigger
        const editTrigger = screen.getByTestId('edit-trigger');
        await user.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.to.equal(null);
        });

        expect(screen.queryByTestId('file-menu')).to.equal(null);
        expect(screen.queryByTestId('share-menu')).to.equal(null);
      });
    });

    describe('focus behavior', () => {
      it('focuses a menubar item without immediately opening the menu', async () => {
        const { user } = render(() => <TestMenubar />);

        await user.tab();

        await waitFor(() => {
          const fileTrigger = screen.getByTestId('file-trigger');
          expect(fileTrigger).toHaveFocus();
          expect(screen.queryByTestId('file-menu')).to.equal(null);
        });

        await wait(50);

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('closeOnClick on nested items behavior', () => {
      afterEach(async () => {
        cleanup();
      });

      it('should respect closeOnClick on nested items when the menu was opened on click', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        const viewTrigger = screen.getByTestId('view-trigger');

        await user.click(viewTrigger, { delay: 30 });
        await screen.findByTestId('view-menu');

        const layoutTrigger = screen.getByTestId('layout-trigger');
        await user.hover(layoutTrigger);

        await screen.findByTestId('layout-menu');

        const layoutItem2 = screen.getByTestId('layout-item-2');
        await user.click(layoutItem2, { delay: 30 });

        // The layout menu should not close after clicking an item
        await waitFor(() => {
          expect(screen.queryByTestId('layout-menu')).not.to.equal(null);
        });
      });

      // https://github.com/mui/base-ui/issues/2092
      it('should respect closeOnClick on nested items when the menu was opened on hover', async () => {
        const { userEvent: user } = await import('vitest/browser');

        render(() => <TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const viewTrigger = screen.getByTestId('view-trigger');

        await user.click(fileTrigger, { delay: 30 });
        await screen.findByTestId('file-menu');

        await user.hover(viewTrigger);
        await screen.findByTestId('view-menu');

        const layoutTrigger = screen.getByTestId('layout-trigger');
        await user.hover(layoutTrigger);

        await screen.findByTestId('layout-menu');

        const layoutItem2 = screen.getByTestId('layout-item-2');
        await user.click(layoutItem2, { delay: 30 });

        // The layout menu should not close after clicking an item
        await waitFor(() => {
          expect(screen.queryByTestId('layout-menu')).not.to.equal(null);
        });
      });
    });

    describe('keyboard interactions', () => {
      it('should navigate between menubar items with arrow keys', async () => {
        const { user } = render(() => <TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');

        // First focus the file trigger

        fileTrigger.focus();

        // Check that file trigger has focus
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });

        // Use arrow right to navigate to edit trigger
        await user.keyboard('{ArrowRight}');

        // Wait for the edit trigger to get focus
        await waitFor(() => {
          expect(editTrigger).toHaveFocus();
        });
      });

      it('moves focus to the first and last triggers with Home and End', async () => {
        const { user } = render(() => <TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const viewTrigger = screen.getByTestId('view-trigger');

        await act(async () => {
          fileTrigger.focus();
        });

        await user.keyboard('{End}');
        await waitFor(() => {
          expect(viewTrigger).toHaveFocus();
        });

        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });
      });

      it('should open the menu with Space key', async () => {
        const { user } = render(() => <TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus the file trigger

        fileTrigger.focus();

        // Press Space key to open menu
        await user.keyboard(' ');

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });
      });

      it('should navigate within the menu using arrow keys', async () => {
        const { user } = render(() => <TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu

        fileTrigger.focus();
        await user.keyboard('{Enter}');

        // File menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });

        // First item should be focused automatically
        const firstItem = screen.getByTestId('file-item-1');
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        // Navigate down to second item
        await user.keyboard('{ArrowDown}');
        const secondItem = screen.getByTestId('file-item-2');
        await waitFor(() => {
          expect(secondItem).toHaveFocus();
        });

        // Navigate down to submenu trigger
        await user.keyboard('{ArrowDown}');
        const shareTrigger = screen.getByTestId('share-trigger');
        await waitFor(() => {
          expect(shareTrigger).toHaveFocus();
        });
      });

      it('should open the submenu with right arrow key', async () => {
        const { user } = render(() => <TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu

        fileTrigger.focus();
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });

        await waitFor(() => {
          expect(screen.getByTestId('file-item-1')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-2')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('share-trigger')).toHaveFocus();
        });

        // Arrow right should open submenu
        await user.keyboard('{ArrowRight}');

        // Share submenu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.to.equal(null);
        });

        // First submenu item should be focused
        const submenuItem = screen.getByTestId('share-item-1');
        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });
      });

      it.skipIf(isJSDOM)('should close the menu with Escape key', async () => {
        const { user } = render(() => <TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu

        fileTrigger.focus();

        await user.keyboard('{Enter}');

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });

        // Press Escape to close
        await user.keyboard('{Escape}');

        // Menu should be closed
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).to.equal(null);
        });
      });

      it('should close submenu with left arrow key and return focus to submenu trigger', async () => {
        const { user } = render(() => <TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu

        fileTrigger.focus();
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-1')).toHaveFocus();
        });

        // Navigate to submenu trigger
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-2')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');

        const shareTrigger = screen.getByTestId('share-trigger');
        await waitFor(() => {
          expect(shareTrigger).toHaveFocus();
        });

        // Open submenu
        await user.keyboard('{ArrowRight}');
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.to.equal(null);
        });

        // Close submenu with left arrow
        await user.keyboard('{ArrowLeft}');

        // Submenu should be closed
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).to.equal(null);
        });

        // Focus should return to submenu trigger
        expect(shareTrigger).toHaveFocus();
      });

      it.skipIf(!isJSDOM)(
        'closes open submenus when navigating to the next menubar item with ArrowRight',
        async () => {
          const rootOnOpenChange = spy();
          const submenuOnOpenChange = spy();
          const nextOnOpenChange = spy();

          function SpyMenubar() {
            return (
              <Menubar>
                <Menu.Root onOpenChange={rootOnOpenChange} data-testid="FILE">
                  <Menu.Trigger data-testid="menubar-file-trigger">File</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="menubar-file-menu">
                      <Menu.Popup>
                        <Menu.Item data-testid="menubar-file-item">Item 1</Menu.Item>
                        <Menu.SubmenuRoot onOpenChange={submenuOnOpenChange}>
                          <Menu.SubmenuTrigger data-testid="menubar-submenu-trigger">
                            Share
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner data-testid="menubar-submenu-menu">
                              <Menu.Popup>
                                <Menu.Item data-testid="menubar-submenu-item">Email</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
                <Menu.Root onOpenChange={nextOnOpenChange} data-testid="EDIT">
                  <Menu.Trigger data-testid="menubar-next-trigger">Edit</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="menubar-next-menu">
                      <Menu.Popup>
                        <Menu.Item>Edit Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </Menubar>
            );
          }

          const { user } = render(() => <SpyMenubar />);
          const fileTrigger = screen.getByTestId('menubar-file-trigger');

          fileTrigger.focus();
          await user.keyboard('{Enter}');
          await screen.findByTestId('menubar-file-menu');

          await waitFor(() => {
            expect(screen.getByTestId('menubar-file-item')).toHaveFocus();
          });

          await user.keyboard('{ArrowDown}');
          const submenuTrigger = screen.getByTestId('menubar-submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');
          await screen.findByTestId('menubar-submenu-menu');

          await waitFor(() => {
            expect(screen.getByTestId('menubar-submenu-item')).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');

          await screen.findByTestId('menubar-next-menu');

          await waitFor(() => {
            expect(screen.queryByTestId('menubar-submenu-menu')).to.equal(null);
          });

          await waitFor(() => {
            expect(screen.queryByTestId('menubar-file-menu')).to.equal(null);
          });

          expect(submenuOnOpenChange.lastCall?.args[0]).to.equal(false);
          expect(rootOnOpenChange.lastCall?.args[0]).to.equal(false);
          expect(nextOnOpenChange.lastCall?.args[0]).to.equal(true);
        },
      );

      // Doesn't work in headless mode.
      it.skipIf(!isJSDOM)(
        'should navigate between menus using left/right arrow keys when menus are open',
        async () => {
          const { user } = render(() => <TestMenubar />);
          const fileTrigger = screen.getByTestId('file-trigger');

          // Focus and open file menu

          fileTrigger.focus();
          await user.keyboard('{Enter}');

          // File menu should be open
          await waitFor(() => {
            expect(screen.queryByTestId('file-menu')).not.to.equal(null);
          });

          // Navigate right to edit menu
          await user.keyboard('{ArrowRight}');

          // File menu should close, edit menu should open
          await waitFor(() => {
            expect(screen.queryByTestId('file-menu')).to.equal(null);
          });
          await waitFor(() => {
            expect(screen.queryByTestId('edit-menu')).not.to.equal(null);
          });
        },
      );
    });

    describe.skipIf(!isJSDOM)('mixed mouse and keyboard interactions', () => {
      it('should allow keyboard navigation after opening a menu with mouse click', async () => {
        const { user } = render(() => <TestMenubar />);

        // Open the menu with a mouse click
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });

        // Navigate with keyboard
        await user.keyboard('{ArrowDown}');
        const firstItem = screen.getByTestId('file-item-1');
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        // Continue navigation
        await user.keyboard('{ArrowDown}');
        const secondItem = screen.getByTestId('file-item-2');
        await waitFor(() => {
          expect(secondItem).toHaveFocus();
        });
      });

      it('should allow clicking a menu trigger then navigating to another menu with keyboard', async () => {
        const { user } = render(() => <TestMenubar />);

        // Open the file menu with a mouse click
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });

        // Navigate to edit menu with keyboard
        await user.keyboard('{ArrowRight}');

        // File menu should close, edit menu should open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).to.equal(null);
        });
        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.to.equal(null);
        });
      });
    });

    describe.skipIf(!isJSDOM)('touch interactions', () => {
      it('closes the entire tree on a single outside press after opening a submenu', async () => {
        render(() => (
          <div>
            <TestMenubar />
            <button data-testid="outside">Outside</button>
          </div>
        ));

        const fileTrigger = screen.getByTestId('file-trigger');

        fireEvent.pointerDown(fileTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(fileTrigger);

        await screen.findByTestId('file-menu');

        const shareTrigger = await screen.findByTestId('share-trigger');
        fireEvent.pointerDown(shareTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(shareTrigger);

        await screen.findByTestId('share-menu');

        const outside = screen.getByTestId('outside');
        fireEvent.pointerDown(outside, { pointerType: 'touch' });
        fireEvent.mouseDown(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).to.equal(null);
          expect(screen.queryByTestId('file-menu')).to.equal(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      it('applies scroll lock when a touch-opened submenu covers the viewport width', async () => {
        render(() => (
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>
        ));

        const trigger = screen.getByTestId('file-trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        const menu = await screen.findByRole('menu');
        const doc = menu.ownerDocument;

        await waitFor(() => {
          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).to.equal(true);
        });
      });

      it('does not apply scroll lock when a touch-opened submenu is narrower than the viewport', async () => {
        render(() => (
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>
        ));

        const trigger = screen.getByTestId('file-trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        const menu = await screen.findByRole('menu');
        const doc = menu.ownerDocument;

        const isScrollLocked =
          doc.documentElement.style.overflow === 'hidden' ||
          doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
          doc.body.style.overflow === 'hidden';

        expect(isScrollLocked).to.equal(false);
      });

      it('updates scroll lock when handing off between top-level touch-opened menus', async () => {
        render(() => (
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="edit-menu" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>Copy</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>
        ));

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');
        const doc = fileTrigger.ownerDocument;

        fireEvent.pointerDown(fileTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(fileTrigger);

        await screen.findByTestId('file-menu');

        await waitFor(() => {
          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).to.equal(true);
        });

        fireEvent.pointerDown(editTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(editTrigger);

        await screen.findByTestId('edit-menu');

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).to.equal(null);
        });

        await waitFor(() => {
          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).to.equal(false);
        });
      });
    });

    describe.skipIf(!isJSDOM)('prop: loopFocus', () => {
      describe('when loopFocus == true', () => {
        it('should loop around to the first item after the last one', async () => {
          const { user } = render(() => <TestMenubar loopFocus />);

          const firstItem = screen.getByTestId('file-trigger');

          firstItem.focus();

          await user.keyboard('{ArrowRight}');
          await user.keyboard('{ArrowRight}');

          const lastItem = screen.getByTestId('view-trigger');
          expect(lastItem).toHaveFocus();

          await user.keyboard('{ArrowRight}');
          expect(firstItem).toHaveFocus();
        });

        it('should loop around to the last item after the first one', async () => {
          const { user } = render(() => <TestMenubar loopFocus />);

          const fileTrigger = screen.getByTestId('file-trigger');

          fileTrigger.focus();

          await waitFor(() => {
            expect(fileTrigger).toHaveFocus();
          });

          await user.keyboard('{ArrowLeft}');
          const lastItem = screen.getByTestId('view-trigger');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });
        });
      });

      describe('when loopFocus == false', () => {
        it('should stay on the last item when navigating beyond it', async () => {
          const { user } = render(() => <TestMenubar loopFocus={false} />);

          const fileTrigger = screen.getByTestId('file-trigger');

          fileTrigger.focus();

          await user.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(screen.queryByTestId('edit-trigger')).not.to.equal(null);
          });

          await user.keyboard('{ArrowRight}');

          const lastItem = screen.getByTestId('view-trigger');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });
        });

        it('should stay on the first item when navigating before it', async () => {
          const { user } = render(() => <TestMenubar loopFocus={false} />);

          const firstItem = screen.getByTestId('file-trigger');

          firstItem.focus();

          await user.keyboard('{ArrowLeft}');
          expect(firstItem).toHaveFocus();
        });
      });
    });

    describe('prop: disabled', () => {
      it('disables child menus when menubar is disabled', async () => {
        const { user } = render(() => <TestMenubar disabled />);

        const fileTrigger = screen.getByTestId('file-trigger');

        // Trigger should be disabled
        expect(fileTrigger).to.have.attribute('disabled');

        // It should not be reachable via Tab
        await user.tab();
        expect(fileTrigger).not.toHaveFocus();
        expect(document.body).toHaveFocus();

        // Clicking should not open the menu
        await user.click(fileTrigger);
        expect(screen.queryByTestId('file-menu')).to.equal(null);
      });
    });

    it.skipIf(isJSDOM)(
      'correctly opens new menu on hover after clicking on its trigger and entering from hover (#2222)',
      async () => {
        const { user } = render(() => <TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).to.have.attribute('data-has-submenu-open');
        });

        await user.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.to.equal(null);
        });

        await user.click(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).not.to.have.attribute('data-has-submenu-open');
        });

        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).to.have.attribute('data-has-submenu-open');
        });

        await user.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.to.equal(null);
        });
      },
    );

    describe('role', () => {
      it('sets role="menubar" on the root element', async () => {
        render(() => <TestMenubar />);
        expect(screen.queryByRole('menubar')).not.to.equal(null);
      });

      it('sets aria-orientation on the root element', async () => {
        render(() => <Menubar orientation="vertical" />);
        expect(screen.getByRole('menubar')).to.have.attribute('aria-orientation', 'vertical');
      });

      it('sets role="menuitem" on menu triggers', async () => {
        render(() => <TestMenubar />);
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).to.have.length(3);
      });
    });
  });

  it('renders contained top-level portal ownership as an allowed menubar child', async () => {
    const { user } = render(() => <ContainedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));

    const fileMenu = await screen.findByTestId('file-menu');
    const fileMenuPortal = fileMenu.closest('[data-base-ui-portal]');
    const fileMenuPortalId = fileMenuPortal?.id ?? '';
    const owner = screen.getByRole('menubar').querySelector('span[aria-owns]');

    expect(fileMenuPortalId).not.to.equal('');
    expect(owner).to.have.attribute('role', 'group');
    expect(owner).not.to.have.attribute('aria-hidden');
    expect(owner).to.have.attribute('aria-owns', fileMenuPortalId);
  });

  it('renders detached top-level portal ownership without an accessibility role', async () => {
    const { user } = render(() => <DetachedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));

    const fileMenu = await screen.findByTestId('file-menu');
    const fileMenuPortal = fileMenu.closest('[data-base-ui-portal]');
    const fileMenuPortalId = fileMenuPortal?.id ?? '';
    const owner = fileMenu.ownerDocument.querySelector('span[aria-owns]');

    expect(fileMenuPortalId).not.to.equal('');
    expect(owner).to.have.attribute('aria-owns', fileMenuPortalId);
    // The portal renders outside the menubar, so the `group` workaround would only add a stray
    // accessible group.
    expect(screen.getByRole('menubar')).not.toContainElement(owner as HTMLElement | null);
    expect(owner).not.to.have.attribute('role');
  });

  describe('disabled state', () => {
    it('keeps the menubar reachable when the first trigger is disabled', async () => {
      const { user } = render(() => (
        <Menubar style={{ display: 'flex' }}>
          <Menu.Root>
            <Menu.Trigger disabled data-testid="file-trigger">
              File
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Open</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Copy</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>
      ));

      const fileTrigger = screen.getByTestId('file-trigger');
      const editTrigger = screen.getByTestId('edit-trigger');

      expect(fileTrigger).to.have.attribute('disabled');
      expect(fileTrigger).to.have.attribute('tabindex', '-1');
      expect(editTrigger).to.have.attribute('tabindex', '0');

      // The disabled first trigger must not swallow the only tab stop.
      await user.tab();
      expect(editTrigger).toHaveFocus();
    });

    it('disables menu items while the menubar is disabled', async () => {
      const handleClick = vi.fn();
      const { user } = render(() => (
        <Menubar disabled>
          <Menu.Root open>
            <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item data-testid="file-item" onClick={handleClick}>
                    Open
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>
      ));

      const item = screen.getByTestId('file-item');
      expect(item).to.have.attribute('aria-disabled', 'true');

      await user.click(item);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });
});

describe('<Menubar /> provider guard', () => {
  it('throws when Menu.Trigger is rendered outside any Menubar context', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let caught: unknown;
    createRoot(() => {
      try {
        solidRender(() => <Menu.Trigger data-testid="orphan">orphan</Menu.Trigger>);
      } catch (e) {
        caught = e;
      }
    });
    errSpy.mockRestore();
    expect(caught).to.be.instanceOf(Error);
  });
});

function ContainedTriggerMenubar(props: Menubar.Props) {
  return (
    <Menubar {...props} style={{ display: 'flex', 'max-width': '25vw' }}>
      <Menu.Root>
        <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="file-menu">
            <Menu.Popup>
              <Menu.Item data-testid="file-item-1">Open</Menu.Item>
              <Menu.Item data-testid="file-item-2">Save</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="share-trigger">Share</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner data-testid="share-menu">
                    <Menu.Popup>
                      <Menu.Item data-testid="share-item-1">Email</Menu.Item>
                      <Menu.Item data-testid="share-item-2">Print</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="edit-menu">
            <Menu.Popup>
              <Menu.Item data-testid="edit-item-1">Copy</Menu.Item>
              <Menu.Item data-testid="edit-item-2">Paste</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="view-trigger">View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="view-menu">
            <Menu.Popup>
              <Menu.Item data-testid="view-item-1">Zoom In</Menu.Item>
              <Menu.Item data-testid="view-item-2">Zoom Out</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="layout-trigger">Layout</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner data-testid="layout-menu">
                    <Menu.Popup>
                      <Menu.RadioGroup defaultValue="single">
                        <Menu.RadioItem value="single" data-testid="layout-item-1">
                          Single column
                        </Menu.RadioItem>
                        <Menu.RadioItem value="two" data-testid="layout-item-2">
                          Two columns
                        </Menu.RadioItem>
                      </Menu.RadioGroup>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menubar>
  );
}

function DynamicMenu(props: { handle?: Menu.Handle<MenuDefinition>; children?: JSX.Element }) {
  return (
    <Menu.Root handle={props.handle}>
      {(data) => {
        return (
          <>
            {props.children}
            <Menu.Portal>
              <Menu.Positioner data-testid={data?.payload?.menuTestId}>
                <Menu.Popup>
                  <For each={data?.payload?.items ?? []}>
                    {(item, index) => <>{renderMenuContentItem(item, `item-${index()}`)}</>}
                  </For>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </>
        );
      }}
    </Menu.Root>
  );
}

function renderMenuContentItem(item: ContentItem, key: string) {
  switch (item.type) {
    case 'item':
      return (
        <Menu.Item
          disabled={item.disabled}
          closeOnClick={item.closeOnClick}
          onClick={item.onClick}
          data-testid={item.testId}
        >
          {item.label}
        </Menu.Item>
      );

    case 'submenu':
      return (
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger data-testid={item.testId}>{item.label}</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner data-testid={item.menuTestId}>
              <Menu.Popup>
                <For each={item.items}>
                  {(subItem, subIndex) => (
                    <>{renderMenuContentItem(subItem, `${key}.${subIndex()}`)}</>
                  )}
                </For>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
    case 'radioGroup':
      return (
        <Menu.RadioGroup defaultValue={item.defaultValue}>
          <For each={item.items}>
            {(radioItem, radioIndex) => (
              <>{renderMenuContentItem(radioItem, `${key}.${radioIndex()}`)}</>
            )}
          </For>
        </Menu.RadioGroup>
      );
    case 'radioItem':
      return (
        <Menu.RadioItem value={item.value} data-testid={item.testId} disabled={item.disabled}>
          {item.label}
        </Menu.RadioItem>
      );
    default:
      return null;
  }
}

type RadioItem = {
  type: 'radioItem';
  label: string;
  value: string;
  testId?: string;
  disabled?: boolean;
};

type ContentItem =
  | {
      type: 'item';
      label: string;
      testId?: string;
      disabled?: boolean;
      closeOnClick?: boolean;
      onClick?: () => void;
    }
  | {
      type: 'submenu';
      label: string;
      testId?: string;
      disabled?: boolean;
      menuTestId?: string;
      items: ContentItem[];
    }
  | {
      type: 'radioGroup';
      defaultValue?: string;
      items: RadioItem[];
    }
  | RadioItem;

type MenuDefinition = {
  label: string;
  triggerTestId?: string;
  menuTestId?: string;
  items: ContentItem[];
};

const menuContents: Record<string, MenuDefinition> = {
  file: {
    label: 'File',
    triggerTestId: 'file-trigger',
    menuTestId: 'file-menu',
    items: [
      { type: 'item', label: 'Open', testId: 'file-item-1' },
      { type: 'item', label: 'Save', testId: 'file-item-2' },
      {
        type: 'submenu',
        label: 'Share',
        testId: 'share-trigger',
        menuTestId: 'share-menu',
        items: [
          { type: 'item', label: 'Email', testId: 'share-item-1' },
          { type: 'item', label: 'Print', testId: 'share-item-2' },
        ],
      },
    ],
  },
  edit: {
    label: 'Edit',
    triggerTestId: 'edit-trigger',
    menuTestId: 'edit-menu',
    items: [
      { type: 'item', label: 'Copy', testId: 'edit-item-1' },
      { type: 'item', label: 'Paste', testId: 'edit-item-2' },
    ],
  },
  view: {
    label: 'View',
    triggerTestId: 'view-trigger',
    menuTestId: 'view-menu',
    items: [
      { type: 'item', label: 'Zoom In', testId: 'view-item-1' },
      { type: 'item', label: 'Zoom Out', testId: 'view-item-2' },
      {
        type: 'submenu',
        label: 'Layout',
        testId: 'layout-trigger',
        menuTestId: 'layout-menu',
        items: [
          {
            type: 'radioGroup',
            defaultValue: 'single',
            items: [
              {
                type: 'radioItem',
                value: 'single',
                label: 'Single column',
                testId: 'layout-item-1',
              },
              {
                type: 'radioItem',
                value: 'two',
                label: 'Two columns',
                testId: 'layout-item-2',
              },
            ],
          },
        ],
      },
    ],
  },
};

function DetachedTriggerMenubar(props: Menubar.Props) {
  const testMenuHandle = new Menu.Handle<MenuDefinition>();

  return (
    <>
      <Menubar {...props} style={{ display: 'flex', 'max-width': '25vw' }}>
        <For each={Object.entries(menuContents)}>
          {(item) => (
            <Menu.Trigger
              handle={testMenuHandle}
              payload={item[1]}
              data-testid={item[1].triggerTestId}
            >
              {item[1].label}
            </Menu.Trigger>
          )}
        </For>
      </Menubar>
      <DynamicMenu handle={testMenuHandle} />
    </>
  );
}

function MultipleContainedTriggersMenubar(props: Menubar.Props) {
  return (
    <Menubar {...props} style={{ display: 'flex', 'max-width': '25vw' }}>
      <DynamicMenu>
        <For each={Object.entries(menuContents)}>
          {(item) => (
            <Menu.Trigger payload={item[1]} data-testid={item[1].triggerTestId}>
              {item[1].label}
            </Menu.Trigger>
          )}
        </For>
      </DynamicMenu>
    </Menubar>
  );
}
