/* eslint-disable testing-library/render-result-naming-convention */
import { act, createRenderer } from '#test-utils';
import { expect, describe, it } from 'vitest';
import { createSignal } from 'solid-js';
import type { ComponentProps, JSX } from '@solidjs/web';
import { useRender } from './useRender';
import { splitProps } from '../solid-1-compat';

describe('useRender', () => {
  const { render } = createRenderer();

  // Solid: React's title; the Solid prop is `class`.
  it('render props does not overwrite className in a render function when unspecified', async () => {
    function TestComponent(props: {
      render: useRender.Parameters<{}, Element, undefined>['render'];
      class?: string;
    }) {
      const element = useRender(props);
      return <>{element()}</>;
    }

    const { container } = render(() => (
      <TestComponent
        render={(props: any, state: any) => (
          <span {...props} class={`my-span ${props.class ?? ''}`} {...state} />
        )}
      />
    ));

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'my-span ');
  });

  it('refs are handled as expected', async () => {
    const refs: (HTMLElement | null | undefined)[] = [];

    function TestComponent(
      props: {
        render: useRender.Parameters<{}, Element, undefined>['render'];
        class?: string;
      } & ComponentProps<'span'>,
    ) {
      const [local, otherProps] = splitProps(props, ['render']);

      const element = useRender({
        props: otherProps,
        ref: (el: HTMLElement | null) => {
          refs[0] = el;
          refs[1] = el;
        },
        render: local.render,
      });
      return <>{element()}</>;
    }

    const { container } = render(() => (
      <TestComponent render={(props: any, state: any) => <span {...props} {...state} />} />
    ));
    expect(refs.length).toBe(2);

    refs.forEach((ref) => {
      expect(ref).toEqual(container.firstElementChild);
    });
  });

  describe('param: defaultTagName', () => {
    it('renders div by default if no defaultTagName and no render params are provided', async () => {
      function TestComponent() {
        return <>{useRender({})}</>;
      }

      const { container } = render(() => <TestComponent />);
      expect(container.firstElementChild).toHaveProperty(['tagName'], 'DIV');
    });

    it('renders the element with the default tag with no render prop', async () => {
      function TestComponent(props: { defaultTagName: keyof JSX.IntrinsicElements }) {
        return <>{useRender({ defaultTagName: props.defaultTagName })}</>;
      }

      const [defaultTagName, setDefaultTagName] = createSignal<keyof JSX.IntrinsicElements>('div');
      const { container } = render(() => <TestComponent defaultTagName={defaultTagName()} />);
      expect(container.firstElementChild).toHaveProperty(['tagName'], 'DIV');

      act(() => setDefaultTagName('span'));
      expect(container.firstElementChild).toHaveProperty(['tagName'], 'SPAN');
    });

    it('is overwritten by the render prop', async () => {
      function TestComponent(props: {
        render: useRender.Parameters<{}, Element, undefined>['render'];
        defaultTagName: keyof JSX.IntrinsicElements;
      }) {
        return <>{useRender({ defaultTagName: props.defaultTagName, render: props.render })}</>;
      }

      const [defaultTagName, setDefaultTagName] = createSignal<keyof JSX.IntrinsicElements>('div');
      const { container } = render(() => (
        <TestComponent defaultTagName={defaultTagName()} render="span" />
      ));
      expect(container.firstElementChild).toHaveProperty(['tagName'], 'SPAN');

      act(() => setDefaultTagName('a'));
      expect(container.firstElementChild).toHaveProperty(['tagName'], 'SPAN');
    });
  });

  describe('state to data attributes', () => {
    it('converts state to data attributes automatically', async () => {
      function TestComponent() {
        const element = useRender({
          render: (p) => <button {...p} type="button" />,
          state: {
            active: true,
            index: 42,
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).toHaveAttribute('data-index', '42');
    });

    it('handles undefined values in state', async () => {
      function TestComponent() {
        const element = useRender({
          render: 'div',
          state: {
            defined: 'value',
            notDefined: undefined,
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('data-defined', 'value');
      expect(div).not.toHaveAttribute('data-notdefined');
    });

    it('merges state-based data attributes with existing props', async () => {
      function TestComponent() {
        const element = useRender({
          props: {
            class: 'btn-primary',
            'data-existing': 'prop',
            id: 'submit-btn',
          },
          render: (p) => <button {...p} type="button" />,
          state: {
            form: 'login',
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-form', 'login');

      expect(button).toHaveAttribute('class', 'btn-primary');
      expect(button).toHaveAttribute('id', 'submit-btn');

      expect(button).toHaveAttribute('data-existing', 'prop');
    });

    it('props override state-based data attributes', async () => {
      function TestComponent() {
        const element = useRender({
          props: {
            'data-active': 'false',
          },
          render: (p) => <button {...p} type="button" />,
          state: {
            active: true,
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', 'false');
    });

    it('handles empty state', async () => {
      function TestComponent() {
        const element = useRender({
          props: {
            class: 'test-class',
          },
          render: 'span',
          state: {},
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const span = container.firstElementChild;

      expect(span).toHaveAttribute('class', 'test-class');

      const attributes = span?.attributes;
      if (attributes) {
        for (let i = 0; i < attributes.length; i += 1) {
          expect(attributes[i].name).not.toMatch(/^data-/);
        }
      }
    });

    it('handles undefined state', async () => {
      function TestComponent() {
        const element = useRender({
          props: {
            class: 'test-class',
            'data-from-props': 'value',
          },
          render: 'div',
          state: undefined,
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('class', 'test-class');
      expect(div).toHaveAttribute('data-from-props', 'value');
    });

    it('converts boolean values in state to data attributes', async () => {
      function TestComponent() {
        const element = useRender({
          render: (p) => <button {...p} type="button" />,
          state: {
            active: true,
            disabled: false,
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).not.toHaveAttribute('data-disabled');
    });

    it('converts number values in state to data attributes', async () => {
      function TestComponent() {
        const element = useRender({
          render: 'div',
          state: {
            count: 0,
            index: 42,
            percentage: 99.9,
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const div = container.firstElementChild;

      expect(div).not.toHaveAttribute('data-count');
      expect(div).toHaveAttribute('data-index', '42');
      expect(div).toHaveAttribute('data-percentage', '99.9');
    });

    it('supports custom stateAttributesMapping for kebab-case conversion', async () => {
      function TestComponent() {
        const element = useRender({
          render: (p) => <button {...p} type="button" />,
          state: {
            isActive: true,
            itemCount: 5,
            userName: 'John',
          },
          stateAttributesMapping: {
            isActive: (value) => (value ? { 'data-is-active': '' } : null),
            itemCount: (value) => ({ 'data-item-count': value.toString() }),
            userName: (value) => ({ 'data-user-name': value }),
          },
        });
        return <>{element()}</>;
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-is-active', '');
      expect(button).toHaveAttribute('data-item-count', '5');
      expect(button).toHaveAttribute('data-user-name', 'John');
    });
  });
});
