// docs-infra's `useUrlHashState`, kept by hand for Solid: `null` on the server and through
// hydration (as React's server snapshot), then the URL's hash, kept current by `hashchange`.
import { createSignal, onSettled } from 'solid-js';
import type { Accessor } from 'solid-js';

function readHash(): string | null {
  const hash = window.location.hash;
  return hash ? hash.slice(1) : null;
}

/**
 * The URL hash (without `#`) and a setter that replaces (or pushes) the history entry.
 */
export function useUrlHashState(): Accessor<
  [string | null, (value: string | null, replace?: boolean) => void]
> {
  const [hash, setHashState] = createSignal<string | null>(null);
  onSettled(() => {
    const update = () => setHashState(readHash());
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  });
  const setHash = (value: string | null, replace: boolean = true) => {
    const base = `${window.location.pathname}${window.location.search}`;
    let url = value ? `${base}#${value}` : base;
    if (value === '') {
      url = `${base}#`;
    }
    if (replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
    setHashState(readHash());
  };
  return () => [hash(), setHash];
}
