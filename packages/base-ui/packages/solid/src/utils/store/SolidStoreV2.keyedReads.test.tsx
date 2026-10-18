/*
 * A keyed selector's reads before its projection exists (plan 3 push gate, regate2's menu/500 open by
 * keyboard): every item reads it on the current id's first change, so a read must not make a closure
 * of its own. The store reads the current id untracked through one module-level runner.
 */
import { createMemo, createRoot, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { isJSDOM } from '#test-utils';
import { MenuStore } from '../../menu/store/MenuStore';

const untracked = vi.hoisted(() => ({
  on: false,
  functions: new Set<unknown>(),
  calls: 0,
  projections: 0,
}));

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>();
  return {
    ...actual,
    createProjection: (...args: any[]) => {
      untracked.projections += 1;
      return (actual.createProjection as any)(...args);
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
  it('make no closure per read before the projection exists', () => {
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
      expect(untracked.calls).toBeGreaterThanOrEqual(readers);
      return untracked.functions.size;
    };
    // The store's own runners only: as many for 100 readers as for 50.
    expect(distinct(100)).toBe(distinct(50));
  });

  // A popup root with one trigger asks only about that trigger: a projection keyed by trigger id
  // would re-run nothing less, and creating it on the first change cost every root of
  // preview-card/roots-200 a projection when the pointer moved across them.
  it('creates no projection while every reader asks about one id', () => {
    untracked.projections = 0;
    const dispose = createRoot((disposeRoot) => {
      const store = MenuStore({ activeIndex: -1 }) as unknown as {
        useState(key: string, id: () => number): () => unknown;
        set(key: string, value: unknown): void;
      };
      const highlighted = store.useState('isActive', () => 3);
      const reader = createMemo(() => highlighted());
      void reader();
      flush();
      store.set('activeIndex', 3);
      flush();
      expect(reader()).toBe(true);
      store.set('activeIndex', 4);
      flush();
      expect(reader()).toBe(false);
      return disposeRoot;
    });
    dispose();
    expect(untracked.projections).toBe(0);
  });

  it('creates the projection once readers ask about more than one id', () => {
    untracked.projections = 0;
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
    expect(untracked.projections).toBe(1);
  });
});
