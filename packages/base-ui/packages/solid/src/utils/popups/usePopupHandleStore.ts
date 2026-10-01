import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { NOOP } from '../empty';
import type { PopupHandleStoreProvider } from './popupHandle';

/**
 * Reads the store currently exposed by a popup handle and subscribes to store-pointer changes.
 */
export function usePopupHandleStore<HandleStore>(
  handle: PopupHandleStoreProvider<HandleStore> | undefined,
): Accessor<HandleStore | undefined> {
  const [store, setStore] = createSignal<HandleStore | undefined>(
    handle === undefined ? undefined : handle.store,
  );

  createEffect(() => {
    if (handle === undefined) {
      setStore(undefined);
      return;
    }

    setStore(() => handle.store);
    const unsubscribe = handle.subscribeStore(() => {
      setStore(() => handle.store);
    });
    onCleanup(unsubscribe ?? NOOP);
  });

  return store;
}
