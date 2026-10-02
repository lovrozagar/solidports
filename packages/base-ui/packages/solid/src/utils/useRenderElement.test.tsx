/* eslint-disable testing-library/render-result-naming-convention */
import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { createSignal, lazy, onCleanup, onSettled, Show, Loading } from 'solid-js';
import { EMPTY_OBJECT } from './empty';
import type { ComponentProps, JSX } from '@solidjs/web';
import { mergeProps as solidMergeProps } from '../merge-props';
import type { BaseUIComponentProps } from './types';
import { useRenderElement } from './useRenderElement';
import { splitProps } from '../solid-1-compat';

describe('useRenderElement', () => {
  const { render } = createRenderer();
  describe('fine-grained reactivity', () => {
    function ReactiveTestComponent(props: {
      active: () => boolean;
      componentProps?: BaseUIComponentProps<'div', { active: boolean }>;
      onChildMount: () => void;
      onChildCleanup: () => void;
    }) {
      function Child() {
        onSettled(() => props.onChildMount());
        onCleanup(() => props.onChildCleanup());
        return <span data-testid="child">child</span>;
      }

      const componentProps = () => props.componentProps ?? {};
      const element = useRenderElement('div', componentProps(), {
        children: <Child />,
        props: [
          componentProps(),
          {
            class: 'test-component',
            get ['data-count']() {
              return props.active() ? '1' : '0';
            },
          } as BaseUIComponentProps<'div', { active: boolean }>,
        ],
        state: {
          get active() {
            return props.active();
          },
        },
      });

      return <>{element()}</>;
    }

    it('does not remount children when reactive state field toggles', async () => {
      const mountSpy = vi.fn();
      const cleanupSpy = vi.fn();
      const [active, setActive] = createSignal(false);

      const { container } = render(() => (
        <ReactiveTestComponent
          active={active}
          onChildMount={() => mountSpy()}
          onChildCleanup={() => cleanupSpy()}
        />
      ));

      const element = container.firstElementChild as HTMLElement;

      expect(mountSpy.mock.calls.length).to.equal(1);
      expect(cleanupSpy.mock.calls.length).to.equal(0);
      expect(element.hasAttribute('data-active')).to.equal(false);

      act(() => setActive(true));
      await flushMicrotasks();
      expect(element.hasAttribute('data-active')).to.equal(true);

      act(() => setActive(false));
      await flushMicrotasks();
      expect(element.hasAttribute('data-active')).to.equal(false);

      act(() => setActive(true));
      await flushMicrotasks();
      expect(element.hasAttribute('data-active')).to.equal(true);

      expect(mountSpy.mock.calls.length).to.equal(1);
      expect(cleanupSpy.mock.calls.length).to.equal(0);
    });

    it('does not remount children when reactive class function changes', async () => {
      const mountSpy = vi.fn();
      const cleanupSpy = vi.fn();
      const [active, setActive] = createSignal(false);

      const { container } = render(() => (
        <ReactiveTestComponent
          active={active}
          componentProps={{
            class: (state) => (state.active ? 'on' : 'off'),
          }}
          onChildMount={() => mountSpy()}
          onChildCleanup={() => cleanupSpy()}
        />
      ));

      const element = container.firstElementChild as HTMLElement;

      expect(element.className).to.contain('off');
      expect(mountSpy.mock.calls.length).to.equal(1);

      act(() => setActive(true));
      await flushMicrotasks();
      expect(element.className).to.contain('on');

      act(() => setActive(false));
      await flushMicrotasks();
      expect(element.className).to.contain('off');

      expect(mountSpy.mock.calls.length).to.equal(1);
      expect(cleanupSpy.mock.calls.length).to.equal(0);
    });

    it('does not remount children when reactive style function changes', async () => {
      const mountSpy = vi.fn();
      const cleanupSpy = vi.fn();
      const [active, setActive] = createSignal(false);

      const { container } = render(() => (
        <ReactiveTestComponent
          active={active}
          componentProps={{
            style: (state) => ({
              color: state.active ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)',
            }),
          }}
          onChildMount={() => mountSpy()}
          onChildCleanup={() => cleanupSpy()}
        />
      ));

      const element = container.firstElementChild as HTMLElement;

      expect(element.style.color).to.equal('rgb(0, 0, 255)');
      expect(mountSpy.mock.calls.length).to.equal(1);

      act(() => setActive(true));
      await flushMicrotasks();
      expect(element.style.color).to.equal('rgb(255, 0, 0)');

      act(() => setActive(false));
      await flushMicrotasks();
      expect(element.style.color).to.equal('rgb(0, 0, 255)');

      expect(mountSpy.mock.calls.length).to.equal(1);
      expect(cleanupSpy.mock.calls.length).to.equal(0);
    });

    it('does not remount children when a reactive spread prop (getter) updates', async () => {
      const mountSpy = vi.fn();
      const cleanupSpy = vi.fn();
      const [active, setActive] = createSignal(false);

      const { container } = render(() => (
        <ReactiveTestComponent
          active={active}
          onChildMount={() => mountSpy()}
          onChildCleanup={() => cleanupSpy()}
        />
      ));

      const element = container.firstElementChild as HTMLElement;

      expect(element.getAttribute('data-count')).to.equal('0');

      act(() => setActive(true));
      await flushMicrotasks();
      expect(element.getAttribute('data-count')).to.equal('1');

      act(() => setActive(false));
      await flushMicrotasks();
      expect(element.getAttribute('data-count')).to.equal('0');

      act(() => setActive(true));
      await flushMicrotasks();
      expect(element.getAttribute('data-count')).to.equal('1');

      expect(mountSpy.mock.calls.length).to.equal(1);
      expect(cleanupSpy.mock.calls.length).to.equal(0);
    });

    it('children mount exactly once across many open/close-like toggles', async () => {
      const mountSpy = vi.fn();
      const cleanupSpy = vi.fn();
      const [active, setActive] = createSignal(false);

      render(() => (
        <ReactiveTestComponent
          active={active}
          onChildMount={() => mountSpy()}
          onChildCleanup={() => cleanupSpy()}
        />
      ));

      expect(mountSpy.mock.calls.length).to.equal(1);

      for (let i = 0; i < 6; i += 1) {
        act(() => setActive((prev) => !prev));
        // eslint-disable-next-line no-await-in-loop
        await flushMicrotasks();
      }

      expect(mountSpy.mock.calls.length).to.equal(1);
      expect(cleanupSpy.mock.calls.length).to.equal(0);
    });

    describe('children passed via componentProps', () => {
      function makeChild(onChildMount: () => void, onChildCleanup: () => void) {
        return function Child() {
          onSettled(() => onChildMount());
          onCleanup(() => onChildCleanup());
          return <span data-testid="child">child</span>;
        };
      }

      it('does not remount children passed as componentProps.children (static JSX)', async () => {
        const mountSpy = vi.fn();
        const cleanupSpy = vi.fn();
        const [active, setActive] = createSignal(false);
        const Child = makeChild(mountSpy, cleanupSpy);

        function TestWrapper() {
          const componentProps: BaseUIComponentProps<'div', { active: boolean }> = {
            children: <Child />,
          };
          const element = useRenderElement('div', componentProps, {
            props: [componentProps],
            state: {
              get active() {
                return active();
              },
            },
          });
          return <>{element()}</>;
        }

        render(() => <TestWrapper />);

        expect(mountSpy.mock.calls.length).to.equal(1);

        for (let i = 0; i < 5; i += 1) {
          setActive((prev) => !prev);
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
        }

        expect(mountSpy.mock.calls.length).to.equal(1);
        expect(cleanupSpy.mock.calls.length).to.equal(0);
      });

      it('does not remount children passed as componentProps.children via a reactive getter', async () => {
        const mountSpy = vi.fn();
        const cleanupSpy = vi.fn();
        const [active, setActive] = createSignal(false);
        const Child = makeChild(mountSpy, cleanupSpy);

        function TestWrapper(outerProps: { children?: JSX.Element }) {
          const componentProps: BaseUIComponentProps<'div', { active: boolean }> = {
            get children() {
              return outerProps.children;
            },
          };
          const element = useRenderElement('div', componentProps, {
            props: [componentProps],
            state: {
              get active() {
                return active();
              },
            },
          });
          return <>{element()}</>;
        }

        render(() => (
          <TestWrapper>
            <Child />
          </TestWrapper>
        ));

        expect(mountSpy.mock.calls.length).to.equal(1);

        for (let i = 0; i < 5; i += 1) {
          setActive((prev) => !prev);
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
        }

        expect(mountSpy.mock.calls.length).to.equal(1);
        expect(cleanupSpy.mock.calls.length).to.equal(0);
      });

      it('does not remount children passed as componentProps.children via a getter returning a fragment', async () => {
        const mountSpy = vi.fn();
        const cleanupSpy = vi.fn();
        const [active, setActive] = createSignal(false);
        const Child = makeChild(mountSpy, cleanupSpy);

        function TestWrapper(outerProps: { children?: JSX.Element }) {
          const componentProps: BaseUIComponentProps<'div', { active: boolean }> = {
            get children() {
              return <>{outerProps.children}</>;
            },
          };
          const element = useRenderElement('div', componentProps, {
            props: [componentProps],
            state: {
              get active() {
                return active();
              },
            },
          });
          return <>{element()}</>;
        }

        render(() => (
          <TestWrapper>
            <Child />
          </TestWrapper>
        ));

        expect(mountSpy.mock.calls.length).to.equal(1);

        for (let i = 0; i < 5; i += 1) {
          setActive((prev) => !prev);
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
        }

        expect(mountSpy.mock.calls.length).to.equal(1);
        expect(cleanupSpy.mock.calls.length).to.equal(0);
      });

      it('does not remount sibling sub-components that themselves call useRenderElement (Collapsible-shape regression)', async () => {
        const triggerMountSpy = vi.fn();
        const triggerCleanupSpy = vi.fn();
        const panelMountSpy = vi.fn();
        const panelCleanupSpy = vi.fn();
        const panelBodyMountSpy = vi.fn();
        const panelBodyCleanupSpy = vi.fn();
        const [open, setOpen] = createSignal(false);
        const [mounted] = createSignal(true);
        const [transitionStatus, setTransitionStatus] = createSignal<
          'idle' | 'starting' | 'ending'
        >('idle');

        const TestContext = {
          state: {
            get mounted() {
              return mounted();
            },
            get open() {
              return open();
            },
            get transitionStatus() {
              return transitionStatus();
            },
          },
        };

        function PanelBody() {
          onSettled(() => panelBodyMountSpy());
          onCleanup(() => panelBodyCleanupSpy());
          return <span data-testid="panel-body">panel body</span>;
        }

        function Trigger() {
          onSettled(() => triggerMountSpy());
          onCleanup(() => triggerCleanupSpy());

          const componentProps: BaseUIComponentProps<
            'button',
            { open: boolean; mounted: boolean; transitionStatus: string }
          > = {};
          const element = useRenderElement('button', componentProps, {
            props: [
              componentProps,
              {
                get ['aria-expanded']() {
                  return open();
                },
                onClick: () => setOpen((v) => !v),
              },
            ],
            state: TestContext.state,
          });
          return <>{element()}</>;
        }

        function Panel() {
          onSettled(() => panelMountSpy());
          onCleanup(() => panelCleanupSpy());

          const shouldRender = () => mounted();

          const componentProps: BaseUIComponentProps<
            'div',
            { open: boolean; mounted: boolean; transitionStatus: string }
          > = {
            children: <PanelBody />,
          };
          const element = useRenderElement('div', componentProps, {
            props: [
              componentProps,
              {
                get ['data-open']() {
                  return open() ? '' : undefined;
                },
              } as BaseUIComponentProps<
                'div',
                { open: boolean; mounted: boolean; transitionStatus: string }
              >,
            ],
            state: TestContext.state,
          });
          // Mirrors CollapsiblePanel: `<Show when={shouldRender()}>{element()}</Show>`
          return <Show when={shouldRender()}>{element()}</Show>;
        }

        function Root(outerProps: { children?: JSX.Element }) {
          const componentProps: BaseUIComponentProps<
            'div',
            { open: boolean; mounted: boolean; transitionStatus: string }
          > = {
            get children() {
              return outerProps.children;
            },
          };
          const element = useRenderElement('div', componentProps, {
            props: [componentProps],
            state: TestContext.state,
          });
          return <>{element()}</>;
        }

        render(() => (
          <Root>
            <Trigger />
            <Panel />
          </Root>
        ));

        expect(triggerMountSpy.mock.calls.length).to.equal(1);
        expect(panelMountSpy.mock.calls.length).to.equal(1);
        expect(panelBodyMountSpy.mock.calls.length).to.equal(1);

        // Mirror the open/close cycle the Collapsible demo goes through:
        // click -> open=true, starting, idle; click -> open=false, ending, idle
        for (let i = 0; i < 3; i += 1) {
          setOpen(true);
          setTransitionStatus('starting');
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
          setTransitionStatus('idle');
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
          setOpen(false);
          setTransitionStatus('ending');
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
          setTransitionStatus('idle');
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
        }

        expect(triggerMountSpy.mock.calls.length).to.equal(1);
        expect(triggerCleanupSpy.mock.calls.length).to.equal(0);
        expect(panelMountSpy.mock.calls.length).to.equal(1);
        expect(panelCleanupSpy.mock.calls.length).to.equal(0);
        expect(panelBodyMountSpy.mock.calls.length).to.equal(1);
        expect(panelBodyCleanupSpy.mock.calls.length).to.equal(0);
      });

      it('does not remount children passed via componentProps.render object', async () => {
        const mountSpy = vi.fn();
        const cleanupSpy = vi.fn();
        const [active, setActive] = createSignal(false);
        const Child = makeChild(mountSpy, cleanupSpy);

        function TestWrapper() {
          const componentProps: BaseUIComponentProps<'div', { active: boolean }> = {
            render: {
              children: <Child />,
              component: 'div',
            },
          };
          const element = useRenderElement('div', componentProps, {
            props: [componentProps],
            state: {
              get active() {
                return active();
              },
            },
          });
          return <>{element()}</>;
        }

        render(() => <TestWrapper />);

        expect(mountSpy.mock.calls.length).to.equal(1);

        for (let i = 0; i < 5; i += 1) {
          setActive((prev) => !prev);
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
        }

        expect(mountSpy.mock.calls.length).to.equal(1);
        expect(cleanupSpy.mock.calls.length).to.equal(0);
      });
    });
  });
});
