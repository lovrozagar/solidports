import { expect, vi } from 'vitest';
import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createRouter, memoryHistory, useHref } from '@solidjs/router';
import { fireEvent, screen } from '@solidjs/testing-library';
import { Tabs } from '@solidports/base-ui/tabs';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';

function UnstableRefTab(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const others = omit(props, 'ref');
  const internalRef: { current: HTMLAnchorElement | null } = { current: null };

  // Deliberately create a fresh merged host ref callback.
  // Solid: components render once, so it is created once per mount.
  const mergedRef = (element: HTMLAnchorElement) => {
    internalRef.current = element;
    const forwardedRef = props.ref;
    if (typeof forwardedRef === 'function') {
      forwardedRef(element);
    }
  };

  return <a {...others} ref={mergedRef} />;
}

// Solid: `@solidjs/router` links are plain anchors; `useHref` resolves `to` like react-router's `<Link>`.
function Link(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const others = omit(props, 'to');
  const href = useHref(() => props.to);
  return <a {...others} href={href()} />;
}

describe('<Tabs.Tab />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Tabs.Tab {...props} ref={props.ref} value="1" />,
    () => ({
      refInstanceof: window.HTMLButtonElement,
      testComponentPropWith: 'button',
      button: true,
      render: (node, props) =>
        render(() => (
          <Tabs.Root>
            <Tabs.List>{node(props!)}</Tabs.List>
          </Tabs.Root>
        )),
    }),
  );

  describe('prop: nativeButton', () => {
    it('renders as an anchor and toggles selection when `nativeButton` is false', async () => {
      const { user } = render(() => (
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab
              nativeButton={false}
              render={(props) => <a {...props} href="#overview" />}
              value="overview"
            >
              Overview
            </Tabs.Tab>
            <Tabs.Tab
              nativeButton={false}
              render={(props) => <a {...props} href="#details" />}
              value="details"
            >
              Details
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0].tagName).toBe('A');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

      await user.click(tabs[1]);

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('renders a react-router Link', async () => {
      const TestRouter = createRouter({
        history: memoryHistory('/'),
        routes: [
          {
            path: '/',
            component: () => (
              <Tabs.Root defaultValue="overview">
                <Tabs.List>
                  <Tabs.Tab
                    nativeButton={false}
                    render={(props) => <Link {...props} to="/overview" />}
                    value="overview"
                  >
                    Overview
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.Root>
            ),
          },
        ],
      });

      render(() => <TestRouter />);

      expect(await screen.findByRole('tab')).toHaveAttribute('href', '/overview');
    });

    it('settles when the rendered component recreates its merged ref', async () => {
      render(() => (
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab
              nativeButton={false}
              render={(props) => <UnstableRefTab {...props} href="#overview" />}
              value="overview"
            >
              Overview
            </Tabs.Tab>
            <Tabs.Tab
              nativeButton={false}
              render={(props) => <UnstableRefTab {...props} href="#details" />}
              value="details"
            >
              Details
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1]);
    });
  });

  it('throws a descriptive error when rendered outside <Tabs.List>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tabs.Root>
            <Tabs.Tab value="1" />
          </Tabs.Root>
        )),
      ).toThrow(
        'Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  describe('pointer interaction', () => {
    function TwoTabs(props: {
      onValueChange?: Tabs.Root.Props['onValueChange'];
      disabledSecond?: boolean;
    }) {
      return (
        <Tabs.Root defaultValue={0} onValueChange={props.onValueChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0}>One</Tabs.Tab>
            <Tabs.Tab value={1} disabled={props.disabledSecond}>
              Two
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      );
    }

    it('does not re-commit the value when the active tab is pressed', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => <TwoTabs onValueChange={handleValueChange} />);

      const [firstTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseLeft]', target: firstTab });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });

    it('does not activate a disabled tab that is pressed and focused', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => <TwoTabs onValueChange={handleValueChange} disabledSecond />);

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseLeft]', target: secondTab });
      // Disabled tabs stay focusable, and `activateOnFocus` must not select them.
      await act(async () => {
        secondTab.focus();
      });

      expect(secondTab).toHaveFocus();
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('does not activate a tab focused by a held secondary-button press', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => <TwoTabs onValueChange={handleValueChange} />);

      const [, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseRight>]', target: secondTab });
      await act(async () => {
        secondTab.focus();
      });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('activates on focus again once a secondary-button press has ended', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => <TwoTabs onValueChange={handleValueChange} />);

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await user.pointer({ keys: '[MouseRight]', target: secondTab });

      expect(handleValueChange).not.toHaveBeenCalled();

      await act(async () => {
        firstTab.focus();
      });
      await user.keyboard('{ArrowRight}');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('activates on focus again once a secondary-button press is cancelled', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => <TwoTabs onValueChange={handleValueChange} />);

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      fireEvent.pointerDown(secondTab, { button: 2 });
      fireEvent.pointerCancel(secondTab);

      await act(async () => {
        firstTab.focus();
      });
      await user.keyboard('{ArrowRight}');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard activation', () => {
    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('activates the focused tab with %s when `activateOnFocus` is false', async (_label, key) => {
      const { user } = render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>One</Tabs.Tab>
            <Tabs.Tab value={1}>Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await act(async () => {
        firstTab.focus();
      });
      await user.keyboard('{ArrowRight}');

      expect(secondTab).toHaveFocus();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');

      await user.keyboard(key);

      expect(secondTab).toHaveAttribute('aria-selected', 'true');
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('state', () => {
    it.skipIf(isJSDOM)('exposes tab activation direction through the render prop', async () => {
      const tabRenderMock = vi.fn();
      const [value, setValue] = createSignal(0);

      render(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab
              value={0}
              render={(props, state) => {
                tabRenderMock({ value: 0, ...state });
                return <button {...props} />;
              }}
            >
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab
              value={1}
              render={(props, state) => {
                tabRenderMock({ value: 1, ...state });
                return <button {...props} />;
              }}
            >
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      tabRenderMock.mockClear();

      act(() => setValue(1));

      expect(
        tabRenderMock.mock.calls.some(
          ([state]) =>
            state.value === 1 && state.active === true && state.tabActivationDirection === 'right',
        ),
      ).toBe(true);
    });
  });
});
