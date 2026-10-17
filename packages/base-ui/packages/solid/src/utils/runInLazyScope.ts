import { createOwner, isHydrating, runWithOwner } from 'solid-js';
// `solid-js/internal` reads the same `sharedConfig` object as `solid-js`, with its type.
import { sharedConfig } from 'solid-js/internal';
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
  if (process.env.NODE_ENV !== 'production' && isHydrating()) {
    return runGuarded(scope, create);
  }
  return runWithOwner(scope, create) as T;
}

type Registry = Map<string, Element>;

/**
 * Development: runs `create` while hydrating with Solid's claim registry guarded, so an element
 * claimed inside the scope fails with the reason instead of a key miss that leaves the server's
 * element inert. The stack names the scope's caller.
 */
function runGuarded<T>(scope: Owner, create: () => T): T {
  const config = sharedConfig as unknown as { registry?: Registry | undefined };
  const registry = config.registry;
  if (registry === undefined) {
    return runWithOwner(scope, create) as T;
  }
  config.registry = new Proxy(registry, {
    get(target, key) {
      if (key === 'get') {
        return () => {
          throw new Error(
            'Base UI: An element was hydrated inside a lazy scope (`runInLazyScope`). ' +
              "A scope's hydration ids differ between the server and the client, so the element " +
              'cannot be claimed and the server markup stays inert. ' +
              'Render the element outside the scope: a scope only hosts reactive machinery.',
          );
        };
      }
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  try {
    return runWithOwner(scope, create) as T;
  } finally {
    config.registry = registry;
  }
}
