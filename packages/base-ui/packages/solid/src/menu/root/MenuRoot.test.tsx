import {
  act,
  createRenderer,
  flushMicrotasks,
  isJSDOM,
  popupConformanceTests,
  wait,
} from '#test-utils';
import { AlertDialog } from '@solidports/base-ui/alert-dialog';
import { Dialog } from '@solidports/base-ui/dialog';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { Menu } from '@solidports/base-ui/menu';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { spy } from 'sinon';
import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { CDPSession } from '@vitest/browser-playwright';
import { expect, vi } from 'vitest';
import { PATIENT_CLICK_THRESHOLD } from '../../utils/constants';
import { REASONS } from '../../utils/reasons';
import { splitProps } from '../../solid-1-compat';

// Solid: React reads `platform.engine.blink`.
const isBlink = typeof navigator !== 'undefined' && /Chrome\//.test(navigator.userAgent);

describe('<Menu.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        <Menu.Trigger {...props.trigger}>Open menu</Menu.Trigger>
        <Menu.Portal {...props.portal}>
          <Menu.Positioner>
            <Menu.Popup {...props.popup}>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    expectedPopupRole: 'menu',
    render: (...args) => render(...(args as Parameters<typeof render>)),
    triggerMouseAction: 'click',
  });

  function NestedMenuWithModalProp() {
    const SubmenuRootWithModal = Menu.SubmenuRoot as Component<
      Menu.SubmenuRoot.Props & { modal: boolean }
    >;

    return (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <SubmenuRootWithModal defaultOpen modal={false}>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup />
                  </Menu.Positioner>
                </Menu.Portal>
              </SubmenuRootWithModal>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  }

  it('warns that nested menus ignore the modal prop', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => <NestedMenuWithModalProp />);

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `modal` prop is not supported on nested menus. It will be ignored.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it.skipIf(!isJSDOM)('does not emit the nested modal warning in production', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      render(() => <NestedMenuWithModalProp />);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      warnSpy.mockRestore();
    }
  });

  // All these tests run for contained and detached triggers.
  // The rendered menubar has the same structure in most cases.
  describe.for([
    { Component: ContainedTriggerMenu, name: 'contained triggers' },
    { Component: DetachedTriggerMenu, name: 'detached triggers' },
  ])('when using $name', ({ Component: TestMenu }) => {
    it('sets aria-orientation on a horizontal popup', async () => {
      render(() => <TestMenu rootProps={{ defaultOpen: true, orientation: 'horizontal' }} />);

      expect(screen.getByRole('menu')).to.have.attribute('aria-orientation', 'horizontal');
    });

    it('does not render aria-orientation on a vertical popup', async () => {
      render(() => <TestMenu rootProps={{ defaultOpen: true }} />);

      // `menu` is implicitly vertical.
      expect(screen.getByRole('menu')).not.to.have.attribute('aria-orientation');
    });

    describe('keyboard navigation', () => {
      it('changes the highlighted item using the arrow keys', async () => {
        render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      it.skipIf(isJSDOM)('navigates across grouped items with arrow keys and text', async () => {
        const { user } = render(() => (
          <TestMenu
            popupProps={{
              get children() {
                return (
                  <>
                    <Menu.Group>
                      <Menu.Item>Apple</Menu.Item>
                      <Menu.Item>Banana</Menu.Item>
                    </Menu.Group>
                    <Menu.Group>
                      <Menu.Item>Cherry</Menu.Item>
                    </Menu.Group>
                  </>
                );
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });
        await user.keyboard('[Enter]');

        const apple = screen.getByRole('menuitem', { name: 'Apple' });
        const banana = screen.getByRole('menuitem', { name: 'Banana' });
        const cherry = screen.getByRole('menuitem', { name: 'Cherry' });

        await waitFor(() => {
          expect(apple).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(banana).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(cherry).toHaveFocus();
        });

        await act(async () => {
          apple.focus();
        });
        await user.keyboard('c');
        await waitFor(() => {
          expect(cherry).toHaveFocus();
        });
      });

      it('closes with a `detail === 0` click event on keyboard item activation', async () => {
        const openChangeSpy = vi.fn();

        render(() => <TestMenu rootProps={{ onOpenChange: openChangeSpy }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('[Enter]');

        await waitFor(() => {
          expect(openChangeSpy.mock.lastCall?.[0]).to.equal(false);
        });

        expect(openChangeSpy.mock.lastCall?.[1].reason).to.equal(REASONS.itemPress);
        // Keyboard activation clicks carry `detail === 0`, which MenuRoot classifies
        // as a keyboard (instant) activation.
        expect((openChangeSpy.mock.lastCall?.[1].event as MouseEvent).detail).to.equal(0);
      });

      it('changes the highlighted item using the Home and End keys', async () => {
        render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.keyboard('[Enter]');
        const item1 = screen.getByTestId('item-1');
        const item5 = screen.getByTestId('item-5');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{End}');
        await waitFor(() => {
          expect(item5).toHaveFocus();
        });

        await userEvent.keyboard('{Home}');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });
      });

      it('includes disabled items during keyboard navigation', async () => {
        render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const disabledItem3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(disabledItem3).toHaveFocus();
        });

        expect(disabledItem3).to.have.attribute('aria-disabled', 'true');
      });

      it.skipIf(isJSDOM)('skips items hidden with CSS during keyboard navigation', async () => {
        render(() => (
          <TestMenu
            popupProps={{
              get children() {
                return (
                  <>
                    <Menu.Item data-testid="item-1" style={{ display: 'none' }}>
                      Item 1
                    </Menu.Item>
                    <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                    <Menu.Item data-testid="item-3">Item 3</Menu.Item>
                  </>
                );
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const hiddenItem = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
        expect(hiddenItem).to.have.attribute('tabindex', '-1');

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      describe('text navigation', () => {
        it('changes the highlighted item', async ({ skip }) => {
          if (isJSDOM) {
            // useMenuPopup Text navigation match menu items using HTMLElement.innerText
            // innerText is not supported by JSDOM
            skip();
          }

          const { user } = render(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>Ba</Menu.Item>,
                    <Menu.Item>Bb</Menu.Item>,
                    <Menu.Item>Ca</Menu.Item>,
                    <Menu.Item>Cb</Menu.Item>,
                    <Menu.Item>Cd</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const items = screen.getAllByRole('menuitem');

          items[0].focus();

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Ca')).toHaveFocus();
          });

          expect(screen.getByText('Ca')).to.have.attribute('tabindex', '0');

          await user.keyboard('d');
          await waitFor(() => {
            expect(screen.getByText('Cd')).toHaveFocus();
          });

          expect(screen.getByText('Cd')).to.have.attribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)('skips items hidden with CSS in text navigation', async () => {
          const { user } = render(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item data-testid="item-hidden" style={{ display: 'none' }}>
                      Apple
                    </Menu.Item>,
                    <Menu.Item data-testid="item-apricot">Apricot</Menu.Item>,
                    <Menu.Item data-testid="item-banana">Banana</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const hiddenItem = screen.getByTestId('item-hidden');
          const apricotItem = screen.getByTestId('item-apricot');
          const bananaItem = screen.getByTestId('item-banana');

          await act(async () => {
            bananaItem.focus();
          });

          await user.keyboard('a');
          await waitFor(() => {
            expect(apricotItem).toHaveFocus();
          });

          expect(hiddenItem).to.have.attribute('tabindex', '-1');
        });

        it.skipIf(isJSDOM)('skips natively disabled items in text navigation', async () => {
          const { user } = render(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Apple</Menu.Item>,
                    <Menu.Item
                      data-testid="item-banana"
                      nativeButton
                      render={(props) => <button {...props} type="button" disabled />}
                    >
                      Banana
                    </Menu.Item>,
                    <Menu.Item data-testid="item-blueberry">Blueberry</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const appleItem = screen.getByText('Apple');
          const bananaItem = screen.getByTestId('item-banana');
          const blueberryItem = screen.getByTestId('item-blueberry');

          await act(async () => {
            appleItem.focus();
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(blueberryItem).toHaveFocus();
          });

          expect(bananaItem).to.have.attribute('tabindex', '-1');
          expect(bananaItem).not.to.have.attribute('data-highlighted');
        });

        it('changes the highlighted item using text navigation on label prop', async ({ skip }) => {
          if (!isJSDOM) {
            // This test is very flaky in real browsers
            skip();
          }

          const { user } = render(() => (
            <TestMenu
              popupProps={{
                get children() {
                  return (
                    <>
                      <Menu.Item label="Aa">1</Menu.Item>
                      <Menu.Item label="Ba">2</Menu.Item>
                      <Menu.Item label="Bb">3</Menu.Item>
                      <Menu.Item label="Ca">4</Menu.Item>
                    </>
                  );
                },
              }}
            />
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          await user.click(trigger);
          const items = screen.getAllByRole('menuitem');
          await flushMicrotasks();

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[1]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[1]).to.have.attribute('tabindex', '0');
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[2]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[2]).to.have.attribute('tabindex', '0');
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[2]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[2]).to.have.attribute('tabindex', '0');
          });
        });

        it('skips the non-stringifiable items', async ({ skip }) => {
          if (isJSDOM) {
            // useMenuPopup Text navigation match menu items using HTMLElement.innerText
            // innerText is not supported by JSDOM
            skip();
          }

          const { user } = render(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>Ba</Menu.Item>,
                    <Menu.Item />,
                    <Menu.Item>
                      <div>Nested Content</div>
                    </Menu.Item>,
                    <Menu.Item>{undefined}</Menu.Item>,
                    <Menu.Item>{null}</Menu.Item>,
                    <Menu.Item>Bc</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const items = screen.getAllByRole('menuitem');

          items[0].focus();

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).to.have.attribute('tabindex', '0');

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Bc')).toHaveFocus();
          });
          expect(screen.getByText('Bc')).to.have.attribute('tabindex', '0');
        });

        it('navigate to options with diacritic characters', async ({ skip }) => {
          if (isJSDOM) {
            // useMenuPopup Text navigation match menu items using HTMLElement.innerText
            // innerText is not supported by JSDOM
            skip();
          }

          const { user } = render(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>Ba</Menu.Item>,
                    <Menu.Item>Bb</Menu.Item>,
                    <Menu.Item>Bą</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const items = screen.getAllByRole('menuitem');

          items[0].focus();

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).to.have.attribute('tabindex', '0');

          await user.keyboard('ą');
          await waitFor(() => {
            expect(screen.getByText('Bą')).toHaveFocus();
          });
          expect(screen.getByText('Bą')).to.have.attribute('tabindex', '0');
        });

        it('navigate to next options that begin with diacritic characters', async ({ skip }) => {
          if (isJSDOM) {
            // useMenuPopup Text navigation match menu items using HTMLElement.innerText
            // innerText is not supported by JSDOM
            skip();
          }

          const { user } = render(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>ąa</Menu.Item>,
                    <Menu.Item>ąb</Menu.Item>,
                    <Menu.Item>ąc</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const items = screen.getAllByRole('menuitem');

          items[0].focus();

          await user.keyboard('ą');
          await waitFor(() => {
            expect(screen.getByText('ąa')).toHaveFocus();
          });
          expect(screen.getByText('ąa')).to.have.attribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)(
          'does not trigger the onClick event when Space is pressed during text navigation',
          async () => {
            const handleClick = spy();

            const { user } = render(() => (
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  get children() {
                    return [
                      <Menu.Item onClick={() => handleClick()}>Item One</Menu.Item>,
                      <Menu.Item onClick={() => handleClick()}>Item Two</Menu.Item>,
                      <Menu.Item onClick={() => handleClick()}>Item Three</Menu.Item>,
                    ];
                  },
                }}
              />
            ));

            const items = screen.getAllByRole('menuitem');

            items[0].focus();

            await user.keyboard('Item T');

            expect(handleClick.called).to.equal(false);

            await waitFor(() => {
              expect(items[1]).toHaveFocus();
            });
          },
        );

        it.skipIf(isJSDOM)(
          'does not open a submenu when pressing Space during a typeahead session',
          async () => {
            const { user } = render(() => (
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  get children() {
                    return (
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger data-testid="submenu-trigger">
                          Add to Playlist
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup data-testid="submenu">
                              <Menu.Item>Add now</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    );
                  },
                }}
              />
            ));

            const submenuTrigger = screen.getByTestId('submenu-trigger');

            await act(async () => {
              submenuTrigger.focus();
            });

            await user.keyboard('Add to p');

            await waitFor(() => {
              expect(submenuTrigger).toHaveFocus();
            });

            await user.keyboard('[Space]');
            expect(screen.queryByTestId('submenu')).to.equal(null);

            await user.keyboard('[Space]');
            expect(screen.queryByTestId('submenu')).to.equal(null);
          },
        );

        it('opens a focused submenu trigger with Space when not typing', async () => {
          const { user } = render(() => <TestMenu rootProps={{ open: true }} />);

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            submenuTrigger.focus();
          });

          await user.keyboard('[Space]');
          expect(screen.queryByTestId('submenu')).not.to.equal(null);
        });

        it.skipIf(isJSDOM)(
          'matches "Item 2" after "Item " currently matches "Item 1"',
          async () => {
            const { user } = render(() => (
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  get children() {
                    return (
                      <>
                        <Menu.Item>Item 1</Menu.Item>
                        <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                        <Menu.Item>Item 3</Menu.Item>
                      </>
                    );
                  },
                }}
              />
            ));

            const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
            const item2 = screen.getByTestId('item-2');

            await act(async () => {
              item1.focus();
            });

            await user.keyboard('Item 2');
            expect(item2).toHaveFocus();
          },
        );

        it.skipIf(isJSDOM)(
          'matches a submenu trigger label after a space + numeric suffix',
          async () => {
            const { user } = render(() => (
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  get children() {
                    return (
                      <>
                        <Menu.Item>Item 1</Menu.Item>
                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger data-testid="submenu-trigger">
                            Item 2
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup data-testid="submenu">
                                <Menu.Item>Nested 2.1</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                        <Menu.Item>Item 3</Menu.Item>
                      </>
                    );
                  },
                }}
              />
            ));

            const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
            const submenuTrigger = screen.getByTestId('submenu-trigger');

            await act(async () => {
              item1.focus();
            });

            await user.keyboard('Item 2');
            expect(submenuTrigger).toHaveFocus();
            expect(screen.queryByTestId('submenu')).to.equal(null);
          },
        );
      });
    });

    describe('nested menus', () => {
      (
        [
          ['vertical', 'ltr', 'ArrowRight', 'ArrowLeft'],
          ['vertical', 'rtl', 'ArrowLeft', 'ArrowRight'],
          ['horizontal', 'ltr', 'ArrowDown', 'ArrowUp'],
          ['horizontal', 'rtl', 'ArrowDown', 'ArrowUp'],
        ] as const
      ).forEach(([orientation, direction, openKey, closeKey]) => {
        it.skipIf(isJSDOM)(
          `opens a nested menu of a ${orientation} ${direction.toUpperCase()} menu with ${openKey} key and closes it with ${closeKey}`,

          async () => {
            const { user } = render(() => (
              <DirectionProvider direction={direction}>
                <TestMenu rootProps={{ open: true, orientation }} submenuProps={{ orientation }} />
              </DirectionProvider>
            ));

            const submenuTrigger = screen.getByTestId('submenu-trigger');

            submenuTrigger.focus();

            // This check fails in JSDOM
            await waitFor(() => {
              expect(submenuTrigger).toHaveFocus();
            });

            await user.keyboard(`[${openKey}]`);

            let submenu: HTMLElement | null = await screen.findByTestId('submenu');

            const submenuItem1 = screen.queryByTestId('item-4_1');
            expect(submenuItem1).not.to.equal(null);
            await waitFor(() => {
              expect(submenuItem1).toHaveFocus();
            });

            await user.keyboard(`[${closeKey}]`);

            submenu = screen.queryByTestId('submenu');
            expect(submenu).to.equal(null);

            expect(submenuTrigger).toHaveFocus();
          },
        );
      });

      it('opens submenu on click when openOnHover is false', async () => {
        const { user } = render(() => <TestMenu submenuTriggerProps={{ openOnHover: false }} />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).to.equal(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        expect(menu).not.to.equal(null);
        expect(await screen.findByTestId('item-4_1')).to.have.text('Item 4.1');
      });

      it('renders root menu portal ownership without an accessibility role', async () => {
        const { user } = render(() => <TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        const menuPortal = menu.closest('[data-base-ui-portal]');
        const menuPortalId = menuPortal?.id ?? '';
        const owner = menu.ownerDocument.querySelector('span[aria-owns]');

        expect(menuPortalId).not.to.equal('');
        expect(owner).to.have.attribute('aria-owns', menuPortalId);
        expect(owner).not.to.have.attribute('role');
      });

      it('renders submenu portal ownership as an allowed menu child', async () => {
        const { user } = render(() => <TestMenu submenuTriggerProps={{ openOnHover: false }} />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        const submenu = await screen.findByTestId('submenu');
        const submenuPortal = submenu.closest('[data-base-ui-portal]');
        const submenuPortalId = submenuPortal?.id ?? '';
        const owner = menu.querySelector('span[aria-owns]');

        expect(submenuPortalId).not.to.equal('');
        expect(owner).to.have.attribute('role', 'group');
        expect(owner).to.have.attribute('aria-owns', submenuPortalId);
        expect(submenuTrigger).not.to.have.attribute('aria-owns');
      });

      it('keeps the root menu open when a submenu opens and the trigger `render` element has a custom id', async () => {
        const onOpenChange = vi.fn();
        const { user } = render(() => (
          <TestMenu
            rootProps={{ onOpenChange }}
            triggerProps={{ render: (props) => <button {...props} id="custom-trigger" /> }}
            submenuTriggerProps={{ openOnHover: false }}
          />
        ));

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        await screen.findByTestId('menu');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        await screen.findByTestId('submenu');

        expect(screen.getByTestId('menu')).not.to.equal(null);
        expect(onOpenChange).not.toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.siblingOpen }),
        );
      });

      it('closes submenus when focus is lost by shift-tabbing from a nested menu', async () => {
        const { user } = render(() => <TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).to.equal(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.to.equal(null);
        });

        const submenuItem = await screen.findByTestId('item-4_1');

        submenuItem.focus();

        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });

        // Shift+Tab should close the submenu and focus should return to the submenu trigger
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).to.equal(null);
        });

        expect(submenuTrigger).toHaveFocus();
      });

      it('closes the entire tree when clicking outside the deepest submenu', async () => {
        const { user } = render(() => (
          <div>
            <TestMenu />
            <button data-testid="outside">Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger1 = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger1).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('submenu');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger2 = await screen.findByTestId('nested-submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger2).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('nested-submenu');

        const outside = screen.getByTestId('outside');
        await user.click(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('level-1')).to.equal(null);
          expect(screen.queryByTestId('level-2')).to.equal(null);
          expect(screen.queryByTestId('level-3')).to.equal(null);
        });
      });

      it.skipIf(isJSDOM)(
        'calls onOpenChange with false exactly once per menu when a submenu item is clicked',
        async () => {
          const rootOnOpenChange = vi.fn();
          const submenuOnOpenChange = vi.fn();

          const { user } = render(() => (
            <TestMenu
              rootProps={{ onOpenChange: rootOnOpenChange }}
              submenuProps={{ onOpenChange: submenuOnOpenChange }}
              submenuTriggerProps={{ delay: 0, closeDelay: 50 }}
            />
          ));

          await user.click(screen.getByRole('button', { name: 'Toggle' }));
          await screen.findByTestId('menu');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await user.hover(submenuTrigger);

          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).not.to.equal(null);
          });

          // Schedule a delayed hover close, then click the item before it fires.
          fireEvent.mouseLeave(submenuTrigger);
          fireEvent.click(screen.getByTestId('item-4_1'));

          await waitFor(() => {
            expect(screen.queryByTestId('menu')).to.equal(null);
          });

          // Wait out pending hover close timers; they must not refire a close.
          await wait(100);

          const rootCloseCalls = rootOnOpenChange.mock.calls.filter((args) => args[0] === false);
          const submenuCloseCalls = submenuOnOpenChange.mock.calls.filter(
            (args) => args[0] === false,
          );
          const staleHoverCloseCalls = submenuCloseCalls.filter(
            (args) => args[1].reason === REASONS.triggerHover,
          );
          expect(rootCloseCalls.length).to.equal(1);
          expect(submenuCloseCalls.length).to.equal(1);
          expect(staleHoverCloseCalls.length).to.equal(0);
        },
      );

      it.skipIf(isJSDOM)(
        'returns focus to submenu triggers when closing nested menus',
        async () => {
          const { user } = render(() => <TestMenu />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          await user.click(trigger);

          await screen.findByTestId('menu');

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');

          const nestedSubmenuTrigger = await screen.findByTestId('nested-submenu-trigger');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          await waitFor(() => {
            expect(nestedSubmenuTrigger).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('nested-submenu');

          await user.keyboard('[ArrowLeft]');

          await waitFor(() => {
            expect(screen.queryByTestId('nested-submenu')).to.equal(null);
          });
          expect(nestedSubmenuTrigger).toHaveFocus();

          await user.keyboard('[ArrowLeft]');

          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).to.equal(null);
          });
          expect(submenuTrigger).toHaveFocus();
        },
      );
    });

    describe('controlled open', () => {
      it('returns focus to the opener when a menu is opened programmatically', async () => {
        function Test() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                Open menu programmatically
              </button>
              <Menu.Root open={open()} triggerId="menu-trigger" onOpenChange={setOpen}>
                <Menu.Trigger id="menu-trigger">Menu trigger</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Close menu</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </>
          );
        }

        const { user } = render(() => <Test />);

        const opener = screen.getByRole('button', { name: 'Open menu programmatically' });
        await user.click(opener);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        await user.click(screen.getByRole('menuitem', { name: 'Close menu' }));

        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });
        expect(opener).toHaveFocus();
      });
    });

    describe('nested popups', () => {
      it('keeps the menu and dialog open when pressing Shift+Tab inside a nested dialog', async () => {
        function MenuWithNestedDialog() {
          return (
            <Menu.Root>
              <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="menu-popup">
                    <Menu.Item>Item 1</Menu.Item>
                    <Dialog.Root>
                      <Menu.Item
                        render={{ component: Dialog.Trigger }}
                        closeOnClick={false}
                        nativeButton
                        data-testid="dialog-trigger"
                      >
                        Open Dialog
                      </Menu.Item>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="dialog-popup">
                          <button type="button" data-testid="dialog-button">
                            Dialog Button
                          </button>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                    <Menu.Item>Item 2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        }

        const { user } = render(() => <MenuWithNestedDialog />);

        const menuTrigger = screen.getByTestId('menu-trigger');
        await user.click(menuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('menu-popup')).not.to.equal(null);
        });

        const dialogTrigger = screen.getByTestId('dialog-trigger');
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).not.to.equal(null);
        });

        const dialogButton = screen.getByTestId('dialog-button');

        dialogButton.focus();

        await waitFor(() => {
          expect(dialogButton).toHaveFocus();
        });

        // Shift+Tab inside the dialog should NOT close the menu or the dialog
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        // Both menu and dialog should still be open
        await waitFor(() => {
          expect(screen.queryByTestId('menu-popup')).not.to.equal(null);
          expect(screen.queryByTestId('dialog-popup')).not.to.equal(null);
        });
      });

      it.skipIf(isJSDOM)(
        'keeps focus in a nested alert dialog popup when the pointer leaves the triggering menu item',
        async () => {
          function MenuWithNestedAlertDialog() {
            return (
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="menu-popup">
                      <Menu.Item>Item 1</Menu.Item>
                      <AlertDialog.Root>
                        <Menu.Item
                          render={{ component: AlertDialog.Trigger }}
                          closeOnClick={false}
                          nativeButton
                          data-testid="alert-dialog-trigger"
                        >
                          Open Alert Dialog
                        </Menu.Item>
                        <AlertDialog.Portal>
                          <AlertDialog.Backdrop data-testid="alert-dialog-backdrop" />
                          <AlertDialog.Popup data-testid="alert-dialog-popup">
                            <AlertDialog.Close data-testid="alert-dialog-close">
                              Close
                            </AlertDialog.Close>
                          </AlertDialog.Popup>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                      <Menu.Item>Item 2</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            );
          }

          const { user } = render(() => <MenuWithNestedAlertDialog />);

          await user.click(screen.getByTestId('menu-trigger'));

          const alertDialogTrigger = await screen.findByTestId('alert-dialog-trigger');
          await user.click(alertDialogTrigger);

          const menuPopup = screen.getByTestId('menu-popup');
          const alertDialogPopup = await screen.findByTestId('alert-dialog-popup');

          await waitFor(() => {
            expect(alertDialogPopup.contains(document.activeElement)).to.equal(true);
          });

          fireEvent.pointerLeave(alertDialogTrigger, {
            pointerType: 'mouse',
            relatedTarget: document.body,
          });

          await waitFor(() => {
            expect(alertDialogPopup.contains(document.activeElement)).to.equal(true);
          });
          expect(menuPopup.contains(document.activeElement)).to.equal(false);
        },
      );

      it.skipIf(isJSDOM)(
        'keeps pending focus in a nested dialog when the pointer leaves the triggering menu item',
        async () => {
          function MenuWithNestedDialog() {
            return (
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="menu-popup">
                      <Menu.Item>Item 1</Menu.Item>
                      <Dialog.Root>
                        <Menu.Item
                          render={(props) => (
                            <Dialog.Trigger {...props} render="div" nativeButton={false} />
                          )}
                          closeOnClick={false}
                          data-testid="dialog-trigger"
                        >
                          Open Dialog
                        </Menu.Item>
                        <Dialog.Portal>
                          <Dialog.Popup data-testid="dialog-popup">
                            <Dialog.Close data-testid="dialog-close">Close</Dialog.Close>
                          </Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                      <Menu.Item>Item 2</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            );
          }

          const { user } = render(() => <MenuWithNestedDialog />);

          await user.click(screen.getByTestId('menu-trigger'));

          const frameCallbacks = new Map<number, FrameRequestCallback>();
          let frameId = 0;
          const requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback) => {
              frameId += 1;
              frameCallbacks.set(frameId, callback);
              return frameId;
            });
          const cancelAnimationFrameSpy = vi
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation((id) => {
              frameCallbacks.delete(id);
            });

          try {
            const dialogTrigger = await screen.findByTestId('dialog-trigger');
            fireEvent.click(dialogTrigger);
            await flushMicrotasks();
            fireEvent.pointerLeave(dialogTrigger, {
              pointerType: 'mouse',
              relatedTarget: document.body,
            });

            const dialogClose = await screen.findByTestId('dialog-close');

            await waitFor(() => {
              expect(frameCallbacks.size).to.be.greaterThan(0);
            });

            await act(() => {
              const callbacks = Array.from(frameCallbacks.values());
              frameCallbacks.clear();
              callbacks.forEach((callback) => callback(performance.now()));
            });

            await waitFor(() => {
              expect(dialogClose).toHaveFocus();
            });

            expect(screen.getByTestId('menu-popup').contains(document.activeElement)).to.equal(
              false,
            );
          } finally {
            requestAnimationFrameSpy.mockRestore();
            cancelAnimationFrameSpy.mockRestore();
          }
        },
      );
    });

    describe('focus management', () => {
      it('focuses the first item after the menu is opened by keyboard', async () => {
        render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.keyboard('[Enter]');

        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        await waitFor(() => {
          expect(firstItem.tabIndex).to.equal(0);
        });
        otherItems.forEach((item) => {
          expect(item.tabIndex).to.equal(-1);
        });
      });

      it('focuses the first item when down arrow key opens the menu', async () => {
        const { user } = render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await user.keyboard('[ArrowDown]');

        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        await waitFor(() => expect(firstItem).toHaveFocus());
        expect(firstItem.tabIndex).to.equal(0);
        otherItems.forEach((item) => {
          expect(item.tabIndex).to.equal(-1);
        });
      });

      it('focuses the last item when up arrow key opens the menu', async () => {
        const { user } = render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await user.keyboard('[ArrowUp]');

        const items = screen.getAllByRole('menuitem');
        await waitFor(() => {
          expect(items[4]).toHaveFocus();
        });

        expect(items[4].tabIndex).to.equal(0);
        [items[0], items[1], items[2], items[3]].forEach((item) => {
          expect(item.tabIndex).to.equal(-1);
        });
      });

      it('focuses the trigger after the menu is closed', async () => {
        const { user } = render(() => (
          <div>
            <input type="text" />
            <TestMenu />
            <input type="text" />
          </div>
        ));

        const button = screen.getByRole('button', { name: 'Toggle' });
        await user.click(button);

        const menuItem = await screen.findAllByRole('menuitem');
        await user.click(menuItem[0]);

        expect(button).toHaveFocus();
      });

      it.skipIf(isJSDOM)(
        'focuses the trigger after Escape when the closing menu receives mouseleave',
        async () => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

          const { user } = render(() => (
            <>
              <style>
                {`
                  .transition-test-indicator {
                    transition:
                      transform 100ms ease-out,
                      opacity 100ms ease-out;
                  }

                  .transition-test-indicator[data-ending-style] {
                    opacity: 0;
                    transform: scale(0.98);
                  }
                `}
              </style>
              <TestMenu popupProps={{ class: 'transition-test-indicator' }} />
            </>
          ));

          const button = screen.getByRole('button', { name: 'Toggle' });
          await user.click(button);

          const firstItem = await screen.findByTestId('item-1');
          await user.hover(firstItem);

          await waitFor(() => {
            expect(firstItem).toHaveFocus();
          });

          await user.keyboard('[Escape]');

          // During an exit transition, the positioner can receive a mouseleave after Escape
          // when pointer-events change while the pointer rests over the popup.
          fireEvent.mouseLeave(screen.getByTestId('menu-positioner'), {
            relatedTarget: document.body,
          });

          await waitFor(() => {
            expect(screen.queryByRole('menu')).to.equal(null);
          });
          expect(button).toHaveFocus();
        },
      );

      it('focuses the trigger after the menu is closed but not unmounted', async ({ skip }) => {
        if (isJSDOM) {
          // TODO: this stopped working in vitest JSDOM mode
          skip();
        }

        const { user } = render(() => (
          <div>
            <input type="text" />
            <TestMenu portalProps={{ keepMounted: true }} />
            <input type="text" />
          </div>
        ));

        const button = screen.getByRole('button', { name: 'Toggle' });
        await user.click(button);

        const menuItem = await screen.findAllByRole('menuitem');
        await user.click(menuItem[0]);

        await waitFor(() => {
          expect(button).toHaveFocus();
        });
      });
    });

    describe('focus guards', () => {
      it('closes the menu and moves focus to the next element when tabbing forward from the open menu', async () => {
        const { user } = render(() => (
          <div>
            <input />
            <TestMenu rootProps={{ modal: false }} />
            <input data-testid="after" />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        const menuItem = screen.getByTestId('item-1');
        await act(async () => {
          menuItem.focus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).to.equal(null);
        });
      });

      it('closes the menu and moves focus to the trigger when shift-tabbing from the open menu', async () => {
        const { user } = render(() => (
          <div>
            <input data-testid="before" />
            <TestMenu />
            <input />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        const menuItem = screen.getByTestId('item-1');
        await act(async () => {
          menuItem.focus();
        });

        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).to.equal(null);
        });
      });
    });

    describe('prop: closeParentOnEsc', () => {
      it('does not close the parent menu when the Escape key is pressed by default', async () => {
        const { user } = render(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await user.keyboard('[ArrowDown]');
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

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await user.keyboard('[Escape]');

        const menus = screen.queryAllByRole('menu', { hidden: false });
        await waitFor(() => {
          expect(menus.length).to.equal(1);
        });

        expect(menus[0].dataset.testid).to.equal('menu');
      });

      it('closes the parent menu when the Escape key is pressed  if `closeParentOnEsc=true`', async () => {
        const { user } = render(() => <TestMenu submenuProps={{ closeParentOnEsc: true }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await user.keyboard('[ArrowDown]');
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

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Item 4.1' })).toHaveFocus();
        });

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('menu', { hidden: false })).to.equal(null);
      });
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = render(() => (
          <div>
            <TestMenu rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).to.have.attribute('role', 'presentation');
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = render(() => (
          <div>
            <TestMenu rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).to.equal(null);
      });
    });

    describe('hover close', () => {
      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        render(() => <TestMenu rootProps={{ defaultOpen: true }} />);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).not.to.equal(null);
      });
    });

    describe('controlled open interactions', () => {
      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestMenu
                rootProps={{
                  get open() {
                    return open();
                  },
                  onOpenChange: setOpen,
                }}
              />
            </>
          );
        }

        const { user } = render(() => <App />);

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestMenu
              rootProps={{
                get open() {
                  return open();
                },
                onOpenChange: setOpen,
                modal: false,
              }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />
          );
        }

        render(() => <App />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        expect(screen.queryByRole('menu')).not.to.equal(null);

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).to.equal(null);
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      describe('interaction type tracking (openMethod)', () => {
        it('should not apply scroll lock when opened via touch', async () => {
          render(() => <TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

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

        it('should apply scroll lock when opened via mouse', async () => {
          const { user } = render(() => <TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          const doc = trigger.ownerDocument;

          await user.click(trigger);
          await screen.findByRole('menu');

          // Solid: unlike React's async wrapper, `findBy*` does not drain a macrotask, so the
          // timeout-deferred scroll lock is awaited.
          await waitFor(() => {
            const isScrollLocked =
              doc.documentElement.style.overflow === 'hidden' ||
              doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
              doc.body.style.overflow === 'hidden';

            expect(isScrollLocked).to.equal(true);
          });
        });
      });

      describe('touch scroll lock', () => {
        it('should apply scroll lock when a touch-opened popup covers the viewport width', async () => {
          render(() => (
            <Menu.Root modal>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ));

          const trigger = screen.getByRole('button', { name: 'Open' });

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

        it('should not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
          render(() => (
            <Menu.Root modal>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ));

          const trigger = screen.getByRole('button', { name: 'Open' });

          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);

          const menu = await screen.findByRole('menu');
          const doc = menu.ownerDocument;

          await act(async () => {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          });

          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).to.equal(false);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the menu when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            close: spy(),
            unmount: spy(),
          },
        };

        const { user } = render(() => (
          <TestMenu
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });

        actionsRef.current.unmount();

        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      it('is called on close when there is no exit animation defined', async () => {
        const onOpenChangeComplete = spy();

        function Test() {
          const [open, setOpen] = createSignal(true);
          return (
            <div>
              <button onClick={() => setOpen(false)}>Close</button>
              <TestMenu rootProps={{ onOpenChangeComplete, open: open() }} />
            </div>
          );
        }

        const { user } = render(() => <Test />);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).to.equal(null);
        });

        expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
        expect(onOpenChangeComplete.lastCall.args[0]).to.equal(false);
      });

      it('is called on close when the exit animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = spy();

        function Test() {
          const style = `
          @keyframes test-anim {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = createSignal(true);

          return (
            <div>
              {/* eslint-disable-next-line solid/no-innerhtml */}
              <style innerHTML={style} />
              <button onClick={() => setOpen(false)}>Close</button>
              <TestMenu
                rootProps={{ onOpenChangeComplete, open: open() }}
                popupProps={{ class: 'animation-test-indicator' }}
              />
            </div>
          );
        }

        const { user } = render(() => <Test />);

        expect(screen.getByTestId('menu')).not.to.equal(null);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
        });

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).to.equal(null);
        });

        expect(onOpenChangeComplete.lastCall.args[0]).to.equal(false);
      });

      it('is called on open when there is no enter animation defined', async () => {
        const onOpenChangeComplete = spy();

        function Test() {
          const [open, setOpen] = createSignal(false);
          return (
            <div>
              <button onClick={() => setOpen(true)}>Open</button>
              <TestMenu rootProps={{ onOpenChangeComplete, open: open() }} />
            </div>
          );
        }

        const { user } = render(() => <Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).not.to.equal(null);
        });

        expect(onOpenChangeComplete.callCount).to.equal(1);
        expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
      });

      it('is called on open when the enter animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = spy();

        function Test() {
          const style = `
          @keyframes test-anim {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-starting-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = createSignal(false);

          return (
            <div>
              {/* eslint-disable-next-line solid/no-innerhtml */}
              <style innerHTML={style} />
              <button onClick={() => setOpen(true)}>Open</button>
              <TestMenu
                rootProps={{ onOpenChange: setOpen, onOpenChangeComplete, open: open() }}
                popupProps={{ class: 'animation-test-indicator' }}
              />
            </div>
          );
        }

        const { user } = render(() => <Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
        });

        expect(screen.queryByTestId('menu')).not.to.equal(null);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = spy();

        render(() => <TestMenu rootProps={{ onOpenChangeComplete }} />);

        expect(onOpenChangeComplete.callCount).to.equal(0);
      });
    });

    describe('prop: openOnHover', () => {
      it('should open the menu when the trigger is hovered', async () => {
        render(() => <TestMenu triggerProps={{ delay: 0, openOnHover: true }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });
      });

      it('should close the menu when the trigger is no longer hovered', async () => {
        render(() => (
          <TestMenu rootProps={{ modal: false }} triggerProps={{ delay: 0, openOnHover: true }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        await userEvent.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });
      });

      it('opens the submenu on hover with zero delay', async () => {
        render(() => (
          <ContainedTriggerMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0 }}
          />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.to.equal(null);
        });
      });

      it('does not clear body pointer-events styles when closing a scoped submenu', async () => {
        render(() => (
          <TestMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0, closeDelay: 0 }}
          />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.to.equal(null);
        });

        const previousBodyPointerEvents = document.body.style.pointerEvents;
        try {
          document.body.style.pointerEvents = 'none';

          const sibling = screen.getByTestId('item-2');
          // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
          fireEvent.mouseMove(sibling);

          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).to.equal(null);
          });

          expect(document.body.style.pointerEvents).to.equal('none');
        } finally {
          document.body.style.pointerEvents = previousBodyPointerEvents;
        }
      });

      it('scopes submenu safePolygon pointer events to the parent menu with keepMounted portal', async () => {
        render(() => (
          <TestMenu
            rootProps={{ defaultOpen: true }}
            popupProps={{
              get children() {
                return (
                  <>
                    <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger" delay={0}>
                        Item 2
                      </Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner data-testid="submenu-positioner">
                          <Menu.Popup data-testid="submenu">
                            <Menu.Item>Item 2.1</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                    <Menu.Item data-testid="item-3">Item 3</Menu.Item>
                  </>
                );
              },
            }}
          />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.to.equal(null);
        });

        const menu = screen.getByTestId('menu');
        const submenuPositioner = screen.getByTestId('submenu-positioner');

        expect(menu.style.pointerEvents).to.equal('none');
        expect(submenuPositioner.style.pointerEvents).to.equal('auto');
        expect(screen.getByTestId('item-3').style.pointerEvents).to.equal('');
      });

      it('should not close when submenu is hovered after root menu is hovered', async () => {
        render(() => (
          <TestMenu
            triggerProps={{ delay: 0, openOnHover: true }}
            submenuTriggerProps={{ delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.to.equal(null);
        });

        const menu = screen.getByTestId('menu');

        await userEvent.hover(menu);

        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.to.equal(null);
        });

        const submenu = screen.getByTestId('submenu');

        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        fireEvent.mouseMove(menu);
        fireEvent.mouseLeave(menu);
        await userEvent.hover(submenu);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.to.equal(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.to.equal(null);
        });
      });

      it('keeps the parent submenu open after a third-level submenu closes due to sibling hover', async () => {
        render(() => (
          <ContainedTriggerMenu
            triggerProps={{ delay: 0, openOnHover: true }}
            submenuTriggerProps={{ delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.to.equal(null);
        });

        // Open first-level submenu
        const level1Trigger = screen.getByRole('menuitem', { name: 'Item 4' });
        await userEvent.hover(level1Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.to.equal(null);
        });

        // Open second-level submenu
        const level2Trigger = screen.getByRole('menuitem', { name: 'Item 4.3' });
        await userEvent.hover(level2Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('nested-submenu')).not.to.equal(null);
        });

        // Hover a sibling item in the parent submenu to close the second-level submenu
        const parentSibling = screen.getByRole('menuitem', { name: 'Item 4.2' });
        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        fireEvent.mouseMove(parentSibling);

        await waitFor(() => {
          expect(screen.queryByTestId('nested-submenu')).to.equal(null);
        });

        // Now unhover the parent submenu container; it should remain open
        const submenu1 = screen.getByTestId('submenu');
        fireEvent.mouseLeave(submenu1);

        // Parent submenu should still be open
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.to.equal(null);
        });
      });

      describe('modal behavior', () => {
        const { render: renderFakeTimers, clock } = createRenderer();

        clock.withFakeTimers();

        it('reopens on hover after an impatient click closes via item press', async () => {
          renderFakeTimers(() => <TestMenu triggerProps={{ openOnHover: true, delay: 100 }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          clock.tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.to.equal(null);

          clock.tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();

          fireEvent.click(screen.getByTestId('item-1'));

          await flushMicrotasks();

          expect(screen.queryByRole('menu')).to.equal(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          clock.tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        it('treats hover-opened menus as modal after a click', async () => {
          renderFakeTimers(() => (
            <Menu.Root>
              <Menu.Trigger openOnHover delay={0}>
                Toggle
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('menu')).not.to.equal(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).to.equal(null);

          clock.tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();
          expect(positioner.previousElementSibling).to.have.attribute('role', 'presentation');
        });
      });
    });

    describe('prop: closeDelay', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should close after delay', async () => {
        renderFakeTimers(() => (
          <TestMenu triggerProps={{ closeDelay: 100, delay: 0, openOnHover: true }} />
        ));

        const anchor = screen.getByRole('button');

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Item 1')).not.to.equal(null);

        fireEvent.mouseLeave(anchor);

        clock.tick(50);

        expect(screen.getByText('Item 1')).not.to.equal(null);

        clock.tick(50);

        expect(screen.queryByText('Item 1')).to.equal(null);
      });

      it('should close submenu after delay when hovering a sibling item', async () => {
        renderFakeTimers(() => (
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />
        ));

        const trigger = screen.getByRole('button');

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.to.equal(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        fireEvent.mouseMove(siblingItem);

        // Submenu should still be open after partial delay
        clock.tick(50);
        expect(screen.queryByTestId('submenu')).not.to.equal(null);

        // Submenu should close after the full delay
        clock.tick(50);
        expect(screen.queryByTestId('submenu')).to.equal(null);
      });

      it('should not restart closeDelay on repeated mousemove over sibling items', async () => {
        renderFakeTimers(() => (
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />
        ));

        const trigger = screen.getByRole('button');

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.to.equal(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        fireEvent.mouseMove(siblingItem);

        // Wait 80ms (most of the delay), then move again over the sibling
        clock.tick(80);
        expect(screen.queryByTestId('submenu')).not.to.equal(null);

        // Move again - this should NOT restart the timer
        fireEvent.mouseMove(siblingItem);

        // After 20 more ms (100ms total from first move), the submenu should close
        clock.tick(20);
        expect(screen.queryByTestId('submenu')).to.equal(null);
      });
    });

    describe('submenu hover open', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('opens a submenu after a plain delay without waiting for the pointer to rest', async () => {
        // The menu is opened programmatically, so `allowMouseEnter` starts
        // `false`. Hovering the submenu trigger as the first item must still
        // open it after a plain delay rather than collapsing to a rest-only
        // path that requires the cursor to stop moving.
        renderFakeTimers(() => (
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });

        // Keep the pointer moving past the open delay so it never comes to rest.
        clock.tick(40);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        clock.tick(40);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        clock.tick(40);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.to.equal(null);
      });

      it('cancels a pending submenu hover-open when the pointer leaves via mouseout', async () => {
        // Chrome can drop a submenu trigger's non-bubbling `mouseleave` during a
        // fast pointer sweep across adjacent triggers, but the bubbling
        // `mouseout` still fires. The pending delayed open must be cancelled from
        // that `mouseout`, otherwise a stale submenu opens for a trigger the
        // pointer has already left (stranding the parent at
        // `pointer-events: none`). See #5152.
        renderFakeTimers(() => (
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        const otherItem = screen.getByTestId('item-1');

        // Arm the submenu's delayed open, then leave the trigger via `mouseout`
        // (with `relatedTarget` outside it) but without delivering `mouseleave`.
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseOut(submenuTrigger, { relatedTarget: otherItem });

        // Let the open delay elapse.
        clock.tick(200);
        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).to.equal(null);
      });

      it('keeps a pending submenu hover-open when mouseout stays within the trigger', async () => {
        // `mouseout` bubbles and fires as the pointer moves between elements
        // inside the trigger's own subtree. Those crossings (where
        // `relatedTarget` is still inside the trigger) must not cancel the
        // pending open, otherwise a plain hover would never open the submenu.
        // See #5152.
        renderFakeTimers(() => (
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        // Arm the submenu's delayed open, then fire a `mouseout` whose
        // `relatedTarget` is still inside the trigger (the trigger itself).
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseOut(submenuTrigger, { relatedTarget: submenuTrigger });

        // Let the open delay elapse.
        clock.tick(200);
        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.to.equal(null);
      });
    });

    describe.skipIf(isJSDOM)('mouse interaction', () => {
      afterEach(() => {
        cleanup();
      });

      it('triggers a menu item and closes the menu on click, drag, release', async () => {
        const openChangeSpy = spy();
        const clickSpy = spy();

        render(() => (
          <div>
            <TestMenu
              rootProps={{ onOpenChange: openChangeSpy }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item data-testid="item-1">1</Menu.Item>,
                    <Menu.Item data-testid="item-2" onClick={clickSpy}>
                      2
                    </Menu.Item>,
                    <Menu.Item data-testid="item-3">3</Menu.Item>,
                  ];
                },
              }}
            />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseDown(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).not.to.equal(null);
        });

        await wait(200);

        const item2 = screen.getByTestId('item-2');
        fireEvent.mouseUp(item2);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).to.equal(null);
        });

        expect(clickSpy.callCount).to.equal(1);

        expect(openChangeSpy.callCount).to.equal(2);
        expect(openChangeSpy.firstCall.args[0]).to.equal(true);
        expect(openChangeSpy.lastCall.args[0]).to.equal(false);
        expect(openChangeSpy.lastCall.args[1].reason).to.equal(REASONS.itemPress);
      });

      it('closes the menu on click, drag outside, release', async () => {
        const { userEvent: user } = await import('vitest/browser');

        const openChangeSpy = spy();

        render(() => (
          <div>
            <TestMenu
              rootProps={{ onOpenChange: openChangeSpy }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item data-testid="item-1">1</Menu.Item>,
                    <Menu.Item data-testid="item-2">2</Menu.Item>,
                    <Menu.Item data-testid="item-3">3</Menu.Item>,
                  ];
                },
              }}
            />
            <div data-testid="outside">Outside</div>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        const outsideElement = screen.getByTestId('outside');

        await user.dragAndDrop(trigger, outsideElement);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).to.equal(null);
        });

        expect(openChangeSpy.callCount).to.equal(2);
        expect(openChangeSpy.firstCall.args[0]).to.equal(true);
        expect(openChangeSpy.lastCall.args[0]).to.equal(false);
        expect(openChangeSpy.lastCall.args[1].reason).to.equal(REASONS.cancelOpen);
      });
    });

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
        render(() => (
          <TestMenu
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await userEvent.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });
      });

      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = render(() => (
          <TestMenu
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.to.have.attribute('data-popup-open');
        });
        expect(screen.queryByRole('menu')).not.to.equal(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).to.have.attribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });
      });
    });
  });

  it('does not leave a tabbable item after tabbing out of a keepMounted menu before close', async () => {
    const actionsRef = {
      current: {
        unmount: vi.fn(),
        close: vi.fn(),
      },
    };

    const { user } = render(() => (
      <div>
        <input />
        <DetachedTriggerMenu
          rootProps={{ modal: false, actionsRef }}
          portalProps={{ keepMounted: true }}
        />
        <input data-testid="after" />
      </div>
    ));

    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await act(async () => {
      trigger.focus();
    });
    await user.keyboard('[Enter]');

    const menuItem = await screen.findByTestId('item-1');
    await waitFor(() => {
      expect(menuItem).toHaveFocus();
    });
    expect(menuItem).to.have.attribute('tabindex', '0');

    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    await act(async () => {
      actionsRef.current.close();
    });

    await waitFor(() => {
      expect(screen.getByTestId('menu')).not.to.have.attribute('data-open');
    });
    expect(menuItem).to.have.attribute('tabindex', '-1');
  });

  describe.skipIf(isJSDOM || !isBlink)('opening a dialog from an item', () => {
    it('keeps the dialog open after a press-drag-release activation', async () => {
      const { cdp } = await import('vitest/browser');
      const dialogOpenChangeSpy = vi.fn();
      const documentClicks: MouseEvent[] = [];

      function App() {
        const [dialogOpen, setDialogOpen] = createSignal(false);

        return (
          <>
            <Menu.Root>
              <Menu.Trigger>Open menu</Menu.Trigger>
              {/* `keepMounted` keeps the released item connected, like a real
                  closing transition does: the browser only synthesizes the
                  gesture's click on the common ancestor when the release
                  target is still in the DOM. */}
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item onClick={() => setDialogOpen(true)}>Open dialog</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Dialog.Root
              open={dialogOpen()}
              onOpenChange={(nextOpen, eventDetails) => {
                dialogOpenChangeSpy(nextOpen, eventDetails.reason);
                setDialogOpen(nextOpen);
              }}
            >
              <Dialog.Portal>
                <Dialog.Backdrop style={{ position: 'fixed', inset: 0 }} />
                <Dialog.Popup data-testid="dialog-popup">Dialog</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      }

      render(() => <App />);

      const trigger = screen.getByRole('button', { name: 'Open menu' });
      const frame = window.frameElement as HTMLIFrameElement | null;
      const frameRect = frame?.getBoundingClientRect();
      const frameOffset = {
        x: (frameRect?.left ?? 0) + (frame?.clientLeft ?? 0),
        y: (frameRect?.top ?? 0) + (frame?.clientTop ?? 0),
      };

      function centerOf(element: Element) {
        const rect = element.getBoundingClientRect();
        return {
          x: frameOffset.x + rect.left + rect.width / 2,
          y: frameOffset.y + rect.top + rect.height / 2,
        };
      }

      const session = cdp() as CDPSession;

      function recordClick(event: MouseEvent) {
        documentClicks.push(event);
      }

      document.addEventListener('click', recordClick, true);

      try {
        const triggerCenter = centerOf(trigger);
        await act(async () => {
          await session.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            ...triggerCenter,
          });
          await session.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            ...triggerCenter,
            button: 'left',
            buttons: 1,
            clickCount: 1,
          });
        });

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.to.equal(null);
        });

        // Exceed the impatient-click threshold so releasing over the item
        // activates it instead of being treated as part of a quick click.
        await wait(200);

        const item = screen.getByRole('menuitem', { name: 'Open dialog' });
        const itemCenter = centerOf(item);
        await act(async () => {
          await session.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            ...itemCenter,
            buttons: 1,
          });
          await session.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            ...itemCenter,
            button: 'left',
            buttons: 0,
            clickCount: 1,
          });
        });

        // The item activates on release: the menu closes and the dialog opens.
        await waitFor(() => {
          expect(screen.queryByRole('menu')).to.equal(null);
        });
        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).not.to.equal(null);
        });

        // The browser fires the gesture's native click on the common ancestor
        // of the press and release targets after the dialog is open. It must
        // not be treated as an intentional outside press on the dialog.
        await waitFor(() => {
          expect(documentClicks.some((event) => event.isTrusted)).to.equal(true);
        });

        expect(screen.queryByTestId('dialog-popup')).not.to.equal(null);
        expect(dialogOpenChangeSpy).not.toHaveBeenCalledWith(false, REASONS.outsidePress);
      } finally {
        document.removeEventListener('click', recordClick, true);
      }
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseMove(item2);

      await waitFor(() => {
        expect(item2).toHaveFocus();
      });
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      render(() => (
        <Menu.Root open highlightItemOnHover={false}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseMove(item2);

      await flushMicrotasks();

      expect(item2).not.toHaveFocus();
    });

    it('does not highlight submenu triggers from mouse enter when disabled', async () => {
      render(() => (
        <TestMenuContents
          rootProps={{ open: true, highlightItemOnHover: false }}
          popupProps={{
            get children() {
              return (
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">Submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Nested item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              );
            },
          }}
        />
      ));

      const submenuTrigger = screen.getByTestId('submenu-trigger');
      fireEvent.mouseEnter(submenuTrigger);

      await flushMicrotasks();

      expect(submenuTrigger).not.to.have.attribute('data-highlighted');
      expect(submenuTrigger).not.toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('marks items as disabled when controlled open', async () => {
      render(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            get children() {
              return (
                <>
                  <Menu.Item data-testid="item">Item</Menu.Item>
                  <Menu.CheckboxItem data-testid="checkbox-item">Checkbox item</Menu.CheckboxItem>
                  <Menu.RadioGroup>
                    <Menu.RadioItem data-testid="radio-item" value="radio">
                      Radio item
                    </Menu.RadioItem>
                  </Menu.RadioGroup>
                </>
              );
            },
          }}
        />
      ));

      expect(screen.getByTestId('item')).to.have.attribute('data-disabled');
      expect(screen.getByTestId('checkbox-item')).to.have.attribute('data-disabled');
      expect(screen.getByTestId('radio-item')).to.have.attribute('data-disabled');
    });

    it('does not highlight items with text navigation when controlled open', async () => {
      const { user } = render(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            get children() {
              return (
                <>
                  <Menu.Item data-testid="alpha">Alpha</Menu.Item>
                  <Menu.Item data-testid="beta">Beta</Menu.Item>
                </>
              );
            },
          }}
        />
      ));

      const alpha = screen.getByTestId('alpha');
      const beta = screen.getByTestId('beta');

      await act(async () => {
        alpha.focus();
      });

      await user.keyboard('b');
      await flushMicrotasks();

      expect(beta).not.to.have.attribute('data-highlighted');
      expect(beta).not.toHaveFocus();
    });

    it('does not close or activate items when controlled open', async () => {
      const handleOpenChange = vi.fn();
      const handleClick = vi.fn();
      const { user } = render(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true, onOpenChange: handleOpenChange }}
          popupProps={{
            get children() {
              return (
                <Menu.Item data-testid="item" onClick={handleClick}>
                  Item
                </Menu.Item>
              );
            },
          }}
        />
      ));

      await user.click(screen.getByTestId('item'));

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('disables submenu triggers when controlled open', async () => {
      const { user } = render(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            get children() {
              return (
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                    Submenu
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>Nested item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              );
            },
          }}
        />
      ));

      const submenuTrigger = screen.getByTestId('submenu-trigger');

      expect(submenuTrigger).to.have.attribute('data-disabled');

      await user.click(submenuTrigger);

      expect(screen.queryByTestId('submenu-popup')).to.equal(null);
    });
  });

  describe('dynamic items', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('skips null items when navigating', async () => {
      function DynamicMenu() {
        const [itemsFiltered, setItemsFiltered] = createSignal(false);

        return (
          <Menu.Root
            onOpenChange={(newOpen) => {
              if (newOpen) {
                setTimeout(() => {
                  setItemsFiltered(true);
                }, 0);
              }
            }}
            onOpenChangeComplete={(newOpen) => {
              if (!newOpen) {
                setItemsFiltered(false);
              }
            }}
          >
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Add to Library</Menu.Item>
                  {!itemsFiltered() && (
                    <>
                      <Menu.Item>Add to Playlist</Menu.Item>
                      <Menu.Item>Play Next</Menu.Item>
                      <Menu.Item>Play Last</Menu.Item>
                    </>
                  )}
                  <Menu.Item>Favorite</Menu.Item>
                  <Menu.Item>Share</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      const { user } = renderFakeTimers(() => <DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      trigger.focus();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      await user.keyboard('{ArrowDown}'); // loops back to Add to Library

      expect(screen.queryByRole('menuitem', { name: 'Add to Library' })).toHaveFocus();
    });
  });
});

