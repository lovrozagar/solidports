import { createSignal, getObserver, getOwner, isDisposed, onCleanup, runWithOwner } from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import { isServer } from '@solidjs/web';

interface ValueSlot<V> {
  readers: number;
  get: Accessor<V | undefined>;
  set: Setter<V | undefined>;
}

export interface KeyedValues<K, V> {
  /** `key`'s value; a tracked read re-runs when that key's value changes, and no other's. */
  get(key: K): V | undefined;
  /** `key`'s value, untracked. */
  peek(key: K): V | undefined;
  /** Sets `key`'s value (`undefined` removes it), re-running only that key's readers. */
  set(key: K, value: V | undefined): void;
}

/**
 * Values by key whose readers each read one key (every tab reads its own panel's id): a write
 * re-runs that key's readers only, where one version signal over the whole map re-runs every
 * reader. Each key with tracked readers holds one signal, created under `owner` by its first reader
 * and dropped by its last reader's cleanup; signals take no hydration id. Untracked reads, the
 * server and an ownerless or disposed `owner` read the map directly and create nothing.
 */
export function createKeyedValues<K, V>(owner: Owner | null = getOwner()): KeyedValues<K, V> {
  const values = new Map<K, V>();
  const slots = new Map<K, ValueSlot<V>>();
  return {
    get(key) {
      if (isServer || owner === null || getObserver() === null || isDisposed(owner)) {
        return values.get(key);
      }
      let slot = slots.get(key);
      if (slot === undefined) {
        // `ownedWrite`: panels register from their render and unregister from unmount cleanups.
        // Keys' values are plain data (ids), never functions: the value form of `createSignal`.
        const [get, set] = runWithOwner(owner, () =>
          createSignal<V | undefined>(values.get(key) as Exclude<V | undefined, Function>, {
            ownedWrite: true,
          }),
        ) as unknown as [Accessor<V | undefined>, Setter<V | undefined>];
        slot = { readers: 0, get, set };
        slots.set(key, slot);
      }
      const held = slot;
      held.readers += 1;
      void onCleanup(() => {
        held.readers -= 1;
        if (held.readers === 0 && slots.get(key) === held) {
          slots.delete(key);
        }
      });
      return held.get();
    },
    peek(key) {
      return values.get(key);
    },
    set(key, value) {
      if (value === undefined) {
        values.delete(key);
      } else {
        values.set(key, value);
      }
      slots.get(key)?.set(() => value);
    },
  };
}
