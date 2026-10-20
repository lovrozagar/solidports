import {
  createEffect,
  createRoot,
  createSignal,
  getObserver,
  getOwner,
  isDisposed,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import { isServer } from '@solidjs/web';
import { runInLazyScope } from './runInLazyScope';

interface IdSlot {
  readers: number;
  get: Accessor<boolean>;
  set: Setter<boolean>;
  /** One per slot, shared by its readers and their re-runs: a read allocates no cleanup closure. */
  release: () => void;
}

export interface IdSelector {
  /** Whether `id` is the current one; a tracked read subscribes to `id`'s membership only. */
  (id: unknown): boolean;
  /**
   * The current id has changed to `next`: called by the writer, in the same batch as its write,
   * so the old and the new id's readers see the change in the same flush as everything else.
   */
  push(next: unknown): void;
  /** How many ids hold an entry now: one per id with a live reader (tests). */
  size(): number;
}

/**
 * "Is `id` the current one", for readers that each ask about their own id (a list's items, a tab
 * list's tabs, a radio group's radios): a change of `current` re-runs the old and the new id's
 * readers only, the first change included, where a direct compare re-runs every reader (D20).
 *
 * Each id with tracked readers holds one signal (the keyed floor's mechanism), created by its first
 * reader and dropped once its last reader's cleanup runs, so a list whose ids churn holds only its
 * live ids. A writer the port owns (the list stores' `set`, a composite's highlight, a group's
 * value) calls `push` with its write: the signals change in the same batch as the source, so no
 * part sees the new current id with a stale membership. One effect follows `current` as well, for
 * the changes no writer pushes (a controlled prop, a store key bound to one); it writes nothing when
 * a push already applied the change. Everything is created on the first tracked read, in a lazy
 * scope of `owner` (no hydration id of the owner's), inside a root that stops once no id has a
 * reader. An untracked read (an event handler), the server, which renders once, and an ownerless or
 * disposed `owner` compare directly and create nothing.
 */
/**
 * Dev: the writes the catch-all effect made, that is, changes of a current id no writer pushed.
 * The suites assert none in flows whose writers push; a write here is a writer to fix, not a relay
 * to accept (each one is a flush where the new id shows beside its stale membership).
 */
const relayGlobal = globalThis as { __baseUiIdSelectorRelays?: { writes: number } | undefined };
relayGlobal.__baseUiIdSelectorRelays ??= { writes: 0 };
export const idSelectorRelays: { writes: number } = relayGlobal.__baseUiIdSelectorRelays;

export function createIdSelector(
  current: Accessor<unknown>,
  owner: Owner | null = getOwner(),
): IdSelector {
  let scope: Owner | undefined;
  let slots: Map<unknown, IdSlot> | undefined;
  let running: Owner;
  let stop: () => void;
  let last: unknown;

  function apply(next: unknown) {
    if (slots === undefined || Object.is(next, last)) {
      return;
    }
    const previous = last;
    last = next;
    slots.get(previous)?.set(false);
    slots.get(next)?.set(true);
  }

  function start() {
    const created = new Map<unknown, IdSlot>();
    scope ??= runInLazyScope(owner, getOwner)!;
    last = untrack(current);
    runWithOwner(scope, () =>
      createRoot((dispose) => {
        stop = dispose;
        running = getOwner()!;
        // Its first run is skipped: `start` read the current id in the reader's pass, while this
        // effect, created in a root made during the flush, reads the committed one at first.
        let first = true;
        createEffect(current, (next) => {
          if (first) {
            first = false;
            return;
          }
          if (
            process.env.NODE_ENV !== 'production' &&
            slots !== undefined &&
            !Object.is(next, last)
          ) {
            idSelectorRelays.writes += 1;
          }
          apply(next);
        });
      }),
    );
    return created;
  }

  const select = (id: unknown): boolean => {
    if (isServer || owner === null || getObserver() === null || isDisposed(owner)) {
      return Object.is(id, current());
    }
    if (slots === undefined) {
      slots = start();
    }
    const map = slots;
    let slot = map.get(id);
    if (slot === undefined) {
      // Seeded from the current id itself, read here, in the reader's pass: read inside the
      // selector's root, created during this flush, it would be the committed one, not this
      // flush's (a list that mounts in the same batch as a change of the current id).
      const initial = Object.is(id, untrack(current));
      // In the selector's root, which writes it; the reader only subscribes. `ownedWrite`: the
      // catch-all effect writes it, inside an owned scope.
      const [get, set] = runWithOwner(running, () => createSignal(initial, { ownedWrite: true }));
      const created: IdSlot = {
        readers: 0,
        get,
        set,
        // Solid runs a computation's cleanups after its re-run: a reader that re-runs reads its id
        // again before this releases it, so only a reader that is gone empties its id.
        release: () => {
          created.readers -= 1;
          if (created.readers === 0 && map.get(id) === created) {
            map.delete(id);
            if (map.size === 0 && slots === map) {
              slots = undefined;
              stop();
            }
          }
        },
      };
      slot = created;
      map.set(id, slot);
    }
    slot.readers += 1;
    void onCleanup(slot.release);
    return slot.get();
  };
  return Object.assign(select, { push: apply, size: () => slots?.size ?? 0 });
}
