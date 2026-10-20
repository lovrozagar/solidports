/*
 * The hand-written Solid floors for a list's highlight: every item asks "is my key the active
 * one", and the active key moves. Two plain Solid 2 mechanisms, built at mount as a hand-written
 * list would build them. `keyedHighlight` is the floor a keyed list highlight is held to, on every
 * metric of that one mechanism (the D19 extension); `directHighlight` is reported beside it,
 * ungated, as the record of the trade (less heap at mount, every move re-running every reader):
 *
 * - `directHighlight`: each reader compares the active key itself. One link per reader and no other
 *   node; every move re-runs every reader.
 * - `keyedHighlight`: Solid 1's `createSelector` shape. One effect follows the active key, and each
 *   key that has readers holds one signal, created by its first reader and dropped with its last;
 *   a move writes only the old and the new key's signal, so it re-runs their readers only.
 *
 * The bench's raw lists (`raw-list.tsx` in the perf fixtures) render both; the cost tests
 * (`listHighlight.test.ts`) pin what each re-runs per move and which signals it holds.
 */
import { createEffect, createSignal, getOwner, onCleanup, runWithOwner, untrack } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

/** Whether `key` is the active one, read by one item's computation. */
export type IsHighlighted<K> = (key: K) => boolean;

export function directHighlight<K>(active: Accessor<K>): IsHighlighted<K> {
  return (key) => active() === key;
}

interface Slot {
  readers: number;
  get: Accessor<boolean>;
  set: Setter<boolean>;
}

export interface KeyedHighlight<K> extends IsHighlighted<K> {
  /** How many keys hold a signal now: one per key with a reader. */
  readonly slots: () => number;
}

export function keyedHighlight<K>(active: Accessor<K>): KeyedHighlight<K> {
  const owner = getOwner();
  const slots = new Map<K, Slot>();
  let current = untrack(active);
  createEffect(active, (next) => {
    if (next === current) {
      return;
    }
    const previous = current;
    current = next;
    slots.get(previous)?.set(false);
    slots.get(next)?.set(true);
  });
  const isHighlighted = (key: K) => {
    let slot = slots.get(key);
    if (slot === undefined) {
      // Created under the selector's owner, which writes it; the reader only subscribes.
      const [get, set] = runWithOwner(owner, () => createSignal(key === current));
      slot = { readers: 0, get, set };
      slots.set(key, slot);
    }
    // A release per read, not per key: with one reader a key, a shared one measured 19.5 KB more
    // heap after mount at 1,000 items (its slot field and its context).
    const held = slot;
    held.readers += 1;
    onCleanup(() => {
      held.readers -= 1;
      if (held.readers === 0 && slots.get(key) === held) {
        slots.delete(key);
      }
    });
    return held.get();
  };
  return Object.assign(isHighlighted, { slots: () => slots.size });
}
