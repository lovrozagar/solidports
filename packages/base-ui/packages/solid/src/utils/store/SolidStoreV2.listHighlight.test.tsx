/*
 * Keyed highlight in the list stores (plan 3, leaf 4.9). Every Select, Combobox and Menu item reads
 * "is my index the store's active one" through its own memo. A plain selector re-runs all of them on
 * every highlight move: 1,000 per arrow key at 1,000 items, the top composite-list cost in the
 * attribution. Declared keyed, the first move re-runs every reader once and later moves re-run the
 * old and the new item only. Value selection with a custom `isItemEqualToValue` has no stable key,
 * so it stays a plain selector.
 */
import { DEV, createMemo, createRenderEffect, createRoot, createSignal, flush } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { selectors as comboboxSelectors } from '../../combobox/store';
import { MenuStore } from '../../menu/store/MenuStore';
import { selectors as selectSelectors } from '../../select/store';
import { SolidStore } from './SolidStoreV2';

const N = 1000;

interface ListStore {
  set(key: string, value: unknown): void;
  useState(key: string, id: Accessor<number>): Accessor<unknown>;
  select(key: string, id: Accessor<number>): unknown;
}

interface Case {
  name: string;
  /** Creates the store under the current owner, as a root component does. */
  create: () => ListStore;
  key: string;
  field: string;
  /** How the item reads it: `useState` (Select, Menu) or a memo over `select` (Combobox). */
  via: 'useState' | 'select';
  /**
   * Index reads the first move may cost: Combobox's highlight is derived (`createDerivedIdSelector`),
   * so the one reader that read before a second id existed re-runs once more onto the projection.
   */
  firstMove?: number;
}

const cases: Case[] = [
  {
    name: 'Select isActive',
    create: () =>
      SolidStore({ activeIndex: 0, selectedIndex: 0 } as any, {}, selectSelectors) as never,
    key: 'isActive',
    field: 'activeIndex',
    via: 'useState',
  },
  {
    name: 'Combobox isActive',
    create: () => SolidStore({ activeIndex: 0 } as any, {} as any, comboboxSelectors) as never,
    key: 'isActive',
    field: 'activeIndex',
    via: 'select',
  },
  {
    name: 'Menu isActive',
    create: () => MenuStore({ activeIndex: 0 }) as never,
    key: 'isActive',
    field: 'activeIndex',
    via: 'useState',
  },
];

/** A store and `N` item readers for indexes `0`…`N - 1`; `calls` counts each item's index reads. */
function mountList(testCase: Case) {
  const calls = { count: 0 };
  const ids: [Accessor<number>, Setter<number>][] = [];
  let store!: ListStore;
  let reads!: Accessor<unknown>[];
  const dispose = createRoot((d) => {
    store = testCase.create();
    reads = Array.from({ length: N }, (_, index) => {
      const [id, setId] = createSignal(index);
      ids.push([id, setId]);
      const counted = () => {
        calls.count += 1;
        return id();
      };
      if (testCase.via === 'useState') {
        const selected = store.useState(testCase.key, counted);
        return createMemo(() => selected());
      }
      return createMemo(() => store.select(testCase.key, counted));
    });
    return d;
  });
  const settle = () => {
    flush();
    reads.forEach((read) => read());
  };
  settle();
  /** Index reads the update costs. */
  const cost = (update: () => void) => {
    const before = calls.count;
    update();
    settle();
    return calls.count - before;
  };
  const current = () => reads.flatMap((read, index) => (read() ? [index] : []));
  return { store, ids, cost, current, dispose };
}

