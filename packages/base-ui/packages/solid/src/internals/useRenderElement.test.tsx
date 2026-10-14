/* eslint-disable testing-library/render-result-naming-convention */
import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import { expect, describe, it } from 'vitest';
import { createSignal, lazy, onCleanup, onSettled, Show, Loading } from 'solid-js';
import type { ComponentProps, JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '../utils/empty';
import { mergeProps as solidMergeProps } from '../merge-props';
import type { BaseUIComponentProps, UseRenderElementRef } from '../utils/types';
import { useRenderElement } from './useRenderElement';
import { splitProps } from '../solid-1-compat';

describe('useRenderElement', () => {
  const { render } = createRenderer();
  // Solid: titles keep React's `className` wording; Solid props use `class`.

  function TestComponent(
    componentProps: BaseUIComponentProps<'div', { active?: boolean }> & { active?: boolean },
  ) {
    const [local, elementProps] = splitProps(componentProps, ['class', 'render', 'active']);

    const element = useRenderElement('div', componentProps, {
      props: [elementProps, { class: 'test-component', style: { padding: '10px' } }],
      state: {
        get active() {
          return local.active;
        },
      },
    });

    return <>{element()}</>;
  }

  it('accepts className as function', () => {
    const { container } = render(() => (
      <TestComponent active class={(state) => (state.active ? 'active-class' : 'inactive-class')} />
    ));

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'active-class test-component');
  });

  it('accepts className as function that returns undefined', () => {
    const { container } = render(() => (
      <TestComponent class={(state) => (state.active ? 'active-class' : undefined)} />
    ));

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'test-component');
  });

  it('accepts style as function', () => {
    const { container } = render(() => (
      <TestComponent
        active
        style={(state) => ({ color: state.active ? 'rgb(255,0,0)' : 'rgb(0,255,0)' })}
      />
    ));

    const element = container.firstElementChild;

    expect(element?.getAttribute('style')).toBe('padding: 10px; color: rgb(255, 0, 0);');
  });

  it('accepts style as function that returns undefined', () => {
    const { container } = render(() => (
      <TestComponent style={(state) => (state.active ? { color: 'rgb(255,0,0)' } : undefined)} />
    ));

    const element = container.firstElementChild;

    expect(element?.getAttribute('style')).toBe('padding: 10px;');
  });

  function DirectPropsTestComponent(
    componentProps: BaseUIComponentProps<'div', { active?: boolean }> & { active?: boolean },
  ) {
    const [local, elementProps] = splitProps(componentProps, [
      'class',
      'render',
      'active',
      'style',
    ]);

    const element = useRenderElement('div', componentProps, {
      state: {
        get active() {
          return local.active;
        },
      },
      props: elementProps,
    });

    return <>{element()}</>;
  }

  function ArrayPropsTestComponent(
    componentProps: BaseUIComponentProps<'div', { active?: boolean }> & { active?: boolean },
  ) {
    const [local, elementProps] = splitProps(componentProps, [
      'class',
      'render',
      'active',
      'style',
    ]);

    const element = useRenderElement('div', componentProps, {
      state: {
        get active() {
          return local.active;
        },
      },
      props: [elementProps, { class: 'test-component' }],
    });

    return <>{element()}</>;
  }

  function DisabledPropsTestComponent(props: {
    propsGetter: () => JSX.HTMLAttributes<HTMLDivElement>;
  }) {
    const element = useRenderElement(
      'div',
      {},
      {
        enabled: false,
        props: [props.propsGetter],
      },
    );

    return <>{element()}</>;
  }

  function RerenderTestComponent(props: {
    enabled?: boolean;
    refs?:
      UseRenderElementRef<Element> | Array<UseRenderElementRef<Element> | undefined> | undefined;
    onClick?: (event: MouseEvent) => void;
  }) {
    const element = useRenderElement(
      'div',
      {},
      {
        get enabled() {
          return props.enabled;
        },
        get ref() {
          return props.refs;
        },
        props: [
          {
            id: 'rerender-target',
            onClick: (event: MouseEvent) => props.onClick?.(event),
          },
        ],
      },
    );

    return <>{element()}</>;
  }

  it('makes single prop objects preventable', () => {
    const handleMouseDown = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = render(() => <DirectPropsTestComponent onMouseDown={handleMouseDown} />);

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    ).not.toThrow();
    expect(handleMouseDown.mock.calls.length).toBe(1);
  });

  it('makes multi-prop arrays preventable when the event handler is first', () => {
    const handleMouseDown = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = render(() => <ArrayPropsTestComponent onMouseDown={handleMouseDown} />);

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    ).not.toThrow();
    expect(handleMouseDown.mock.calls.length).toBe(1);
  });

  it('makes obscure single-prop events preventable', () => {
    const handleContextMenu = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = render(() => (
      <DirectPropsTestComponent onContextMenu={handleContextMenu} />
    ));

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
    ).not.toThrow();
    expect(handleContextMenu.mock.calls.length).toBe(1);
  });

  it('makes obscure multi-prop array events preventable when the event handler is first', () => {
    const handleContextMenu = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = render(() => (
      <ArrayPropsTestComponent onContextMenu={handleContextMenu} />
    ));

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
    ).not.toThrow();
    expect(handleContextMenu.mock.calls.length).toBe(1);
  });

  it('does not resolve props when disabled', () => {
    const propsGetter = vi.fn(() => ({
      onMouseDown() {},
    }));

    const { container } = render(() => <DisabledPropsTestComponent propsGetter={propsGetter} />);

    expect(container.firstElementChild).toBe(null);
    expect(propsGetter.mock.calls.length).toBe(0);
  });

  it('handles enabled toggles across rerenders', () => {
    const ref = { current: null as Element | null | undefined };
    const handleClick = vi.fn();
    const [enabled, setEnabled] = createSignal(false);
    render(() => (
      <RerenderTestComponent
        enabled={enabled()}
        refs={(element) => {
          ref.current = element;
        }}
        onClick={handleClick}
      />
    ));

    expect(document.getElementById('rerender-target')).toBe(null);
    expect(ref.current ?? null).toBe(null);

    act(() => setEnabled(true));

    const element = document.getElementById('rerender-target') as HTMLDivElement;

    expect(element).not.toBe(null);
    expect(ref.current).toBe(element);

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handleClick.mock.calls.length).toBe(1);

    act(() => setEnabled(false));

    expect(document.getElementById('rerender-target')).toBe(null);
    expect(ref.current ?? null).toBe(null);
  });

  it('updates merged refs and event handlers when ref shape changes across rerenders', () => {
    const primaryRef = { current: null as Element | null | undefined };
    const secondaryRef = { current: null as Element | null | undefined };
    const firstHandleClick = vi.fn();
    const secondHandleClick = vi.fn();
    // Solid: props change through signals instead of `rerender`.
    const [refs, setRefs] = createSignal<
      UseRenderElementRef<Element> | Array<UseRenderElementRef<Element> | undefined>
    >(primaryRef);
    const [onClick, setOnClick] = createSignal<(event: MouseEvent) => void>(() => firstHandleClick);
    render(() => <RerenderTestComponent refs={refs()} onClick={onClick()} />);

    const initialElement = document.getElementById('rerender-target');

    expect(primaryRef.current).toBe(initialElement);
    expect(secondaryRef.current ?? null).toBe(null);

    act(() => {
      setRefs([primaryRef, secondaryRef]);
      setOnClick(() => secondHandleClick);
    });

    const updatedElement = document.getElementById('rerender-target') as HTMLDivElement;

    expect(primaryRef.current).toBe(updatedElement);
    expect(secondaryRef.current).toBe(updatedElement);

    updatedElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstHandleClick.mock.calls.length).toBe(0);
    expect(secondHandleClick.mock.calls.length).toBe(1);

    act(() => setRefs(secondaryRef));

    expect(primaryRef.current ?? null).toBe(null);
    expect(secondaryRef.current).toBe(document.getElementById('rerender-target'));
  });

  describe('EMPTY_OBJECT mutation safety', () => {
    // This test verifies that the hook doesn't attempt to mutate EMPTY_OBJECT
    // which would throw a TypeError in strict mode since it's frozen.
    function MinimalComponent(componentProps: BaseUIComponentProps<'div', Record<string, never>>) {
      // Using EMPTY_OBJECT as state and no additional props simulates the edge case
      // where mergeObjects might return undefined and fall back to EMPTY_OBJECT
      const element = useRenderElement('div', componentProps, {
        state: EMPTY_OBJECT,
      });

      return <>{element()}</>;
    }

    it('does not throw when className is provided with minimal props', () => {
      const { container } = render(() => <MinimalComponent class="test-class" />);
      expect(container.firstElementChild).not.toBe(null);
      expect(container.firstElementChild).toHaveAttribute('class', 'test-class');
    });

    it('does not throw when style is provided with minimal props', () => {
      const { container } = render(() => <MinimalComponent style={{ color: 'red' }} />);
      expect(container.firstElementChild).not.toBe(null);
      const element = container.firstElementChild as HTMLElement;
      expect(element.style.color).toBe('red');
    });
  });

  describe('prop: render', () => {
    it('accepts render as a function that receives props and state', async () => {
      const renderFn = vi.fn((props, state) => {
        return <span {...props} data-active={String(state.active)} />;
      });

      const { container } = render(() => (
        <TestComponent active render={renderFn} data-testid="custom" />
      ));

      const element = container.firstElementChild;

      expect(renderFn.mock.calls.length).toBeGreaterThan(0);
      const [firstCallProps, firstCallState] = renderFn.mock.calls[0];
      expect(firstCallProps).toMatchObject({
        class: 'test-component',
        'data-testid': 'custom',
      });
      expect(firstCallProps.style).toEqual({ padding: '10px' });
      expect(firstCallState).toEqual({ active: true });
      expect(element?.tagName).toBe('SPAN');
      expect(element).toHaveAttribute('data-testid', 'custom');
      expect(element).toHaveAttribute('data-active', 'true');
    });

    it('accepts render as a React element and clones it with merged props', async () => {
      function CustomElement(props: ComponentProps<'span'>) {
        return <span {...props} />;
      }

      const { container } = render(() => (
        <TestComponent
          active
          render={(props) => <CustomElement {...props} data-active="true" />}
          data-testid="custom"
        />
      ));

      const element = container.firstElementChild;

      expect(element?.tagName).toBe('SPAN');
      expect(element).toHaveAttribute('data-testid', 'custom');
      expect(element).toHaveAttribute('data-active', 'true');
    });

    it('forwards ref to render element', async () => {
      function CustomElement(props: ComponentProps<'div'>) {
        return <div {...props} />;
      }

      let ref: HTMLDivElement | null | undefined;
      const { container } = render(() => (
        <TestComponent
          ref={(el) => {
            ref = el;
          }}
          render={(props) => <CustomElement {...props} />}
        />
      ));
      const element = container.firstElementChild;
      expect(ref).toBe(element);
    });

    it('merges className from render element and component props', async () => {
      const { container } = render(() => (
        <TestComponent
          active
          class="component-class"
          render={(props) => <div {...props} class={`${props.class} render-class`} />}
        />
      ));

      const element = container.firstElementChild;

      expect(element?.className).toContain('component-class');
      expect(element?.className).toContain('render-class');
      expect(element?.className).toContain('test-component');
    });

    it('merges className function with render element', async () => {
      const { container } = render(() => (
        <TestComponent
          active
          class={(state) => (state.active ? 'active-class' : '')}
          render={(props) => <div {...props} class={`${props.class} render-class`} />}
        />
      ));

      const element = container.firstElementChild;

      expect(element?.className).toContain('active-class');
      expect(element?.className).toContain('render-class');
      expect(element?.className).toContain('test-component');
    });

    it('merges style from render element and component props', async () => {
      const { container } = render(() => (
        <TestComponent
          active
          style={{ color: 'rgb(255, 0, 0)' }}
          render={(props) => {
            const mergedProps = solidMergeProps(props, { style: { 'font-size': '16px' } });
            return <div {...mergedProps} />;
          }}
        />
      ));

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('rgb(255, 0, 0)');
      expect(element.style.fontSize).toBe('16px');
    });

    it('merges style function with render element', async () => {
      const { container } = render(() => (
        <TestComponent
          active
          style={(state) => ({ color: state.active ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 0)' })}
          render={(props) => {
            const mergedProps = solidMergeProps(props, { style: { 'font-size': '16px' } });
            return <div {...mergedProps} />;
          }}
        />
      ));

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('rgb(255, 0, 0)');
      expect(element.style.fontSize).toBe('16px');
    });

    it('handles lazy elements', async () => {
      const LazyComponent = lazy(() =>
        Promise.resolve({
          default: (props: ComponentProps<'div'>) => <div data-lazy="true" {...props} />,
        }),
      );

      render(() => (
        <Loading fallback={<div>Loading…</div>}>
          <TestComponent
            active
            render={(props) => <LazyComponent {...props} data-testid="lazy" />}
          />
        </Loading>
      ));

      const element = await screen.findByTestId('lazy');
      expect(element).not.toBe(null);

      expect(element?.getAttribute('data-testid')).toBe('lazy');
      expect(element?.getAttribute('data-lazy')).toBe('true');
      expect(element?.className).toContain('test-component');
    });

    it('handles render element with existing ref', async () => {
      const CustomElement = (props: ComponentProps<'div'>) => <div {...props} />;

      let renderRef: HTMLDivElement | null | undefined;
      let componentRef: HTMLDivElement | null | undefined;

      render(() => (
        <TestComponent
          ref={(el) => {
            componentRef = el;
          }}
          render={(props) => (
            <CustomElement
              {...props}
              ref={(el) => {
                renderRef = el;
                props.ref(el);
              }}
            />
          )}
        />
      ));

      expect(renderRef).toBeInstanceOf(HTMLDivElement);
      expect(componentRef).toBeInstanceOf(HTMLDivElement);
      expect(renderRef).toBe(componentRef);
    });

    // Solid: components are plain functions, so a component passed as `render` is a valid
    // callback and no naming warning exists.
    it.skip('warns when render is passed a function with an uppercase name', () => {});

    // Solid: components are plain functions, so a component passed as `render` is a valid
    // callback and no naming warning exists.
    it.skip('warns when render is passed a function with an uppercase acronym prefix', () => {});

    it('does not warn when render is passed a lowercase callback', () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      const renderFn = (props: ComponentProps<'span'>) => <span {...props} />;

      render(() => <TestComponent render={renderFn} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed a screaming snake case callback', () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      const renderFn = (props: ComponentProps<'span'>) => <span {...props} />;
      Object.defineProperty(renderFn, 'name', {
        value: 'DEFAULT_RENDER',
      });

      render(() => <TestComponent render={renderFn} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed a callback with an inferred useCallback name', () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      const renderFn = (props: ComponentProps<'span'>) => <span {...props} />;
      Object.defineProperty(renderFn, 'name', {
        value: 'DropdownMenuExample.useCallback[renderSearchInput]',
      });

      render(() => <TestComponent render={renderFn} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed as a React element', () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      function UppercaseRenderElement(props: ComponentProps<'span'>) {
        return <span {...props} />;
      }

      render(() => <TestComponent render={(props) => <UppercaseRenderElement {...props} />} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    // Solid: there are no React Flight `react.lazy` render-element wrappers.
    describe.skip('lazy-wrapped render element (Flight shape)', () => {
      it('merges props with the same precedence as a plain render element', () => {});
      it('attaches the render element ref', () => {});
      it('does not unwrap a pending element when disabled', () => {});
      it.skip('reports a wrapper that unwraps to %s as an invalid render element', () => {});
    });

    // Solid: a string `render` is an intrinsic tag name, not an invalid element.
    it.skip('throws error for invalid render element in development', () => {});
  });
});
