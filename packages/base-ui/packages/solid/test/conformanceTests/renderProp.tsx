import { randomStringValue } from '@mui/internal-test-utils';
import { screen } from '@solidjs/testing-library';
import { expect, describe, it } from 'vitest';
import type { Component, ParentComponent } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import type {
  BaseUiConformanceTestsOptions,
  ConformantComponentProps,
} from '../describeConformance';
import { throwMissingPropError } from './utils';

export function testRenderProp(
  element: Component<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  const {
    render,
    testRenderPropWith: Element = 'div',
    button = false,
    wrappingAllowed = true,
  } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  const Wrapper: ParentComponent = (props) => {
    return (
      <div data-testid="base-ui-wrapper">
        <Dynamic component={Element} {...props} data-testid="wrapped" />
      </div>
    );
  };

  describe('prop: render', () => {
    it('renders a customized root element with a function', () => {
      const testValue = randomStringValue();
      render(element, {
        render: (props: any) => <Wrapper {...props} data-test-value={testValue} />,
        ...(button && { nativeButton }),
      });

      expect(screen.queryAllByTestId('base-ui-wrapper')).toHaveLength(wrappingAllowed ? 1 : 0);
      expect(screen.queryByTestId('wrapped')).not.toBe(null);
      expect(screen.queryByTestId('wrapped')).toHaveAttribute('data-test-value', testValue);
    });

    // Solid: React's render element is a `{ component, ...props }` render config.
    it('renders a customized root element with an element', () => {
      const testValue = randomStringValue();
      render(element, {
        render: { component: Wrapper, 'data-test-value': testValue },
        ...(button && { nativeButton }),
      });

      expect(screen.queryAllByTestId('base-ui-wrapper')).toHaveLength(wrappingAllowed ? 1 : 0);
      expect(screen.queryByTestId('wrapped')).not.toBe(null);
      expect(screen.queryByTestId('wrapped')).toHaveAttribute('data-test-value', testValue);
    });

    // Solid: a component can be passed as the render prop itself.
    it('should pass the ref to the custom component', () => {
      let instanceFromRef: any;

      function Test() {
        return (
          <Dynamic
            component={element}
            ref={instanceFromRef}
            render={(props: Record<string, any>) => <Wrapper {...props} />}
            data-testid="wrapped"
            {...(button && { nativeButton })}
          />
        );
      }

      render(() => <Test />);
      expect(instanceFromRef!.tagName).toBe(Element.toUpperCase());
      expect(instanceFromRef!).toHaveAttribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element ref with the custom component ref', () => {
      let refA = null as HTMLElement | null;
      let refB = null as HTMLElement | null;

      function Test() {
        return (
          <Dynamic
            component={element}
            ref={(el: any) => {
              refA = el;
            }}
            render={{
              component: Wrapper,
              ref: (el: any) => {
                refB = el;
              },
            }}
            data-testid="wrapped"
            {...(button && { nativeButton })}
          />
        );
      }

      render(() => <Test />);

      expect(refA).not.toBe(null);
      expect(refA!.tagName).toBe(Element.toUpperCase());
      expect(refA!).toHaveAttribute('data-testid', 'wrapped');
      expect(refB).not.toBe(null);
      expect(refB!.tagName).toBe(Element.toUpperCase());
      expect(refB!).toHaveAttribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element className with the custom component className', () => {
      function Test() {
        return (
          <Dynamic
            component={element}
            class="component-classname"
            data-testid="test-component"
            {...(button && { nativeButton })}
            render={(props: Record<string, any>) => (
              <Dynamic
                component={Element}
                {...props}
                class={`${props.class} render-prop-classname`}
              />
            )}
          />
        );
      }

      render(() => <Test />);

      const component = screen.getByTestId('test-component');
      expect(component.classList.contains('component-classname')).toBe(true);
      expect(component.classList.contains('render-prop-classname')).toBe(true);
    });

    it('should merge the rendering element resolved className with the custom component className', () => {
      function Test() {
        return (
          <Dynamic
            component={element}
            class={() => 'conditional-component-classname'}
            data-testid="test-component"
            {...(button && { nativeButton })}
            render={(props: Record<string, any>) => (
              <Dynamic
                component={Element}
                {...props}
                class={`${props.class} render-prop-classname`}
              />
            )}
          />
        );
      }

      render(() => <Test />);

      const component = screen.getByTestId('test-component');
      expect(component.classList.contains('conditional-component-classname')).toBe(true);
      expect(component.classList.contains('render-prop-classname')).toBe(true);
    });
  });
}
