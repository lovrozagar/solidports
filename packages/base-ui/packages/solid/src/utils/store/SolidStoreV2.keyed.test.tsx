/*
 * Keyed selectors (plan 3, leaf 4.4b). A selector declared with `keyedSelector` answers "is `id`
 * the store's current one": a tracked `select` of it subscribes the reader to its own id only, so
 * when the current one moves, two readers re-run (the old and the new), not every reader. 100
 * detached Tooltip triggers re-ran four selector reads each on every hover move. A selector of the
 * same shape that is not declared keyed keeps today's behavior, read in the caller's scope.
 */
import {
  DEV,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  flush,
  getOwner,
  isDisposed,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor, Owner } from 'solid-js';
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
function readers(store: Store, selector: keyof typeof selectors) {
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

const createStore = () =>
  SolidStore<State, {}, typeof selectors>({ active: '0', open: true }, {}, selectors);

type Store = ReturnType<typeof createStore>;

/** A store created under a root, as a popup root creates its store. */
function ownedStore(): [Store, () => void] {
  return inRoot(createStore);
}

type Hooks = { onOwner?: ((owner: Owner) => void) | undefined };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

/** The owners `run` creates. */
function ownersCreatedBy(run: () => void) {
  const owners: Owner[] = [];
  hooks.onOwner = (owner) => owners.push(owner);
  try {
    run();
  } finally {
    hooks.onOwner = undefined;
  }
  return owners;
}

describe('SolidStore keyed selectors', () => {
  it('a keyed selector re-runs only the readers of the old and the new id', () => {
    const [store, disposeStore] = ownedStore();
    const { runs, memos, dispose } = readers(store, 'isActive');
    const before = runs.reduce((a, b) => a + b, 0);
    store.set('active', '5');
    flush();
    memos.forEach((memo) => memo());
    expect(runs.reduce((a, b) => a + b, 0) - before).toBe(2);
    expect(memos.map((memo) => memo()).filter(Boolean).length).toBe(1);
    expect(memos[5]()).toBe(true);
    dispose();
    disposeStore();
  });

  it('a selector of the same shape not declared keyed re-runs every reader, exactly as before', () => {
    const [store, disposeStore] = ownedStore();
    const { runs, memos, dispose } = readers(store, 'isActivePlain');
    const before = runs.reduce((a, b) => a + b, 0);
    store.set('active', '5');
    flush();
    memos.forEach((memo) => memo());
    expect(runs.reduce((a, b) => a + b, 0) - before).toBe(100);
    expect(memos[5]()).toBe(true);
    dispose();
    disposeStore();
  });

  it('follows the gating state: closing makes no id the one that opened it', () => {
    const [store, disposeStore] = ownedStore();
    const { memos, dispose } = readers(store, 'isOpenedBy');
    expect(memos[0]()).toBe(true);
    store.set('open', false);
    flush();
    expect(memos.some((memo) => memo())).toBe(false);
    store.set('open', true);
    flush();
    expect(memos[0]()).toBe(true);
    dispose();
    disposeStore();
  });

  it('an undefined id is never the current one, and a reader follows its own id changing', () => {
    const [store, disposeStore] = ownedStore();
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
    disposeStore();
  });

  it('a store created outside any owner reads keyed selectors directly, even from an effect callback', () => {
    // A handle's inert stand-in (`NullStore`) is created outside any owner, and a detached trigger
    // first reads it from an effect callback, where an ownerless computation is an error.
    const store = createStore();
    const createdBy = (selector: 'isActive' | 'isActivePlain') => {
      const seen: boolean[] = [];
      const [, dispose] = inRoot(() => {
        const owner = getOwner();
        createEffect(
          () => store.state.open,
          () => {
            const read = runWithOwner(owner, () =>
              createMemo(() => store.select(selector, () => '0')),
            );
            seen.push(untrack(read));
          },
        );
      });
      const owners = ownersCreatedBy(() => flush());
      dispose();
      return { seen, owners: owners.length };
    };
    const keyed = createdBy('isActive');
    expect(keyed.seen).toEqual([true]);
    expect(keyed.owners).toBe(createdBy('isActivePlain').owners);
  });

  it('what a keyed read creates outlives its reader and is disposed with the store', () => {
    // A store per mount (a popup root, or a handle created in a component) leaves nothing behind.
    for (let mount = 0; mount < 3; mount += 1) {
      const [store, disposeStore] = ownedStore();
      let dispose!: () => void;
      const owners = ownersCreatedBy(() => {
        [, dispose] = inRoot(() => createMemo(() => store.select('isActive', () => '0'))());
      });
      dispose();
      const kept = owners.filter((owner) => !isDisposed(owner));
      expect(kept.length).toBeGreaterThan(0);
      disposeStore();
      expect(kept.filter((owner) => !isDisposed(owner))).toEqual([]);
    }
  });

  it('an untracked read computes directly from the latest state', () => {
    const [store, disposeStore] = ownedStore();
    store.set('active', '7');
    expect(untrack(() => store.select('isActive', () => '7'))).toBe(true);
    expect(untrack(() => store.select('isActive', () => '0'))).toBe(false);
    disposeStore();
  });
});
