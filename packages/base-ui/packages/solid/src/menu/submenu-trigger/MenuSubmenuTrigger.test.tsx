import { createSignal } from 'solid-js';
import { expect, afterEach, beforeEach, vi } from 'vitest';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';

type TextDirection = 'ltr' | 'rtl';

describe('<Menu.SubmenuTrigger />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  async function waitForAnimationFrame() {
    await act(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );
  }

  afterEach(waitForAnimationFrame);

  describeConformance(Menu.SubmenuTrigger, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render: (node, props) =>
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot>{node(props!)}</Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )),
  }));

  it('follows a submenu trigger id change', async () => {
    const storeRef: { current: MenuStore<unknown> | null } = { current: null };

    function StoreProbe() {
      storeRef.current = useMenuRootContext().store;
      return null;
    }

    const [id, setId] = createSignal('first');

    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.SubmenuRoot>
                <StoreProbe />
                <Menu.SubmenuTrigger id={id()}>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Monthly</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const submenuTrigger = screen.getByText('More');
    expect(storeRef.current!.context.triggerElements.getById('first')).to.equal(submenuTrigger);

    await act(() => setId('second'));

    expect(storeRef.current!.context.triggerElements.getById('first')).to.equal(undefined);
    expect(storeRef.current!.context.triggerElements.getById('second')).to.equal(submenuTrigger);
    expect(storeRef.current!.context.triggerElements.size).to.equal(1);
  });

  it('throws when rendered outside Menu.SubmenuRoot', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.SubmenuTrigger />)).to.throw(
        'Base UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  function TestComponent(props: { direction: TextDirection }) {
    return (
      <DirectionProvider direction={props.direction}>
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>2</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </DirectionProvider>
    );
  }

  const testCases = [
    { closeKey: 'ArrowLeft', direction: 'ltr', openKey: 'ArrowRight' },
    { closeKey: 'ArrowRight', direction: 'rtl', openKey: 'ArrowLeft' },
  ];

  testCases.forEach(({ direction, openKey }) => {
    it(`opens the submenu with ${openKey} and highlights a single item in ${direction.toUpperCase()} direction`, async () => {
      render(() => <TestComponent direction={direction as TextDirection} />);
      const submenuTrigger = screen.getByText('2');

      fireEvent.focus(submenuTrigger);
      fireEvent.keyDown(submenuTrigger, { key: openKey });

      const submenuItems = await screen.findAllByRole('menuitem');
      const submenuItem1 = submenuItems.find((item) => item.textContent === '2.1');

      await waitFor(() => {
        expect(submenuItem1).toHaveFocus();
      });

      submenuItems.forEach((item) => {
        if (item === submenuItem1) {
          expect(item).to.have.attribute('data-highlighted');
        } else {
          expect(item).not.to.have.attribute('data-highlighted');
        }
      });

      // Check that parent menu items are not active
      const parentMenuItems = screen
        .getAllByRole('menuitem')
        .filter((item) => item.textContent !== '2.1' && item.textContent !== '2.2');
      parentMenuItems.forEach((item) => {
        expect(item).not.to.have.attribute('data-highlighted');
      });
    });
  });

  it('sets tabIndex to 0 on the submenu trigger after opening the submenu with a keydown event', async () => {
    render(() => <TestComponent direction="ltr" />);
    const submenuTrigger = screen.getByText('2');

    fireEvent.focus(submenuTrigger);
    fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(submenuTrigger).to.have.attribute('tabIndex', '0');
    });
  });

  it('uses the label prop for text navigation', async () => {
    const { user } = render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Alpha</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" label="Reports">
                  More
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Monthly</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    fireEvent.focus(screen.getByText('Alpha'));
    await user.keyboard('r');

    await waitFor(() => {
      expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('should render with disabled attributes when disabled prop is set', async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger disabled>Open submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Open submenu' });

      expect(submenuTrigger).to.have.attribute('data-disabled');
      expect(submenuTrigger).to.have.attribute('aria-disabled', 'true');
    });

    it('does not open on hover when disabled', async () => {
      const { user } = render(() => (
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger disabled delay={0}>
                    Open submenu
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Open submenu' });

      await user.hover(submenuTrigger);

      expect(screen.queryByTestId('submenu-popup')).to.equal(null);
    });

    it('should warn when a disabled element is detected via render prop with JSX element', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});
      render(() => (
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger
                    nativeButton
                    render={(props) => <button {...props} type="button" disabled={true} />}
                  >
                    Open submenu
                  </Menu.SubmenuTrigger>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
        ),
      );
      expect(warnSpy.mock.lastCall?.[0]).not.to.contain('undefined');
      warnSpy.mockRestore();
    });

    // Solid: there is no owner stack API, so the warning is always the bare message.
    it('warns without an owner stack when React cannot provide one', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        render(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger
                      nativeButton
                      render={(props) => <button {...props} type="button" disabled={true} />}
                    >
                      Open submenu
                    </Menu.SubmenuTrigger>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          'Base UI: A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it.skipIf(!isJSDOM)('does not inspect rendered disabled elements in production', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        render(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger
                      nativeButton
                      render={(props) => <button {...props} type="button" disabled={true} />}
                    >
                      Open submenu
                    </Menu.SubmenuTrigger>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        warnSpy.mockRestore();
      }
    });
  });
});
