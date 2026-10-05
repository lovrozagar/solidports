import { act, createRenderer } from '#test-utils';
import { createRoot, createSignal, flush, untrack } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { SolidStore } from './SolidStoreV2';

type TestContext = {
  onChange: ((...args: any[]) => void) | undefined;
};

type TestState = { value: number };

describe('SolidStore.useContextCallback', () => {
  const { render } = createRenderer();

  it('reads the latest signal-backed callback on each invocation', () => {
    let counter = 0;
    const v1 = () => {
      counter += 1;
    };
    const v2 = () => {
      counter += 100;
    };

    // The store and signal live in a root; writes and calls happen outside it, as in an app.
    const { dispose, store, setFn } = createRoot((d) => {
      const rootStore = SolidStore<TestState, TestContext>({ value: 0 }, { onChange: undefined });
      const [fn, setFnSignal] = createSignal<() => void>(() => v1);
      rootStore.useContextCallback('onChange', () => fn()());
      return { dispose: d, store: rootStore, setFn: setFnSignal };
    });

    store.context.onChange?.();
    expect(counter).toBe(1);

    act(() => setFn(() => v2));

    store.context.onChange?.();
    /* stale closure would give 2; live read gives 101 */
    expect(counter).toBe(101);

    dispose();
  });

  it('handles undefined callback (NOOP fallback)', () => {
    let dispose!: () => void;

    createRoot((d) => {
      dispose = d;

      const store = SolidStore<TestState, TestContext>({ value: 0 }, { onChange: undefined });

      store.useContextCallback('onChange', undefined);

      expect(() => store.context.onChange?.()).not.toThrow();
    });

    dispose();
  });

  it('invokes the most recently registered wrapper after re-registration', () => {
    let dispose!: () => void;

    createRoot((d) => {
      dispose = d;

      const store = SolidStore<TestState, TestContext>({ value: 0 }, { onChange: undefined });

      const calls: string[] = [];

      store.useContextCallback('onChange', () => calls.push('first'));
      store.context.onChange?.();
      expect(calls).toEqual(['first']);

      store.useContextCallback('onChange', () => calls.push('second'));
      store.context.onChange?.();
      expect(calls).toEqual(['first', 'second']);
    });

    dispose();
  });

  it('callback receives forwarded arguments', () => {
    let dispose!: () => void;

    createRoot((d) => {
      dispose = d;

      type ArgsContext = { onAction: ((x: number, y: string) => void) | undefined };

      const store = SolidStore<TestState, ArgsContext>({ value: 0 }, { onAction: undefined });

      const received: [number, string][] = [];
      store.useContextCallback('onAction', (x, y) => received.push([x, y]));

      store.context.onAction?.(42, 'hello');
      expect(received).toEqual([[42, 'hello']]);
    });

    dispose();
  });

  it('integrates with a rendered component — callback swap is live', () => {
    const calls: string[] = [];

    function TestComponent(props: { label: string }) {
      const store = SolidStore<TestState, TestContext>({ value: 0 }, { onChange: undefined });

      store.useContextCallback('onChange', () => calls.push(props.label));

      // Called while rendering, as in React: a component body reads untracked.
      untrack(() => store.context.onChange?.());

      return null;
    }

    const [label] = createSignal('initial');
    render(() => <TestComponent label={label()} />);

    expect(calls).toContain('initial');
  });
});

describe('SolidStore lazy observe notifiers', () => {
  it('notifies a listener that subscribes after a key was bound when the derived value changes', () => {
    const seen: number[] = [];
    const { dispose, setSource, store } = createRoot((d) => {
      const rootStore = SolidStore<TestState, TestContext>({ value: 0 }, { onChange: undefined });
      const [source, setSourceSignal] = createSignal(1);
      rootStore.useSyncedValue('value', source);
      return { dispose: d, setSource: setSourceSignal, store: rootStore };
    });
    flush();

    const unsubscribe = store.observe(
      (state) => state.value,
      (next) => {
        seen.push(next);
      },
    );
    setSource(2);
    flush();
    setSource(3);
    flush();

    expect(seen).toEqual([1, 2, 3]);
    unsubscribe();
    dispose();
  });
});
