/*
 * Context provision for native parts (plan 8 step 3.2). A `<Provider>` costs a root, a lazy
 * children memo and (through `provideContext`) a keep-alive render effect per part; a native part
 * provides its context on one plain owner instead and renders its children under it. Client only:
 * the server and hydration renders keep `provideContext` (same owners as the server).
 */
import { createOwner, runWithOwner } from 'solid-js';
import type { Context, Owner } from 'solid-js';
import { setContext } from '@solidjs/signals';

/**
 * An owner, child of the current one, that carries `context = value` for everything created under
 * it. Transparent: it takes no hydration id of its own (the native path never hydrates), so its
 * children consume ids from the nearest id-carrying ancestor, as without it.
 */
export function createContextOwner<T>(context: Context<T>, value: T): Owner {
  const owner = createOwner(TRANSPARENT);
  setContext(context, value, owner);
  return owner;
}

const TRANSPARENT = { transparent: true };

/** Runs `render` under an owner that provides `context = value` and returns its result. */
export function provideNativeContext<T, R>(context: Context<T>, value: T, render: () => R): R {
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
  const owner = createContextOwner(contextA, valueA);
  setContext(contextB, valueB, owner);
  return runWithOwner(owner, render) as R;
}
