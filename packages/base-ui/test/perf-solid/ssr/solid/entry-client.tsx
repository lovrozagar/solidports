import { createComponent, flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { ssrFixtures } from './fixtures';

(window as unknown as { __hydrate: (key: string) => number }).__hydrate = (key) => {
  const Fixture = ssrFixtures[key] as () => any;
  const start = performance.now();
  hydrate(() => createComponent(Fixture, {}), document.getElementById('root')!);
  flush();
  return performance.now() - start;
};
