import {
  createProjection,
  createRoot,
  getObserver,
  getOwner,
  isDisposed,
  onCleanup,
  runWithOwner,
} from 'solid-js';
import type { Accessor, Owner } from 'solid-js';
import { isServer } from '@solidjs/web';
import { runInLazyScope } from './runInLazyScope';
import type { IdSelector } from './createIdSelector';

type Key = string | number;

const isKey = (value: unknown): value is Key =>
  typeof value === 'string' || typeof value === 'number';

/** The projection's property for an id: numbers and strings apart (`1` is not `'1'`). */
const slot = (id: Key) => (typeof id === 'number' ? `n${id}` : `s${id}`);

/**
 * `createIdSelector` for a current id that no writer of the port's pushes: a controlled prop (a
 * controlled Tabs value or RadioGroup value), which the parent changes. A change of `current`
 * re-runs the old and the new id's readers only (D20), glitch-free whatever writes `current`:
 *
 * The first tracked read starts it, in a lazy scope of `owner` (`runInLazyScope`: it takes none of
 * the owner's hydration ids): one projection holds the current id's property, so a reader reads its
 * own id's property and a change rewrites two. A projection, not an effect writing a signal per id:
 * an effect relays the change a flush later, so a part that reads the current id directly too sees
 * the new id with its stale membership first (Solid's dev diagnostics report EFFECT_RELAY_TEAR).
 * Once no reader is left (a list closed or unmounted), it stops, and starts again on the next
 * tracked read, so nothing outlives the readers. An untracked read (an event handler), the server,
 * which renders once, an ownerless or disposed `owner`, and an id that is neither a string nor a
 * number compare directly and create nothing.
 */
export function createDerivedIdSelector(
  current: Accessor<unknown>,
  owner: Owner | null = getOwner(),
): IdSelector {
  let scope: Owner | undefined;
  let membership: Record<string, true> | undefined;
  let stop: () => void;
  let readers = 0;

  function start() {
    scope ??= runInLazyScope(owner, getOwner)!;
    return runWithOwner(scope, () =>
      createRoot((dispose) => {
        stop = dispose;
        // At most one property: the current id's. Rewritten in place, so a change touches the old
        // and the new id's readers only.
        return createProjection<Record<string, true>>((draft) => {
          const next = current();
          const name = isKey(next) ? slot(next) : undefined;
          for (const held of Object.keys(draft)) {
            if (held !== name) {
              delete draft[held];
            }
          }
          if (name !== undefined && draft[name] !== true) {
            draft[name] = true;
          }
        }, {});
      }),
    );
  }

  function release() {
    readers -= 1;
    // At once, not in a microtask: an unmounted list leaves no subscription behind even for a
    // synchronous read of the store's observers. Solid runs a computation's cleanups after its
    // re-run, so a lone reader that re-runs reads again before this releases it.
    if (readers === 0 && membership !== undefined) {
      membership = undefined;
      stop();
    }
  }

  const select = (id: unknown): boolean => {
    if (
      isServer ||
      owner === null ||
      getObserver() === null ||
      isDisposed(owner) ||
      !isKey(id)
    ) {
      return Object.is(id, current());
    }
    membership ??= start();
    readers += 1;
    void onCleanup(release);
    return membership[slot(id)] === true;
  };
  // Nothing to push: the projection follows `current` in the same flush as its writer.
  // `size`: the projection holds the current id's property only.
  return Object.assign(select, { push: () => {}, size: () => (membership === undefined ? 0 : 1) });
}
