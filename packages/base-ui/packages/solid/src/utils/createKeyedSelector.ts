import { createProjection } from 'solid-js';
import type { Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

type Key = string | number;

const isKey = (value: unknown): value is Key =>
  typeof value === 'string' || typeof value === 'number';

/** The projection's property for a key: numbers and strings apart (`1` is not `'1'`). */
const slot = (key: Key) => (typeof key === 'number' ? `n${key}` : `s${key}`);

/**
 * Membership of keys in a list's selected `values` (an Accordion's open items), from one keyed
 * projection created by the list's owner (core spec S4): `isSelected(key)` reads only `key`'s
 * entry, so a change of `values` re-runs only the readers of the keys that joined or left it,
 * where a memo per item re-runs every item. A key that is neither a string nor a number is
 * compared by identity against `values` itself. The projection exists on both sides (hydration ids
 * align); the server reads `values` directly.
 */
export interface KeyedSelector {
  /** Whether `key` is in the values (tracked): one projection lookup by the key's slot. */
  (key: unknown): boolean;
  /**
   * The same read bound to one key: the slot's name is computed once, so each read is a single
   * projection lookup with no string built (a reader that reads many times, an Accordion item's
   * parts, binds at setup; the read itself is a proxy access, about 8x a signal's, and Solid 2 has
   * no public handle to a store key's node).
   */
  forKey(key: unknown): () => boolean;
}

export function createKeyedSelector(values: Accessor<readonly unknown[]>): KeyedSelector {
  const membership = createProjection<Record<string, true>>((draft) => {
    const selected = new Set<string>();
    for (const value of values()) {
      if (isKey(value)) {
        const name = slot(value);
        selected.add(name);
        if (draft[name] !== true) {
          draft[name] = true;
        }
      }
    }
    for (const name of Object.keys(draft)) {
      if (!selected.has(name)) {
        delete draft[name];
      }
    }
  }, {});
  // The server renders once, so nothing re-runs: a key is looked up in `values`, as the floor does,
  // instead of read from the projection (a proxy read and a property name per call). The lookup
  // keeps numbers and strings apart and compares anything else by identity, as the projection does.
  if (isServer) {
    // One set per values array: an item reads its membership several times, and a page renders
    // every item, so `includes` per read is quadratic when many items are open. `Set` compares as
    // `includes` does (SameValueZero).
    let last: readonly unknown[] | undefined;
    let members: ReadonlySet<unknown> = new Set();
    const isMember = (key: unknown) => {
      const current = values();
      if (current !== last) {
        last = current;
        members = new Set(current);
      }
      return members.has(key);
    };
    return Object.assign(isMember, { forKey: (key: unknown) => () => isMember(key) });
  }
  const isSelected = (key: unknown) =>
    isKey(key) ? membership[slot(key)] === true : values().includes(key);
  return Object.assign(isSelected, {
    forKey: (key: unknown) => {
      if (!isKey(key)) {
        return () => values().includes(key);
      }
      const name = slot(key);
      return () => membership[name] === true;
    },
  });
}
