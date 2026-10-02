import { expect, vi, describe, it } from 'vitest';
import { SolidStore } from './SolidStoreV2';

type State = { value: number; label: string };

/**
 * Solid: SolidStore has no `subscribe()`. `observe` with a snapshot selector runs the listener
 * once per committed write with the new state, as `Store.subscribe` does; its initial call is
 * dropped.
 */
function subscribe<S extends object>(store: SolidStore<S>, listener: (state: S) => void) {
  let initialized = false;
  const unsubscribe = store.observe(
    (state: S) => ({ ...state }),
    (state: S) => {
      if (initialized) {
        listener(state);
      }
    },
  );
  initialized = true;
  return unsubscribe;
}

describe('Store', () => {
  describe('Store.create', () => {
    it('returns a Store instance seeded with the given state', () => {
      const store = SolidStore({ value: 1, label: 'a' });

      expect(store.state).toEqual({ value: 1, label: 'a' });
    });

    it('produces an independent instance per call', () => {
      const first = SolidStore({ value: 0 });
      const second = SolidStore({ value: 0 });

      first.set('value', 1);

      expect(first.state.value).toBe(1);
      expect(second.state.value).toBe(0);
    });

    // Solid: SolidStore is a factory; stores extend it by composition (e.g. MenuStore), not subclassing.
    it.skip('constructs an instance of the subclass it is called on', () => {});
  });

  it('notifies subscribers with the new state', () => {
    const store = SolidStore<State>({ value: 0, label: 'a' });
    const listener = vi.fn();
    subscribe(store, listener);

    store.setState({ value: 1, label: 'a' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 1, label: 'a' });
    expect(store.state.value).toBe(1);
  });

  it('does not notify when setState receives the current state reference', () => {
    const store = SolidStore<State>({ value: 0, label: 'a' });
    const listener = vi.fn();
    subscribe(store, listener);

    store.setState(store.state);

    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribing stops notifications', () => {
    const store = SolidStore<State>({ value: 0, label: 'a' });
    const listener = vi.fn();
    const unsubscribe = subscribe(store, listener);

    unsubscribe();
    store.set('value', 1);

    expect(listener).not.toHaveBeenCalled();
  });

  it('set() writes a single key and skips same-value writes', () => {
    const store = SolidStore<State>({ value: 0, label: 'a' });
    const listener = vi.fn();
    subscribe(store, listener);

    store.set('value', 1);
    expect(store.state).toEqual({ value: 1, label: 'a' });
    expect(listener).toHaveBeenCalledTimes(1);

    store.set('value', 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('update() merges changed keys and skips no-op updates', () => {
    const store = SolidStore<State>({ value: 0, label: 'a' });
    const listener = vi.fn();
    subscribe(store, listener);

    store.update({ value: 2, label: 'b' });
    expect(store.state).toEqual({ value: 2, label: 'b' });
    expect(listener).toHaveBeenCalledTimes(1);

    store.update({ value: 2, label: 'b' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // Solid: the state proxy keeps its identity and nested stores are tracked directly, so there is no `notifyAll()`.
  it.skip('notifyAll() renews the state reference and notifies', () => {});
  it('a nested setState from a listener stops the outer notification pass', () => {
    const store = SolidStore<State>({ value: 0, label: 'a' });

    const first = vi.fn((state: State) => {
      if (state.value === 1) {
        store.set('value', 2);
      }
    });
    const second = vi.fn();
    subscribe(store, first);
    subscribe(store, second);

    store.set('value', 1);

    // The nested set() notified every listener with the final state; the outer
    // pass detected it and did not deliver the stale state to `second`.
    expect(store.state.value).toBe(2);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith({ value: 2, label: 'a' });
  });
});
