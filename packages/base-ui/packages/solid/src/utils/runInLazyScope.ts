import { createOwner, runWithOwner } from 'solid-js';
import type { Owner } from 'solid-js';

const scopeCounts = new WeakMap<Owner, number>();

/**
 * Runs `create` in a new scope owned by `owner`, for reactive machinery created after the owner's
 * body ran (on first read, on first open). Created directly under `owner`, a computation takes the
 * owner's next hydration id: the server either never allocated it or gave it to a later sibling,
 * so every server-rendered node after it misses its key and stays inert. The scope carries an id
 * of its own instead (`<owner id>-<n>-`, which no child id takes), so the owner's children keep
 * the ids the server gave them, on both sides. The scope is disposed with `owner`. An owner
 * without an id (a client render) has no ids to keep: `create` runs under it directly.
 *
 * A single computation needs no scope: pass it `transparent: true`.
 *
 * Nothing a hydration claims may live in a scope: no element, and no computation whose value is
 * serialized. A scope's number follows the order scopes are created in its owner, and the server
 * and the client differ there: a part's scope can open while it renders on one side and after its
 * siblings on the other, or not at all on the server, where a part's machinery has a stand-in
 * that creates no node (D9).
 */
export function runInLazyScope<T>(owner: Owner | null, create: () => T): T {
  if (owner?.id == null) {
    return runWithOwner(owner, create) as T;
  }
  const count = scopeCounts.get(owner) ?? 0;
  scopeCounts.set(owner, count + 1);
  const scope = runWithOwner(owner, () => createOwner({ id: `${owner.id}-${count}-` }));
  return runWithOwner(scope, create) as T;
}
