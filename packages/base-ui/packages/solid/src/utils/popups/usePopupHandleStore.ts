import { createEffect, createSignal, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { access, type MaybeAccessor } from '../../solid-helpers';
import { NOOP } from '../empty';
import type { PopupHandleStoreProvider } from './popupHandle';

/**
 * Reads the store currently exposed by a popup handle and subscribes to store-pointer changes.
 * Detached triggers use this to follow a handle as a root attaches or detaches: while no root is
 * attached, the handle exposes its fallback store; once a root attaches, subscribers re-render and
 * read from the live root store.
 *
 * Returns `undefined` when no handle is provided so callers can fall back to their root context.
 *
 * @param handle The popup handle to read from, or `undefined` when the trigger is not handle-bound.
 */
export function usePopupHandleStore<HandleStore>(
  handle: MaybeAccessor<PopupHandleStoreProvider<HandleStore> | undefined>,
): Accessor<HandleStore | undefined> {
  const currentHandle = () => access(handle);
  // Bumped by the handle's store-pointer notifications, which a Root sends from its attach
  // render effect (an owned scope), hence `ownedWrite`.
  const [version, setVersion] = createSignal(0, { ownedWrite: true });

  createEffect(currentHandle, (h) => {
    if (h === undefined) {
      return undefined;
    }
    // Re-read in case the pointer changed between render and subscription.
    setVersion((v) => v + 1);
    return h.subscribeStore(() => setVersion((v) => v + 1)) ?? NOOP;
  });

  return () => {
    version();
    const h = currentHandle();
    return h === undefined ? undefined : untrack(() => h.store);
  };
}
