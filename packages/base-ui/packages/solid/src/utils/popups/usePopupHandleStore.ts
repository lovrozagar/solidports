import { createTrackedEffect, createSignal, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { NOOP } from '../empty';
import type { PopupHandleStoreProvider } from './popupHandle';

/**
 * Reads the store currently exposed by a popup handle and subscribes to store-pointer changes.
 */
export function usePopupHandleStore<HandleStore>(
  handle: PopupHandleStoreProvider<HandleStore> | undefined,
): Accessor<HandleStore | undefined> {
  const [store, setStore] = createSignal<HandleStore | undefined>(
    (handle === undefined ? undefined : handle.store) as any,
  );

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (handle === undefined) {
      setStore(undefined as any);
      return;
    }

    setStore(handle.store as any);
    const unsubscribe = handle.subscribeStore(() => {
      setStore(handle.store as any);
    });
    _c.push(unsubscribe ?? NOOP);
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  return store;
}
