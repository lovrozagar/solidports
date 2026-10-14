/*
 * Computations a part creates on first read (or first listener) must not take a hydration id:
 * the server and the client read at different points (a hydrated page's memos compute where the
 * server served a value), so an id taken by one would shift the keys of every later node.
 */
import { createEffect, createRoot, createSignal, flush, getNextChildId, getOwner } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { NOOP } from './empty';
import { createPropsView, createStateAttributesSource, propsViewKeys } from './propsView';
import { SolidStore } from './store/SolidStoreV2';

/**
 * The next hydration id of an owner after `setup` ran under it, with and without the reads it
 * returns running afterwards in a computation.
 */
function nextIdsWithAndWithoutRead(setup: () => () => void) {
  return [false, true].map((runRead) =>
    createRoot(
      (dispose) => {
        const owner = getOwner()!;
        const read = setup();
        const [reading, setReading] = createSignal(false, { ownedWrite: true });
        createEffect(() => {
          if (reading()) {
            read();
          }
        }, NOOP);
        flush();
        if (runRead) {
          setReading(true);
          flush();
        }
        const id = getNextChildId(owner);
        dispose();
        return id;
      },
      { id: 't' },
    ),
  );
}

describe('lazily created computations', () => {
  it('a derived selector read takes no hydration id', () => {
    const [without, withRead] = nextIdsWithAndWithoutRead(() => {
      const store = SolidStore({ count: 1 }, {}, { double: (state: { count: number }) => state.count * 2 });
      const double = store.useState('double');
      return () => double();
    });

    expect(withRead).toBe(without);
  });

  it('a synced key read takes no hydration id', () => {
    const [without, withRead] = nextIdsWithAndWithoutRead(() => {
      const store = SolidStore({ count: 1 });
      store.useSyncedValue('count', () => 2);
      return () => store.state.count;
    });

    expect(withRead).toBe(without);
  });

  it('a listener on a synced key takes no hydration id', () => {
    const [without, withRead] = nextIdsWithAndWithoutRead(() => {
      const store = SolidStore({ count: 1 });
      store.useSyncedValue('count', () => 2);
      return () => store.observe((state) => state.count, NOOP);
    });

    expect(withRead).toBe(without);
  });

  it("a props view's key set takes no hydration id", () => {
    const [without, withRead] = nextIdsWithAndWithoutRead(() => {
      const view = createPropsView([{ id: 'a' }, { title: 'b' }]);
      return () => propsViewKeys(view);
    });

    expect(withRead).toBe(without);
  });

  it('mapped state attributes take no hydration id', () => {
    const [without, withRead] = nextIdsWithAndWithoutRead(() => {
      const source = createStateAttributesSource(
        () => ({ open: true }),
        () => ({ open: (open: boolean) => (open ? { 'data-popup-open': '' } : null) }),
      );
      return () => [Object.keys(source), source['data-popup-open']];
    });

    expect(withRead).toBe(without);
  });
});
