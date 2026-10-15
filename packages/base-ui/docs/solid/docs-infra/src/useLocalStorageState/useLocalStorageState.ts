// docs-infra's `useLocalStorageState`, kept by hand for Solid: `null` on the server and through
// hydration (as React's server snapshot), then the stored value (or the initializer's), kept
// current by `storage` events and by writes from this tab.
import { createSignal, onSettled, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';

const currentTabChangeListeners = new Map<string, Set<() => void>>();

function emitCurrentTabStorageChange(key: string) {
  currentTabChangeListeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, callback: () => void): () => void {
  const storageHandler = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && event.key === key) {
      callback();
    }
  };
  window.addEventListener('storage', storageHandler);
  let listeners = currentTabChangeListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    currentTabChangeListeners.set(key, listeners);
  }
  listeners.add(callback);
  return () => {
    window.removeEventListener('storage', storageHandler);
    listeners.delete(callback);
    if (listeners.size === 0) {
      currentTabChangeListeners.delete(key);
    }
  };
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, String(value));
    }
  } catch {
    return;
  }
  emitCurrentTabStorageChange(key);
}

type Initializer = () => string | null;
type SetValue = (value: string | null | ((previous: string | null) => string | null)) => void;

/**
 * A value kept in `localStorage` under `key`. Without a key, a plain state seeded by the
 * initializer.
 */
export default function useLocalStorageState(
  key: Accessor<string | null>,
  initializer: Accessor<string | null | Initializer> = () => null,
): Accessor<[string | null, SetValue]> {
  const initial = untrack(() => {
    const value = initializer();
    return typeof value === 'function' ? value() : value;
  });
  const [stored, setStored] = createSignal<string | null>(null);
  const [nonStored, setNonStored] = createSignal<string | null>(initial);
  onSettled(() => {
    const storageKey = untrack(key);
    if (!storageKey) {
      return undefined;
    }
    const update = () => setStored(readStorage(storageKey) ?? initial);
    update();
    return subscribe(storageKey, update);
  });
  const setValue: SetValue = (value) => {
    const storageKey = untrack(key);
    if (!storageKey) {
      setNonStored(value as never);
      return;
    }
    const next = typeof value === 'function' ? value(untrack(stored)) : value;
    writeStorage(storageKey, next);
  };
  return () => [key() ? stored() : nonStored(), setValue];
}