function ContainedTriggerMenu(props: TestMenuProps) {
  const [local, rest] = splitProps(props, ['triggerProps']);
  return (
    <TestMenuContents {...rest}>
      <Menu.Trigger {...local.triggerProps}>Toggle</Menu.Trigger>
    </TestMenuContents>
  );
}

function DetachedTriggerMenu(props: TestMenuProps) {
  const [local, rest] = splitProps(props, ['triggerProps']);
  const menuHandle = new Menu.Handle();

  return (
    <>
      <TestMenuContents {...rest} rootProps={{ ...rest.rootProps, handle: menuHandle }} />
      <Menu.Trigger handle={menuHandle} {...local.triggerProps}>
        Toggle
      </Menu.Trigger>
    </>
  );
}

type TestMenuProps = {
  rootProps?: Menu.Root.Props;
  portalProps?: Menu.Portal.Props;
  popupProps?: Menu.Popup.Props;
  triggerProps?: Menu.Trigger.Props;
  submenuProps?: Menu.SubmenuRoot.Props;
  submenuTriggerProps?: Menu.SubmenuTrigger.Props;
  children?: JSX.Element;
};

function TestMenuContents(props: TestMenuProps) {
  return (
    <Menu.Root {...props.rootProps}>
      {props.children}
      <Menu.Portal {...props.portalProps}>
        <Menu.Positioner data-testid="menu-positioner">
          <Menu.Popup data-testid="menu" {...props.popupProps}>
            {props.popupProps?.children ?? (
              <>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3" disabled>
                  Item 3
                </Menu.Item>
                <Menu.SubmenuRoot {...props.submenuProps}>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger" {...props.submenuTriggerProps}>
                    Item 4
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu">
                        <Menu.Item data-testid="item-4_1">Item 4.1</Menu.Item>
                        <Menu.Item data-testid="item-4_2">Item 4.2</Menu.Item>
                        <Menu.SubmenuRoot {...props.submenuProps}>
                          <Menu.SubmenuTrigger
                            data-testid="nested-submenu-trigger"
                            {...props.submenuTriggerProps}
                          >
                            Item 4.3
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup data-testid="nested-submenu">
                                <Menu.Item data-testid="item-4_3_1">Item 4.3.1</Menu.Item>
                                <Menu.Item data-testid="item-4_3_2">Item 4.3.2</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.Item data-testid="item-5">Item 5</Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
