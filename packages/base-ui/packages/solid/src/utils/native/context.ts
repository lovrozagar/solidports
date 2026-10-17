/*
 * Context provision for native parts. On the client after hydration it is `provideContext`'s: one
 * transparent owner that carries the context (`createContextOwner`). The server renders the
 * provider, and hydration rebuilds the provider's owners without its computations, where
 * `provideContext` renders the provider itself.
 */
import { createOwner, isHydrating, runWithOwner } from 'solid-js';
import type { Context, Owner } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
// `solid-js` does not re-export `setContext`; `@solidjs/signals` is a peer pinned to the solid-js
// range, so this is the same core solid-js runs on in the browser.
import { setContext } from '@solidjs/signals';
import { createContextOwner, provideContext } from '../../solid-helpers';

/**
 * While hydrating, the owners the server's `<Provider>` created that hydration ids depend on,
 * without its computations: the provider's root (it carries the context and takes the parent's
 * next id), and the lazy children memo the children render in (the root's first child id). The
 * provider's second memo (it flattens the children) takes the root's next id, which nothing reads.
 * Solid 2.0.0-rc.15 shape: GOTCHA-017, pinned by `context.shape.test.tsx`.
 */
export function hydrateProviderOwners<T>(context: Context<T>, value: T): Owner {
  const root = createOwner();
  setContext(context, value, root);
  return runWithOwner(root, () => createOwner());
}

/**
 * The server's owners are `solid-js`'s own, not `@solidjs/signals`'s, and it exports no
 * `setContext`: a signals `setContext` on a server owner sets nothing the server reads (in
 * production builds, where the field names differ). The server renders the context's provider.
 */
export function provideNativeContext<T, R>(context: Context<T>, value: T, render: () => R): R {
  if (isServer) {
    return provideContext(context, value, render as () => JSX.Element) as R;
  }
  if (isHydrating()) {
    return runWithOwner(hydrateProviderOwners(context, value), render) as R;
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
  if (isServer) {
    return provideContext(contextA, valueA, () =>
      provideContext(contextB, valueB, render as () => JSX.Element),
    ) as R;
  }
  if (isHydrating()) {
    // The server nests B's provider inside A's children memo.
    return runWithOwner(hydrateProviderOwners(contextA, valueA), () =>
      runWithOwner(hydrateProviderOwners(contextB, valueB), render),
    ) as R;
  }
  const owner = createContextOwner(contextA, valueA);
  setContext(contextB, valueB, owner);
  return runWithOwner(owner, render) as R;
}
