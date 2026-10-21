/*
 * A keyed selector's reads (plan 3 push gate, regate2's menu/500 open by keyboard): every item reads
 * it at mount, so a read must not make a closure of its own; the store reads the current id
 * untracked through one module-level runner. Its id selector (`createIdSelector`) is created only
 * once readers ask about a second id.
 */
import { createMemo, createRoot, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { isJSDOM } from '#test-utils';
import { MenuStore } from '../../menu/store/MenuStore';
import { SolidStore, keyedSelector } from './SolidStoreV2';

const untracked = vi.hoisted(() => ({
  on: false,
  functions: new Set<unknown>(),
  calls: 0,
  selectors: 0,
}));

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>();
  return {
    ...actual,
    createEffect: (...args: any[]) => {
      if ((new Error().stack ?? '').includes('createIdSelector')) {
        untracked.selectors += 1;
      }
      return (actual.createEffect as any)(...args);
    },
    untrack: (fn: any, ...rest: any[]) => {
      if (untracked.on && (new Error().stack ?? '').includes('SolidStoreV2')) {
        untracked.calls += 1;
        untracked.functions.add(fn);
      }
      return (actual.untrack as any)(fn, ...rest);
    },
  };
});

// vi.mock('solid-js') does not reach the runtime in browser mode, so nothing would be counted.
describe.skipIf(!isJSDOM)('keyed selector reads', () => {
  it('make no closure per read', () => {
    const distinct = (readers: number) => {
      untracked.functions.clear();
      untracked.calls = 0;
      const dispose = createRoot((disposeRoot) => {
        const store = MenuStore({ activeIndex: -1 }) as unknown as {
          useState(key: string, id: () => number): () => unknown;
        };
        untracked.on = true;
        for (let i = 0; i < readers; i += 1) {
          const highlighted = store.useState('isActive', () => i);
          createMemo(() => highlighted());
        }
        flush();
        untracked.on = false;
        return disposeRoot;
      });
      dispose();
      // Until a second id is read, a read compares untracked through the module-level runner.
      expect(untracked.calls).toBeGreaterThanOrEqual(2);
      return untracked.functions.size;
    };
    // The store's own runners only: as many for 100 readers as for 50.
    expect(distinct(100)).toBe(distinct(50));
  });

  // A popup root with one trigger asks only about that trigger: a signal per trigger id would
  // re-run nothing less, and a projection created on the first change cost every root of
  // preview-card/roots-200 one when the pointer moved across them.
  it('creates no id selector while every reader of a popup store asks about one id', () => {
    untracked.selectors = 0;
    const dispose = createRoot((disposeRoot) => {
      // The popup stores' trigger selectors: keyed, not declared `list`.
      const store = SolidStore({ active: -1 }, {}, {
        isActive: keyedSelector((state: { active: number }) => state.active),
      }) as unknown as {
        useState(key: string, id: () => number): () => unknown;
        set(key: string, value: unknown): void;
      };
      const highlighted = store.useState('isActive', () => 3);
      const reader = createMemo(() => highlighted());
      void reader();
      flush();
      store.set('active', 3);
      flush();
      expect(reader()).toBe(true);
      store.set('active', 4);
      flush();
      expect(reader()).toBe(false);
      return disposeRoot;
    });
    dispose();
    expect(untracked.selectors).toBe(0);
  });

  // regate4's preview-card/roots-200 move across 20: every root has one trigger, and each trigger
  // read also read the current id untracked (the store's latest-value path) before the tracked read
  // it subscribes through. A one-id popup compares the tracked value alone.
  it('reads a one-id popup selector with no untracked store read', () => {
    untracked.selectors = 0;
    const dispose = createRoot((disposeRoot) => {
      const store = SolidStore({ active: -1 }, {}, {
        isActive: keyedSelector((state: { active: number }) => state.active),
      }) as unknown as {
        useState(key: string, id: () => number): () => unknown;
        set(key: string, value: unknown): void;
      };
      const readers = Array.from({ length: 20 }, () => {
        const active = store.useState('isActive', () => 3);
        return createMemo(() => active());
      });
      readers.forEach((reader) => void reader());
      flush();
      // The write's own commit runs untracked; the readers' re-runs are what is counted.
      store.set('active', 3);
      untracked.calls = 0;
      untracked.on = true;
      flush();
      readers.forEach((reader) => void reader());
      untracked.on = false;
      expect(readers.map((reader) => reader())).toEqual(readers.map(() => true));
      expect(untracked.calls).toBe(0);
      return disposeRoot;
    });
    dispose();
    expect(untracked.selectors).toBe(0);
  });

  // A list store's items each read their own id: its selector starts at the first tracked read, so
  // no item compares directly before it exists.
  it("starts a list store's id selector at its first tracked read", () => {
    untracked.selectors = 0;
    const dispose = createRoot((disposeRoot) => {
      const store = MenuStore({ activeIndex: -1 }) as unknown as {
        useState(key: string, id: () => number): () => unknown;
      };
      const highlighted = store.useState('isActive', () => 3);
      void createMemo(() => highlighted())();
      flush();
      return disposeRoot;
    });
    dispose();
    expect(untracked.selectors).toBe(1);
  });

  it('creates one id selector once readers ask about more than one id', () => {
    untracked.selectors = 0;
    const dispose = createRoot((disposeRoot) => {
      const store = MenuStore({ activeIndex: -1 }) as unknown as {
        useState(key: string, id: () => number): () => unknown;
        set(key: string, value: unknown): void;
      };
      const readers = [0, 1].map((i) => {
        const highlighted = store.useState('isActive', () => i);
        return createMemo(() => highlighted());
      });
      readers.forEach((reader) => void reader());
      flush();
      store.set('activeIndex', 1);
      flush();
      expect(readers.map((reader) => reader())).toEqual([false, true]);
      return disposeRoot;
    });
    dispose();
    expect(untracked.selectors).toBe(1);
  });
});
