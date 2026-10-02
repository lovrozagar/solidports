import { expect, describe, it } from 'vitest';
import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { act, createRenderer } from '#test-utils';
import { useControlled } from './useControlled';

interface TestComponentChildrenArgument {
  value: Accessor<number | string | object | null | undefined>;
  setValue: (value: number | string) => void;
}

interface TestComponentProps {
  value?: number | string | undefined;
  defaultValue?: number | string | object | null | undefined;
  children: (parames: TestComponentChildrenArgument) => JSX.Element;
}

function TestComponent(props: TestComponentProps) {
  const [value, setValue] = useControlled<number | string | object | null>({
    controlled: () => props.value,
    default: () => props.defaultValue,
    name: 'TestComponent',
  });
  return <>{props.children({ value, setValue })}</>;
}

type TestProps = Omit<TestComponentProps, 'children'>;

describe('useControlled', () => {
  const { render } = createRenderer();

  // Solid: React's `setProps` re-renders with merged props; here the props live in a signal and
  // `setProps` applies the merged props in `act`.
  function renderTestComponent(
    initialProps: TestProps,
    children: TestComponentProps['children'] = () => null,
  ) {
    const [props, setRawProps] = createSignal<TestProps>(initialProps);
    render(() => (
      <TestComponent value={props().value} defaultValue={props().defaultValue}>
        {children}
      </TestComponent>
    ));
    return {
      setProps: (next: TestProps) => act(() => setRawProps((prev) => ({ ...prev, ...next }))),
    };
  }

  it('works correctly when is not controlled', () => {
    let valueState!: TestComponentChildrenArgument['value'];
    let setValueState!: TestComponentChildrenArgument['setValue'];
    renderTestComponent({ defaultValue: 1 }, ({ value, setValue }) => {
      valueState = value;
      setValueState = setValue;
      return null;
    });
    expect(valueState()).toBe(1);

    act(() => {
      setValueState(2);
    });

    expect(valueState()).toBe(2);
  });

  it('works correctly when is controlled', () => {
    let valueState!: TestComponentChildrenArgument['value'];
    renderTestComponent({ value: 1 }, ({ value }) => {
      valueState = value;
      return null;
    });
    expect(valueState()).toBe(1);
  });

  it('warns when switching from uncontrolled to controlled', () => {
    let setProps!: (newProps: TestProps) => void;
    expect(() => {
      ({ setProps } = renderTestComponent({}));
    }).not.toErrorDev();

    expect(() => {
      setProps({ value: 'foobar' });
    }).toErrorDev(
      'Base UI: A component is changing the uncontrolled value state of TestComponent to be controlled.',
    );
  });

  it('warns and falls back to the default when switching from controlled to uncontrolled', () => {
    // Solid: renderHook counterpart; the hook runs in a component and exposes its result.
    const [controlled, setControlled] = createSignal<string | undefined>('foobar');
    let result!: ReturnType<typeof useControlled<string>>;

    function TestHook() {
      result = useControlled<string>({
        controlled,
        default: 'default',
        name: 'TestHook',
      });
      return null;
    }

    expect(() => {
      render(() => <TestHook />);
    }).not.toErrorDev();

    expect(result[0]()).toBe('foobar');

    expect(() => {
      act(() => setControlled(undefined));
    }).toErrorDev(
      'Base UI: A component is changing the controlled value state of TestHook to be uncontrolled.',
    );

    expect(result[0]()).toBe('default');

    act(() => {
      result[1]('next');
    });

    expect(result[0]()).toBe('default');
  });

  describe('prop: defaultValue', () => {
    it('warns when changed after initial rendering', () => {
      let setProps!: (newProps: TestProps) => void;

      expect(() => {
        ({ setProps } = renderTestComponent({}));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 1 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );
    });

    it('does not warn when controlled', () => {
      let setProps!: (newProps: TestProps) => void;

      expect(() => {
        ({ setProps } = renderTestComponent({ value: 1, defaultValue: 0 }));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 1 });
      }).not.toErrorDev();
    });

    it('does not warn when NaN', () => {
      expect(() => {
        renderTestComponent({ defaultValue: NaN });
      }).not.toErrorDev();
    });

    it('does not warn when an array', () => {
      function TestComponentArray() {
        useControlled({
          controlled: undefined,
          default: [],
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(() => <TestComponentArray />);
      }).not.toErrorDev();
    });

    it('does not throw when defaultValue has React elements', () => {
      function TestComponentArray() {
        useControlled({
          controlled: undefined,
          default: {
            value: <span />,
          },
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(() => <TestComponentArray />);
      }).not.toErrorDev();
    });

    it('does not throw when defaultValue has function', () => {
      const fn = () => 100;

      function TestComponentArray() {
        useControlled({
          controlled: undefined,
          default: {
            value: fn,
          },
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(() => <TestComponentArray />);
      }).not.toErrorDev();
    });

    it('does not throw when defaultValue has bigint', () => {
      function TestComponentBigInt() {
        useControlled({
          controlled: undefined,
          default: 1n,
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(() => <TestComponentBigInt />);
      }).not.toErrorDev();
    });

    it('should warn only when defaultValue changes', () => {
      let setProps!: (newProps: TestProps) => void;

      expect(() => {
        ({ setProps } = renderTestComponent({ defaultValue: 0 }));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 1 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );

      expect(() => {
        setProps({ defaultValue: 2 });
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 0 });
      }).not.toErrorDev();
    });

    it('should warn only when defaultValue has functions/components and changes', () => {
      let setProps!: (newProps: TestProps) => void;

      const items = [
        {
          item: <span />,
        },
        {
          item: () => 100,
        },
        {
          item: <div />,
        },
      ];

      expect(() => {
        ({ setProps } = renderTestComponent({ defaultValue: items[0] }));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: items[1] });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );

      expect(() => {
        setProps({ defaultValue: items[2] });
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: items[0] });
      }).not.toErrorDev();
    });

    it('should not fail on null values', () => {
      let setProps!: (newProps: TestProps) => void;

      const s1 = null;
      const s2 = undefined;

      expect(() => {
        ({ setProps } = renderTestComponent({ defaultValue: s1 }));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: s2 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );

      expect(() => {
        setProps({ defaultValue: s1 });
      }).not.toErrorDev();
    });
  });
});
