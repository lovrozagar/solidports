import { expect, describe, it } from 'vitest';
import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { act, createRenderer } from '#test-utils';
import { usePreviousValue } from './usePreviousValue';

interface TestComponentProps {
  value: any;
  unrelatedProp?: any;
  children: (previous: any) => JSX.Element;
}

function TestComponent(props: TestComponentProps) {
  const previous = usePreviousValue(() => props.value);
  return <>{props.children(previous())}</>;
}

describe('usePrevious', () => {
  const { render } = createRenderer();

  // Solid: React's `setProps` re-renders with merged props; here a props signal that notifies on
  // every write (`equals: false`) re-renders the component the same way.
  function renderWithProps(
    initialProps: Omit<TestComponentProps, 'children'>,
    children: TestComponentProps['children'],
  ) {
    const [props, setRawProps] = createSignal(initialProps, { equals: false });
    const setPropsUnbatched = (next: Partial<Omit<TestComponentProps, 'children'>>) =>
      setRawProps((prev) => ({ ...prev, ...next }));
    render(() => (
      <TestComponent value={props().value} unrelatedProp={props().unrelatedProp}>
        {children}
      </TestComponent>
    ));
    return {
      setProps: (next: Partial<Omit<TestComponentProps, 'children'>>) =>
        act(() => setPropsUnbatched(next)),
      setPropsUnbatched,
    };
  }

  it('should return null on the first render', () => {
    let previousValue: any;
    renderWithProps({ value: 'first' }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);
  });

  it('should return the previous value on subsequent renders', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: 'first' }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ value: 'second' });
    expect(previousValue).toBe('first');

    setProps({ value: 'third' });
    expect(previousValue).toBe('second');
  });

  it('should work with primitive values', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: 42 }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ value: 100 });
    expect(previousValue).toBe(42);

    setProps({ value: true });
    expect(previousValue).toBe(100);

    setProps({ value: false });
    expect(previousValue).toBe(true);
  });

  it('should treat NaN as unchanged', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: Number.NaN }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ value: Number.NaN, unrelatedProp: 1 });
    expect(previousValue).toBe(null);
  });

  it('should return the previous value when changing to NaN', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: 1 }, (previous) => {
      previousValue = previous;
      return null;
    });

    setProps({ value: Number.NaN });
    expect(previousValue).toBe(1);
  });

  it('should distinguish positive and negative zero', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: 0 }, (previous) => {
      previousValue = previous;
      return null;
    });

    setProps({ value: -0 });
    expect(previousValue).toBe(0);

    setProps({ value: 0 });
    expect(previousValue).toBe(-0);
  });

  it('should ignore renders where the value does not change', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: 'stable' }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ unrelatedProp: 1 });
    expect(previousValue).toBe(null);

    setProps({ unrelatedProp: 2 });
    expect(previousValue).toBe(null);
  });

  it('should work with object values', () => {
    let previousValue: any;
    const obj1 = { a: 1 };
    const obj2 = { b: 2 };
    const obj3 = { c: 3 };

    const { setProps } = renderWithProps({ value: obj1 }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ value: obj2 });
    expect(previousValue).toBe(obj1);

    setProps({ value: obj3 });
    expect(previousValue).toBe(obj2);
  });

  it('should handle undefined and null values', () => {
    let previousValue: any;
    const { setProps } = renderWithProps({ value: undefined }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ value: null });
    expect(previousValue).toBe(undefined);

    setProps({ value: 'defined' });
    expect(previousValue).toBe(null);

    setProps({ value: undefined });
    expect(previousValue).toBe('defined');
  });

  it('should handle rapid value changes', () => {
    let previousValue: any;
    const { setPropsUnbatched } = renderWithProps({ value: 'initial' }, (previous) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    act(() => {
      setPropsUnbatched({ value: 'first' });
      setPropsUnbatched({ value: 'second' });
      setPropsUnbatched({ value: 'third' });
    });

    // With Solid batching, only the final value 'third' is applied at the flush,
    // so the previous value should be 'initial' (from the first render)
    expect(previousValue).toBe('initial');
  });

  it('should maintain type safety', () => {
    let previousValue: string | null = null;
    const { setProps } = renderWithProps({ value: 'hello' }, (previous: string | null) => {
      previousValue = previous;
      return null;
    });

    expect(previousValue).toBe(null);

    setProps({ value: 'world' });
    expect(previousValue).toBe('hello');
    expect(typeof previousValue).toBe('string');
  });
});
