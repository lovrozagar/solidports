import { createSignal, isHydrating, onSettled, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

/**
 * Returns `true` while Solid is hydrating server-rendered markup and `false`
 * for fresh client-only mounts.
 */
export function useIsHydrating(): Accessor<boolean> {
  // Solid: there is no external-store server snapshot. The server render is `true` (React's server
  // snapshot); on the client, read the hydration pass once and flip to `false` after the mount
  // settles, as React re-renders with the client snapshot.
  const [hydrating, setHydrating] = createSignal(isServer || isHydrating());

  onSettled(() => {
    if (untrack(hydrating)) {
      setHydrating(false);
    }
  });

  return hydrating;
}
