import { createComponent, flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { ssrFixtures } from './fixtures/index';

(
  window as unknown as {
    __hydrate: (key: string) => { syncMs: number; committed: Promise<number> };
  }
).__hydrate = (key) => {
  const Fixture = ssrFixtures[key] as () => any;
  const start = performance.now();
  // Hydration and its effects run synchronously: committed when `flush` returns.
  hydrate(() => createComponent(Fixture, {}), document.getElementById('root')!);
  flush();
  const syncMs = performance.now() - start;
  return { syncMs, committed: Promise.resolve(syncMs) };
};

// D29: `?auto=1` hydrates as a page does, once the bundle has run, and records the commit against
// navigation start, for TTI (`ssr/interact.mjs`).
const params = new URLSearchParams(location.search);
if (params.get('auto') === '1') {
  const fixture = params.get('fixture')!;
  const { committed } = (
    window as unknown as { __hydrate: (key: string) => { committed: Promise<number> } }
  ).__hydrate(fixture);
  void committed.then(() => {
    (window as unknown as { __hydratedAt: number }).__hydratedAt = performance.now();
  });
}
