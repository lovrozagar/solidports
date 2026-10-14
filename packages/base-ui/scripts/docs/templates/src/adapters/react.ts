// The docs runtime's counterparts of React APIs Solid has none of. The generator emits this file to
// `docs/solid/src/adapters/react.ts`; `react-to-solid.mjs` points the transformed docs here.
import { createSignal, isHydrating, onCleanup, onSettled } from 'solid-js';
import type { Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

/**
 * `React.useSyncExternalStore` as an accessor: the server snapshot on the server and through
 * hydration (so the markup matches), then the client snapshot, kept current by `subscribe`.
 */
export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): Accessor<T> {
  if (isServer) {
    const value = (getServerSnapshot ?? getSnapshot)();
    return () => value;
  }
  const initial = isHydrating() && getServerSnapshot ? getServerSnapshot() : getSnapshot();
  const [value, setValue] = createSignal<{ current: T }>({ current: initial });
  onSettled(() => {
    const update = () => setValue({ current: getSnapshot() });
    update();
    onCleanup(subscribe(update));
  });
  return () => value().current;
}
