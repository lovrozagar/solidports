/*
 * Keyed selectors (plan 3, leaf 4.4b). A selector declared with `keyedSelector` answers "is `id`
 * the store's current one": a tracked `select` of it subscribes the reader to its own id only, so
 * when the current one moves, two readers re-run (the old and the new), not every reader. 100
 * detached Tooltip triggers re-ran four selector reads each on every hover move. A selector of the
 * same shape that is not declared keyed keeps today's behavior, read in the caller's scope.
 */
import {
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  flush,
  getOwner,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { keyedSelector, SolidStore } from './SolidStoreV2';

interface State {
  active: string | undefined;
  open: boolean;
}

const selectors = {
  isActive: keyedSelector((state: State) => state.active),
  isOpenedBy: keyedSelector((state: State) => (state.open ? state.active : undefined)),
  isActivePlain: (state: State, id: Accessor<string | undefined>) =>
    id() !== undefined && state.active === id(),
};

function inRoot<T>(setup: () => T): [T, () => void] {
  let value!: T;
  const dispose = createRoot((d) => {
    value = setup();
    return d;
  });
  return [value, dispose];
}

/** 100 readers of `selector` for ids `0`…`99`, each counting its runs. */
function readers(store: ReturnType<typeof makeStore>, selector: keyof typeof selectors) {
  const runs = Array.from({ length: 100 }, () => 0);
  const [memos, dispose] = inRoot(() =>
    runs.map((_, index) => {
      const id = () => String(index);
      return createMemo(() => {
        runs[index] += 1;
        return store.select(selector, id);
      });
    }),
  );
  memos.forEach((memo) => memo());
  return { runs, memos, dispose };
}

const makeStore = () =>
  SolidStore<State, {}, typeof selectors>({ active: '0', open: true }, {}, selectors);

describe('SolidStore keyed selectors', () => {
  it('a keyed selector re-runs only the readers of the old and the new id', () => {
    const store = makeStore();
    const { runs, memos, dispose } = readers(store, 'isActive');
    const before = runs.reduce((a, b) => a + b, 0);
    store.set('active', '5');
    flush();
    memos.forEach((memo) => memo());
    expect(runs.reduce((a, b) => a + b, 0) - before).toBe(2);
    expect(memos.map((memo) => memo()).filter(Boolean).length).toBe(1);
    expect(memos[5]()).toBe(true);
    dispose();
  });

  it('a selector of the same shape not declared keyed re-runs every reader, exactly as before', () => {
    const store = makeStore();
    const { runs, memos, dispose } = readers(store, 'isActivePlain');
    const before = runs.reduce((a, b) => a + b, 0);
    store.set('active', '5');
    flush();
    memos.forEach((memo) => memo());
    expect(runs.reduce((a, b) => a + b, 0) - before).toBe(100);
    expect(memos[5]()).toBe(true);
    dispose();
  });

  it('follows the gating state: closing makes no id the one that opened it', () => {
    const store = makeStore();
    const { memos, dispose } = readers(store, 'isOpenedBy');
    expect(memos[0]()).toBe(true);
    store.set('open', false);
    flush();
    expect(memos.some((memo) => memo())).toBe(false);
    store.set('open', true);
    flush();
    expect(memos[0]()).toBe(true);
    dispose();
  });

  it('an undefined id is never the current one, and a reader follows its own id changing', () => {
    const store = makeStore();
    const [id, setId] = createSignal<string | undefined>(undefined);
    const [read, dispose] = inRoot(() => createMemo(() => store.select('isActive', id)));
    expect(read()).toBe(false);
    setId('0');
    flush();
    expect(read()).toBe(true);
    setId('1');
    flush();
    expect(read()).toBe(false);
    dispose();
  });

  it('a store created outside any owner (a detached handle) is first read inside an effect callback', () => {
    const store = makeStore();
    const seen: boolean[] = [];
    const [, dispose] = inRoot(() => {
      const owner = getOwner();
      createEffect(
        () => store.state.open,
        () => {
          const read = runWithOwner(owner, () =>
            createMemo(() => store.select('isActive', () => '0')),
          );
          seen.push(untrack(read));
        },
      );
    });
    flush();
    expect(seen).toEqual([true]);
    dispose();
  });

  it('an untracked read computes directly from the latest state', () => {
    const store = makeStore();
    store.set('active', '7');
    expect(untrack(() => store.select('isActive', () => '7'))).toBe(true);
    expect(untrack(() => store.select('isActive', () => '0'))).toBe(false);
  });
});
