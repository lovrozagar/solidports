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
