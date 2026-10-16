import { createProjection } from 'solid-js';
import type { Accessor } from 'solid-js';

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
 * compared by identity against `values` itself.
 */
export function createKeyedSelector(values: Accessor<readonly unknown[]>): (key: unknown) => boolean {
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
  return (key) => (isKey(key) ? membership[slot(key)] === true : values().includes(key));
}