describe('list stores: keyed highlight', () => {
  describe.each(cases)('$name', (testCase) => {
    // The keyed floor (`test/floor/listHighlight.ts`, D20): readers sit on their id's signal from
    // mount, and the store pushes the old and the new id with its write, so the first move re-runs
    // the old and the new item as every later move does.
    it('every move, the first included, re-runs only the old and the new item', () => {
      const list = mountList(testCase);
      expect(list.current()).toEqual([0]);
      expect(list.cost(() => list.store.set(testCase.field, 1))).toBeLessThanOrEqual(
        testCase.firstMove ?? 2,
      );
      expect(list.current()).toEqual([1]);
      for (const next of [2, 500, 999, 3]) {
        expect(list.cost(() => list.store.set(testCase.field, next))).toBeLessThanOrEqual(2);
        expect(list.current()).toEqual([next]);
      }
      // No item is the current one.
      expect(list.cost(() => list.store.set(testCase.field, null))).toBeLessThanOrEqual(1);
      expect(list.current()).toEqual([]);
      list.dispose();
    });

    // The list stores push the old and the new id's membership with the write (D21): every pass
    // of a move sees one highlighted item, never the new one beside the stale one.
    it('a move shows exactly one highlighted item in every pass, never two', () => {
      const list = mountList(testCase);
      const seen: number[] = [];
      const disposeWatch = createRoot((disposeRoot) => {
        createRenderEffect(
          () => list.current().length,
          (highlighted) => {
            seen.push(highlighted);
          },
        );
        return disposeRoot;
      });
      flush();
      for (const next of [1, 2, 500, 999, 3]) {
        list.store.set(testCase.field, next);
        flush();
      }
      expect(seen.every((highlighted) => highlighted === 1)).toBe(true);
      disposeWatch();
      list.dispose();
    });

    it('an item whose index changes follows it, and later moves still re-run only two items', () => {
      const list = mountList(testCase);
      list.store.set(testCase.field, 1);
      list.store.set(testCase.field, 5);
      flush();
      // An item inserted before index 5: every later item's index shifts by one, and the store's
      // index follows the highlighted item.
      list.cost(() => {
        for (let index = N - 1; index >= 5; index -= 1) {
          list.ids[index][1](index + 1);
        }
        list.store.set(testCase.field, 6);
      });
      // Reader 5 holds the item that was highlighted; its index is now 6.
      expect(list.current()).toEqual([5]);
      expect(list.cost(() => list.store.set(testCase.field, 7))).toBeLessThanOrEqual(2);
      expect(list.current()).toEqual([6]);
      // Two items swap places: the highlight stays on the index, so it moves to the other item.
      list.cost(() => {
        list.ids[6][1](8);
        list.ids[7][1](7);
      });
      expect(list.current()).toEqual([7]);
      expect(list.cost(() => list.store.set(testCase.field, 8))).toBeLessThanOrEqual(2);
      expect(list.current()).toEqual([6]);
      list.dispose();
    });
  });

  // Unit 49: keyed, a selection by focus built the projection and a node per item on the list's
  // first selection, which happens once per open, so it cost Select 0.8-0.9 ms per selection and
  // paid back only after several. It stays plain: a selection re-runs every item's cheap compare.
  it("Select's selection by focus stays a plain selector: a selection builds nothing", () => {
    const hooks = (DEV as unknown as { hooks: { onOwner?: (owner: unknown) => void } }).hooks;
    const list = mountList({
      name: 'Select isSelectedByFocus',
      create: () =>
        SolidStore({ activeIndex: 0, selectedIndex: 0 } as any, {}, selectSelectors) as never,
      key: 'isSelectedByFocus',
      field: 'selectedIndex',
      via: 'useState',
    });
    const owners: unknown[] = [];
    hooks.onOwner = (owner) => owners.push(owner);
    try {
      for (const next of [1, 500]) {
        list.cost(() => list.store.set('selectedIndex', next));
        expect(list.current()).toEqual([next]);
      }
    } finally {
      hooks.onOwner = undefined;
    }
    expect(owners).toEqual([]);
    list.dispose();
  });

  it('value selection with a custom comparer stays a plain selector and stays exact', () => {
    // `isItemEqualToValue` decides equality, so no single key identifies the selected item.
    const comparer = (a: { id: number }, b: { id: number }) => a.id === b.id;
    const dispose = createRoot((d) => {
      const store = SolidStore(
        { value: { id: 3 }, multiple: false, isItemEqualToValue: comparer } as any,
        {},
        selectSelectors,
      );
      const items = Array.from({ length: 10 }, (_, id) => ({ id }));
      const reads = items.map((item) =>
        createMemo(() => store.useState('isSelected', () => ({ ...item }))()),
      );
      const current = () => reads.flatMap((read, index) => (read() ? [index] : []));
      expect(current()).toEqual([3]);
      store.set('value', { id: 7 });
      flush();
      expect(current()).toEqual([7]);
      return d;
    });
    dispose();
  });
});
