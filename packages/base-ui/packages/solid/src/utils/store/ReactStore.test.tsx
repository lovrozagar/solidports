import { expect, describe, it } from 'vitest';
import { createSignal, onSettled, Show } from 'solid-js';
import { act, createRenderer } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import { access, type MaybeAccessor } from '../../solid-helpers';
import { createStore } from '../../solid-1-compat';
import { SolidStore } from './SolidStoreV2';

type TestState = { value: number; label: string };

describe('ReactStore', () => {
  const { render } = createRenderer();

  it('create() constructs a fully wired ReactStore instance', () => {
    const store = SolidStore({ value: 1, label: 'a' });

    expect(store.state.value).toBe(1);
    expect(store.context).toEqual({});
  });

  it('syncs internal state from controlled prop', () => {
    let store!: SolidStore<TestState>;

    function Test(props: { controlled: number | undefined }) {
      store = SolidStore<TestState>({ value: 0, label: '' });
      store.useControlledProp('value', () => props.controlled);
      return null;
    }

    const [controlled, setControlled] = createSignal<number | undefined>(1);
    render(() => <Test controlled={controlled()} />);
    expect(store.state.value).toBe(1);

    act(() => {
      store.update({ label: 'y' });
    });
    // Non-controlled keys still update
    expect(store.state.label).toBe('y');

    // Changing the controlled prop updates internal state
    act(() => {
      setControlled(7);
    });
    expect(store.state.value).toBe(7);
  });

  it('syncs internal state from controlled prop when the store changes', () => {
    const firstStore = SolidStore<TestState>({ value: 0, label: '' });
    const secondStore = SolidStore<TestState>({ value: 0, label: '' });

    function Test(props: { store: SolidStore<TestState> }) {
      props.store.useControlledProp('value', 1);
      return null;
    }

    // Solid: a component body runs once, so a new store instance re-creates the owner (keyed).
    const [store, setStore] = createSignal(firstStore);
    render(() => (
      <Show when={store()} keyed>
        {(current) => <Test store={current} />}
      </Show>
    ));
    expect(firstStore.state.value).toBe(1);
    expect(secondStore.state.value).toBe(0);

    act(() => setStore(secondStore));
    expect(secondStore.state.value).toBe(1);
  });

  it('warns on switching from uncontrolled to controlled', () => {
    function Test(props: { controlled?: number }) {
      const store = SolidStore<TestState>({ value: 0, label: '' });
      store.useControlledProp('value', () => props.controlled);
      return null;
    }

    const [controlled, setControlled] = createSignal<number>();
    render(() => <Test controlled={controlled()} />);

    // Solid: no StrictMode double render, so the warning is logged once.
    expect(() => {
      act(() => setControlled(1));
    }).toErrorDev([
      'A component is changing the controlled state of value to be uncontrolled. Elements should not switch from uncontrolled to controlled (or vice versa).',
    ]);
  });

  it('warns on switching from controlled to uncontrolled', () => {
    function Test(props: { controlled?: number }) {
      const store = SolidStore<TestState>({ value: 0, label: '' });
      store.useControlledProp('value', () => props.controlled);
      return null;
    }

    const [controlled, setControlled] = createSignal<number | undefined>(1);
    render(() => <Test controlled={controlled()} />);

    expect(() => {
      act(() => setControlled(undefined));
    }).toErrorDev([
      'A component is changing the uncontrolled state of value to be controlled. Elements should not switch from uncontrolled to controlled (or vice versa).',
    ]);
  });

  it('useProp updates a single key when the passed value changes', () => {
    let store!: SolidStore<TestState>;

    function Test(props: { value: number }) {
      store = SolidStore<TestState>({ value: 0, label: '' });
      store.useSyncedValue('value', () => props.value);
      return null;
    }

    const [value, setValue] = createSignal(1);
    render(() => <Test value={value()} />);
    expect(store.state.value).toBe(1);

    act(() => setValue(2));
    expect(store.state.value).toBe(2);
  });

  it('useProp syncs the same value when the store changes', () => {
    const firstStore = SolidStore<TestState>({ value: 0, label: '' });
    const secondStore = SolidStore<TestState>({ value: 0, label: '' });

    function Test(props: { store: SolidStore<TestState> }) {
      props.store.useSyncedValue('value', () => 1);
      return null;
    }

    // Solid: a component body runs once, so a new store instance re-creates the owner (keyed).
    const [store, setStore] = createSignal(firstStore);
    render(() => (
      <Show when={store()} keyed>
        {(current) => <Test store={current} />}
      </Show>
    ));
    expect(firstStore.state.value).toBe(1);
    expect(secondStore.state.value).toBe(0);

    act(() => setStore(secondStore));
    expect(secondStore.state.value).toBe(1);
  });

  it('useProps applies multiple keys from a props object', () => {
    let store!: SolidStore<TestState>;

    function Test(props: { props: TestState }) {
      store = SolidStore<TestState>({ value: 0, label: '' });
      store.useSyncedValues(() => props.props);
      return null;
    }

    const [props, setProps] = createSignal({ value: 5, label: 'a' });
    render(() => <Test props={props()} />);
    expect(store.state.value).toBe(5);
    expect(store.state.label).toBe('a');

    act(() => setProps({ value: 6, label: 'b' }));
    expect(store.state.value).toBe(6);
    expect(store.state.label).toBe('b');
  });
  it('useSyncedValues depends on entries instead of object identity', () => {
    let store!: SolidStore<TestState>;
    let updateCalls = 0;

    // Solid: useSyncedValues writes through the store setter, so the spy wraps the setter.
    const [internalStore, setInternalStore] = createStore<TestState>({ value: 0, label: '' });
    const setState: typeof setInternalStore = ((...args: unknown[]) => {
      updateCalls += 1;
      return (setInternalStore as (...setterArgs: unknown[]) => void)(...args);
    }) as typeof setInternalStore;

    function Test(props: { props: TestState }) {
      store = SolidStore<TestState>([internalStore, setState]);
      store.useSyncedValues(() => props.props);
      return null;
    }

    const [props, setProps] = createSignal({ value: 5, label: 'a' });
    render(() => <Test props={props()} />);

    expect(updateCalls).toBe(1);

    act(() => {
      setProps({ value: 5, label: 'a' });
    });

    expect(updateCalls).toBe(1);

    act(() => {
      setProps({ value: 6, label: 'a' });
    });

    expect(updateCalls).toBe(2);
    expect(store.state.value).toBe(6);
  });

  it('warns if useSyncedValues keys change between renders', () => {
    function Test(props: { props: Partial<TestState> }) {
      const store = SolidStore<TestState>({ value: 0, label: '' });
      // This intentionally violates the stable-key contract to verify the development warning.
      store.useSyncedValues(() => props.props);
      return null;
    }

    const [props, setProps] = createSignal<Partial<TestState>>({ value: 1 });
    render(() => <Test props={props()} />);

    expect(() => {
      act(() => {
        setProps({ label: 'x' });
      });
    }).toErrorDev([
      'SolidStore.useSyncedValues expects the same prop keys on every render. Keys should be stable.',
    ]);
  });

  it('useSyncedValueWithCleanup synchronizes value and resets on cleanup', () => {
    type CleanupState = { node: HTMLDivElement | undefined };
    let store!: SolidStore<CleanupState>;

    const firstNode = document.createElement('div');
    const secondNode = document.createElement('div');

    function Test(props: { node: HTMLDivElement | undefined }) {
      store = SolidStore<CleanupState>({ node: undefined });
      store.useSyncedValueWithCleanup('node', () => props.node);
      return null;
    }

    const [node, setNode] = createSignal<HTMLDivElement | undefined>(firstNode);
    const { unmount } = render(() => <Test node={node()} />);
    expect(store.state.node).toBe(firstNode);

    act(() => {
      setNode(secondNode);
    });
    expect(store.state.node).toBe(secondNode);

    act(() => {
      unmount();
    });
    expect(store.state.node).toBe(undefined);
  });

  it('useStateSetter returns a stable callback that updates the store state', () => {
    type ElementState = { element: HTMLDivElement | null };
    let store!: SolidStore<ElementState>;
    let lastSetter!: (element: HTMLDivElement | null) => void;

    const element = document.createElement('div');

    // Solid: the component body runs once, so the setter is created once; there is no re-render
    // to compare identities across.
    function Test() {
      store = SolidStore<ElementState>({ element: null });
      const setter = store.useStateSetter('element');
      lastSetter = setter;

      onSettled(() => {
        setter(element);
      });

      return null;
    }

    render(() => <Test />);
    expect(store.state.element).toBe(element);

    act(() => {
      lastSetter(null);
    });

    expect(store.state.element).toBe(null);
  });

  it('supports nested stores as state values', async () => {
    type ParentState = { count: number };
    const parentSelectors = { count: (state: ParentState) => state.count };
    type ParentStore = SolidStore<ParentState, Record<string, never>, typeof parentSelectors>;
    type ChildState = { count: number; parent?: ParentStore };

    const childSelectors = {
      count: (state: ChildState) => state.parent?.state.count ?? state.count,
      parent: (state: ChildState) => state.parent,
    };

    const localCountSelector = (state: ChildState) => state.count;

    const parentStore = SolidStore<ParentState, Record<string, never>, typeof parentSelectors>(
      { count: 0 },
      undefined,
      parentSelectors,
    );

    const childStore = SolidStore<ChildState, Record<string, never>, typeof childSelectors>(
      { count: 10 },
      undefined,
      childSelectors,
    );

    // Solid: tracked reads subscribe to the nested store directly, so the child needs no
    // `parent.subscribe(() => store.notifyAll())` bridge.
    const onCountUpdated = (newCount: number) => {
      childStore.state.parent?.set('count', newCount);
    };

    childStore.observe(localCountSelector, onCountUpdated);

    function Test() {
      const count = childStore.useState('count');
      return <output data-testid="output">{count()}</output>;
    }

    render(() => <Test />);
    const output = screen.getByTestId('output');

    await act(async () => {
      childStore.set('count', 5);
    });
    expect(childStore.state.count).toBe(5);
    expect(output.textContent).toBe('5');

    await act(async () => {
      childStore.set('parent', parentStore);
    });
    expect(childStore.state.count).toBe(5);
    expect(childStore.select('count')).toBe(0);
    expect(output.textContent).toBe('0');

    await act(async () => {
      childStore.set('count', 20);
    });
    expect(childStore.state.count).toBe(20);
    expect(parentStore.state.count).toBe(20);
    expect(childStore.select('count')).toBe(20);
    expect(output.textContent).toBe('20');

    await act(async () => {
      parentStore.set('count', 15);
    });
    expect(parentStore.state.count).toBe(15);
    expect(childStore.state.count).toBe(20);
    expect(childStore.select('count')).toBe(15);
    expect(output.textContent).toBe('15');
  });

  it('updates useState result when selector arguments change in a fast component', () => {
    type State = { values: Record<string, string> };
    // Solid: selector arguments are accessors, read inside the tracked selector.
    const selectors = {
      valueByKey: (state: State, valueKey: MaybeAccessor<string>) => state.values[access(valueKey)],
    };
    const store = SolidStore<State, {}, typeof selectors>(
      { values: { first: 'one', second: 'two', third: 'three' } },
      undefined,
      selectors,
    );

    function Test(props: { valueKey: string }) {
      const value = store.useState('valueByKey', () => props.valueKey);
      return <output data-testid="output">{value()}</output>;
    }

    const [valueKey, setValueKey] = createSignal('first');
    render(() => <Test valueKey={valueKey()} />);
    const output = screen.getByTestId('output');

    expect(output.textContent).toBe('one');

    act(() => {
      setValueKey('second');
    });

    expect(output.textContent).toBe('two');
  });

  // Solid: React Store semantics, `set(key, fn)` stores the function and selectors return it as is.
  it('does not invoke function-valued selector results', () => {
    type FunctionState = {
      comparer: (a: string, b: string) => boolean;
    };

    const equalsIgnoreCase = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const selectors = {
      comparer: (state: FunctionState) => state.comparer,
    };

    const store = SolidStore<FunctionState, Record<string, never>, typeof selectors>(
      { comparer: equalsIgnoreCase },
      undefined,
      selectors,
    );

    expect(store.select('comparer')).toBe(equalsIgnoreCase);
    expect(store.useState('comparer')()).toBe(equalsIgnoreCase);
    expect(store.select('comparer')('A', 'a')).toBe(true);
  });

  describe('observeSelector', () => {
    type CounterState = { count: number; multiplier: number };
    const selectors = {
      count: (state: CounterState) => state.count,
      doubled: (state: CounterState) => state.count * 2,
      multiplied: (state: CounterState) => state.count * state.multiplier,
    };

    it('accepts selector functions', () => {
      const store = SolidStore<CounterState>({ count: 0, multiplier: 1 });
      const calls: Array<{ newValue: boolean; oldValue: boolean }> = [];

      const unsubscribe = store.observe(
        (state) => state.count > 1,
        (newValue, oldValue) => {
          calls.push({ newValue, oldValue });
        },
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ newValue: false, oldValue: false });

      store.set('count', 2);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual({ newValue: true, oldValue: false });

      store.set('count', 1);
      expect(calls).toHaveLength(3);
      expect(calls[2]).toEqual({ newValue: false, oldValue: true });

      unsubscribe();

      store.set('count', 3);
      expect(calls).toHaveLength(3);
    });

    it('calls listener immediately with current selector result on subscription', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const calls: Array<{ newValue: number; oldValue: number }> = [];

      store.observe('doubled', (newValue: number, oldValue: number) => {
        calls.push({ newValue, oldValue });
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ newValue: 10, oldValue: 10 });
    });

    it('calls listener when selector result changes', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const calls: Array<{ newValue: number; oldValue: number }> = [];

      store.observe('doubled', (newValue: number, oldValue: number) => {
        calls.push({ newValue, oldValue });
      });

      store.set('count', 10);
      store.set('count', 7);

      expect(calls).toHaveLength(3);
      expect(calls[1]).toEqual({ newValue: 20, oldValue: 10 });
      expect(calls[2]).toEqual({ newValue: 14, oldValue: 20 });
    });

    it('does not call listener when selector result is unchanged', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const calls: Array<{ newValue: number; oldValue: number }> = [];

      store.observe('doubled', (newValue: number, oldValue: number) => {
        calls.push({ newValue, oldValue });
      });

      store.set('multiplier', 5);

      expect(calls).toHaveLength(1); // Only initial call
    });

    it('calls listener when any dependency of the selector changes', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const calls: Array<{ newValue: number; oldValue: number }> = [];

      store.observe('multiplied', (newValue: number, oldValue: number) => {
        calls.push({ newValue, oldValue });
      });

      store.set('count', 10);
      store.set('multiplier', 2);

      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual({ newValue: 15, oldValue: 15 });
      expect(calls[1]).toEqual({ newValue: 30, oldValue: 15 });
      expect(calls[2]).toEqual({ newValue: 20, oldValue: 30 });
    });
    it('provides the store instance to the listener', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      let receivedStore: unknown;

      store.observe('doubled', (_: number, __: number, storeArg) => {
        receivedStore = storeArg;
      });

      expect(receivedStore).toBe(store);
    });

    it('returns an unsubscribe function that stops observing', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const calls: Array<{ newValue: number; oldValue: number }> = [];

      const unsubscribe = store.observe('doubled', (newValue: number, oldValue: number) => {
        calls.push({ newValue, oldValue });
      });

      store.set('count', 10);
      expect(calls).toHaveLength(2);

      unsubscribe();

      store.set('count', 15);
      expect(calls).toHaveLength(2); // No new calls after unsubscribe
    });

    it('supports multiple observers on the same selector', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const calls1: number[] = [];
      const calls2: number[] = [];

      store.observe('doubled', (newValue: number) => {
        calls1.push(newValue);
      });

      store.observe('doubled', (newValue: number) => {
        calls2.push(newValue);
      });

      store.set('count', 10);

      expect(calls1).toEqual([10, 20]);
      expect(calls2).toEqual([10, 20]);
    });

    it('supports observers on different selectors', () => {
      const store = SolidStore<CounterState, Record<string, never>, typeof selectors>(
        { count: 5, multiplier: 3 },
        undefined,
        selectors,
      );
      const doubledCalls: number[] = [];
      const multipliedCalls: number[] = [];

      store.observe('doubled', (newValue: number) => {
        doubledCalls.push(newValue);
      });

      store.observe('multiplied', (newValue: number) => {
        multipliedCalls.push(newValue);
      });

      store.set('count', 10);
      store.set('multiplier', 2);

      expect(doubledCalls).toEqual([10, 20]);
      expect(multipliedCalls).toEqual([15, 30, 20]);
    });
  });
});
