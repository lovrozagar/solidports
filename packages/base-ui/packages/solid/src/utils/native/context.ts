/*
 * Context provision for native parts. A `<Provider>` costs a root, a lazy
 * children memo and (through `provideContext`) a keep-alive render effect per part; a native part
 * provides its context on one plain owner instead and renders its children under it. Client only:
 * the server and hydration renders keep the provider (same owners as the server).
 */
import { createOwner, isHydrating, runWithOwner } from 'solid-js';
import type { Context, Owner } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
// `solid-js` does not re-export `setContext`; `@solidjs/signals` is a peer pinned to the solid-js
// range, so this is the same core solid-js runs on in the browser.
import { setContext } from '@solidjs/signals';
import { provideContext } from '../../solid-helpers';

const TRANSPARENT = { transparent: true };

/**
 * The server's owners are `solid-js`'s own, not `@solidjs/signals`'s, and it exports no
 * `setContext`: a signals `setContext` on a server owner sets nothing the server reads (in
 * production builds, where the field names differ). The server renders the context's provider, and
 * hydration creates the same owners.
 */
const needsProvider = () => isServer || isHydrating();

/**
 * An owner, child of the current one, that carries `context = value` for everything created under
 * it. Transparent: it takes no hydration id of its own, so its children consume ids from the
 * nearest id-carrying ancestor, as without it. Client only, outside hydration.
 */
export function createContextOwner<T>(context: Context<T>, value: T): Owner {
  const owner = createOwner(TRANSPARENT);
  setContext(context, value, owner);
  return owner;
}

/** Runs `render` under an owner that provides `context = value` and returns its result. */
export function provideNativeContext<T, R>(context: Context<T>, value: T, render: () => R): R {
  if (needsProvider()) {
    return provideContext(context, value, render as () => JSX.Element) as R;
  }
  return runWithOwner(createContextOwner(context, value), render) as R;
}

/** As `provideNativeContext` for two contexts on the same owner. */
export function provideNativeContexts<A, B, R>(
  contextA: Context<A>,
  valueA: A,
  contextB: Context<B>,
  valueB: B,
  render: () => R,
): R {
  if (needsProvider()) {
    return provideContext(contextA, valueA, () =>
      provideContext(contextB, valueB, render as () => JSX.Element),
    ) as R;
  }
  const owner = createContextOwner(contextA, valueA);
  setContext(contextB, valueB, owner);
  return runWithOwner(owner, render) as R;
}
