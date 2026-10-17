/*
 * A store key's signal is created when something subscribes to it or writes it, not on an
 * untracked read: a closed popup root binds about 20 keys at mount that nothing reads until it
 * opens, and creating a signal for each (to read the value it held before binding) made 79% of a
 * closed Menu root's store signals ones nobody ever subscribed to.
 */
import { DEV, createMemo, createRoot, createSignal, flush, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { SolidStore } from './SolidStoreV2';

type Hooks = { onGraph?: (() => void) | undefined };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let created = 0;
const counting = () => {
  created += 1;
};

afterEach(() => {
  hooks.onGraph = undefined;
});

function inRoot<T>(setup: () => T): [T, () => void] {
  let value!: T;
  const dispose = createRoot((d) => {
    value = setup();
    return d;
  });
  return [value, dispose];
}

describe('SolidStore signals', () => {
  it('binding a key creates no signal until something reads it', () => {
    const store = SolidStore({ open: false, label: 'a' });
    const [source] = createSignal(true);
    const [, dispose] = inRoot(() => {
      created = 0;
      hooks.onGraph = counting;
      store.useSyncedValue('open', source);
      hooks.onGraph = undefined;
    });
    expect(created).toBe(0);
    dispose();
  });

  it('unbinding a key nothing read creates no signal and keeps its last value', () => {
    // Unmounting 500 closed Menu roots unbound about 20 keys each; creating a signal for each to
    // hold its last value made unmount 7% slower than before slots were lazy.
    const store = SolidStore({ open: false, label: 'a' });
    const [source] = createSignal(true);
    const [, dispose] = inRoot(() => store.useSyncedValue('open', source));
    created = 0;
    hooks.onGraph = counting;
    dispose();
    flush();
    hooks.onGraph = undefined;
    expect(created).toBe(0);
    expect(untrack(() => store.state.open)).toBe(true);
    // A reader after the unbind subscribes to the kept value.
    const [read, disposeRead] = inRoot(() => createMemo(() => store.state.open));
    expect(read()).toBe(true);
    store.set('open', false);
    flush();
    expect(read()).toBe(false);
    disposeRead();
  });

  it('an untracked read of a key nothing subscribes to returns its value and creates no signal', () => {
    const store = SolidStore({ open: false, label: 'a' });
    created = 0;
    hooks.onGraph = counting;
    const value = untrack(() => store.state.label);
    hooks.onGraph = undefined;
    expect(value).toBe('a');
    expect(created).toBe(0);
  });

  it('the first derivation still sees the value from before binding, including one set earlier', () => {
    const store = SolidStore({ count: 1 });
    store.set('count', 5);
    flush();
    const [source] = createSignal(0);
    const [count, dispose] = inRoot((): Accessor<number> => {
      store.useSyncedValue('count', (prev: number) => prev + source());
      return createMemo(() => store.state.count);
    });
    expect(count()).toBe(5);
    dispose();
  });

  it('an untracked read sees the latest write, with or without a slot; a tracked read the committed value', () => {
    const store = SolidStore({ count: 1, label: 'a' });
    // A key with no slot: the write wins over the initial value at once.
    store.set('label', 'b');
    expect(untrack(() => store.state.label)).toBe('b');

    const [count, dispose] = inRoot((): Accessor<number> => createMemo(() => store.state.count));
    expect(count()).toBe(1);
    store.set('count', 2);
    // Pending until the flush: the imperative read sees the write, the subscriber the commit.
    expect(untrack(() => store.state.count)).toBe(2);
    expect(count()).toBe(1);
    flush();
    expect(count()).toBe(2);
    dispose();
  });

  it('repeated untracked reads of a bound key run its derivation once', () => {
    const store = SolidStore({ count: 1 });
    const [source] = createSignal(3);
    let derivations = 0;
    const [, dispose] = inRoot(() => {
      store.useSyncedValue('count', () => {
        derivations += 1;
        return source();
      });
    });
    expect([0, 1, 2].map(() => untrack(() => store.state.count))).toEqual([3, 3, 3]);
    expect(derivations).toBe(1);
    dispose();
  });

  it('a tracked read after binding follows the derived value', () => {
    const store = SolidStore({ open: false });
    const [source, setSource] = createSignal(false);
    const [open, dispose] = inRoot((): Accessor<boolean> => {
      store.useSyncedValue('open', source);
      return createMemo(() => store.state.open);
    });
    expect(open()).toBe(false);
    setSource(true);
    flush();
    expect(open()).toBe(true);
    dispose();
  });
});
