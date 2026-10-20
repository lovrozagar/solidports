/*
 * A keyed selector whose key reads a store key that changes with no write (a bound key or a
 * getter): no commit pushes that change, so the selector takes the projection, which follows any
 * source in the flush that changes it. The Chromium suites caught the relay this left: a popup's
 * trigger selectors read `triggerIdProp`, bound to the prop, and Menu's `activeIndex` is bound to
 * null while closed. Dev builds report a pushed selector that reads such a key after all: through a
 * branch its creation did not take, or a binding made after it.
 */
import { createMemo, createRoot, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { idSelectorRelays } from '../createIdSelector';
import { SolidStore, keyedSelector } from './SolidStoreV2';

interface State {
  prop: string | null;
  own: string | null;
}

type TestStore = {
  useState(key: string, id: () => string): () => unknown;
  useSyncedValue(key: keyof State, value: () => string | null): void;
  set(key: keyof State, value: string | null): void;
};

function mount(
  key: (state: State) => unknown,
  initial: State,
  bind: (store: TestStore) => void,
  bindAfter?: (store: TestStore) => void,
) {
  const reads: (() => unknown)[] = [];
  let store!: TestStore;
  const dispose = createRoot((disposeRoot) => {
    store = SolidStore(initial, {}, { isActive: keyedSelector(key) }) as unknown as TestStore;
    bind(store);
    for (const id of ['a', 'b', 'c']) {
      const active = store.useState('isActive', () => id);
      reads.push(createMemo(() => active()));
    }
    bindAfter?.(store);
    flush();
    return disposeRoot;
  });
  return { store, read: () => reads.map((r) => r()), dispose };
}

describe('keyed selectors over keys that change with no write', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    idSelectorRelays.writes = 0;
  });

  it('a key read through a bound key follows the binding with no catch-all write', () => {
    idSelectorRelays.writes = 0;
    const [prop, setProp] = createSignal<string | null>('a');
    const { read, dispose } = mount(
      (state) => state.prop ?? state.own,
      { prop: null, own: null },
      (store) => store.useSyncedValue('prop', prop),
    );
    expect(read()).toEqual([true, false, false]);
    setProp('b');
    flush();
    expect(read()).toEqual([false, true, false]);
    setProp(null);
    flush();
    expect(read()).toEqual([false, false, false]);
    expect(idSelectorRelays.writes).toBe(0);
    dispose();
  });

  it('dev: a pushed selector that reaches a bound key through a later branch is reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [prop] = createSignal<string | null>('b');
    // Created while `own` is set: the probe reads `own` only, so the selector is pushed.
    const { store, dispose } = mount(
      (state) => state.own ?? state.prop,
      { prop: null, own: 'a' },
      (s) => s.useSyncedValue('prop', prop),
    );
    expect(error).not.toHaveBeenCalled();
    store.set('own', null);
    flush();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Base UI: a keyed store selector reads "prop"'));
    idSelectorRelays.writes = 0;
    dispose();
  });

  it('dev: a key bound after a pushed selector read it is reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [own] = createSignal<string | null>('a');
    const { dispose } = mount(
      (state) => state.own,
      { prop: null, own: 'a' },
      () => {},
      (store) => store.useSyncedValue('own', own),
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Base UI: a keyed store selector reads "own"'));
    idSelectorRelays.writes = 0;
    dispose();
  });
});
