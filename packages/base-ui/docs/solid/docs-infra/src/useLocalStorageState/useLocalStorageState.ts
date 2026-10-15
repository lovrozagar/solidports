import { createMemo, createSignal, untrack } from 'solid-js';
import { environmentHook, initialState, useSyncExternalStore } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';

/**
 * Copied from https://github.com/mui/material-ui/blob/9dfc2b12f3fc5c41071da5e10b0088fb04045a26/packages/mui-utils/src/useLocalStorageState/useLocalStorageState.ts
 */

// storage events only work across tabs, we'll use an event emitter to announce within the current tab
const currentTabChangeListeners = new Map<string, Set<() => void>>();
function onCurrentTabStorageChange(key: string, handler: () => void) {
  let listeners = currentTabChangeListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    currentTabChangeListeners.set(key, listeners);
  }
  listeners.add(handler);
}
function offCurrentTabStorageChange(key: string, handler: () => void) {
  const listeners = currentTabChangeListeners.get(key);
  if (!listeners) {
    return;
  }
  listeners.delete(handler);
  if (listeners.size === 0) {
    currentTabChangeListeners.delete(key);
  }
}
function emitCurrentTabStorageChange(key: string) {
  const listeners = currentTabChangeListeners.get(key);
  if (listeners) {
    listeners.forEach((listener) => listener());
  }
}
function subscribe(area: Storage, key: string | null, callback: () => void): () => void {
  if (!key) {
    return () => {};
  }
  const storageHandler = (event: StorageEvent) => {
    if (event.storageArea === area && event.key === key) {
      callback();
    }
  };
  window.addEventListener('storage', storageHandler);
  onCurrentTabStorageChange(key, callback);
  return () => {
    window.removeEventListener('storage', storageHandler);
    offCurrentTabStorageChange(key, callback);
  };
}
function getSnapshot(area: Storage, key: string | null): string | null {
  if (!key) {
    return null;
  }
  try {
    return area.getItem(key);
  } catch {
    // ignore
    // See https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#feature-detecting_localstorage
    return null;
  }
}
function setValue(area: Storage, key: string | null, value: string | null) {
  if (!key) {
    return;
  }
  try {
    if (value === null) {
      area.removeItem(key);
    } else {
      area.setItem(key, String(value));
    }
  } catch {
    // ignore
    // See https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#feature-detecting_localstorage
    return;
  }
  emitCurrentTabStorageChange(key);
}
type Initializer = () => string | null;
type UseStorageStateHookResult = [
  string | null,
  (value: string | null | ((prev: string | null) => string | null)) => void,
];
const serverValue: UseStorageStateHookResult = [null, () => {}];
function useLocalStorageStateServer(): Accessor<UseStorageStateHookResult> {
  return createMemo(() => serverValue);
}

/**
 * Sync state to local storage so that it persists through a page refresh. Usage is
 * similar to useState except we pass in a storage key so that we can default
 * to that value on page load instead of the specified initial value.
 *
 * Since the storage API isn't available in server-rendering environments, we
 * return null during SSR and hydration.
 *
 * @param key - localStorage key. If null, persistence is disabled and
 *   the hook behaves like regular useState.
 * @param initializer - Initial value or function returning initial value
 * @returns A tuple of [value, setValue] where value is the current value
 *   from localStorage (or the initial value) and setValue updates it
 */
function useLocalStorageStateBrowser(
  key: Accessor<string | null>,
  _initializer?: Accessor<string | null | Initializer | undefined>,
): Accessor<UseStorageStateHookResult> {
  const initializer = createMemo(() => {
    const _initializer2 = _initializer?.();
    return _initializer2 === undefined ? null : _initializer2;
  });
  const [initialValue] = createSignal(() => untrack(() => initialState(initializer())));
  const area = window.localStorage;
  const subscribeKey = (callback: () => void) => subscribe(area, key(), callback);
  const getKeySnapshot = () => getSnapshot(area, key()) ?? initialValue();

  // Start with null for the hydration, and then switch to the actual value.
  const getKeyServerSnapshot = () => null;
  const storedValue = useSyncExternalStore(subscribeKey, getKeySnapshot, getKeyServerSnapshot);
  const setStoredValue = (value: string | null | ((prev: string | null) => string | null)) => {
    const valueToStore = value instanceof Function ? value(storedValue()) : value;
    setValue(area, key(), valueToStore);
  };
  const [nonStoredValue, setNonStoredValue] = createSignal(() =>
    untrack(() => initialState(initialValue())),
  );
  return createMemo(() => {
    if (!key()) {
      return [nonStoredValue(), setNonStoredValue];
    }
    return [storedValue(), setStoredValue];
  });
}
export default environmentHook(useLocalStorageStateServer, useLocalStorageStateBrowser);
