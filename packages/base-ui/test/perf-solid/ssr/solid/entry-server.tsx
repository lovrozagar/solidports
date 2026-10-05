import { createComponent } from 'solid-js';
import { generateHydrationScript, renderToString } from '@solidjs/web';
import { ssrFixtures } from './fixtures';

export const keys = Object.keys(ssrFixtures);

export function render(key: string): string {
  const Fixture = ssrFixtures[key] as () => any;
  return renderToString(() => createComponent(Fixture, {}));
}

/** The hydration runtime bootstrap `hydrate()` expects (`window._$HY`). */
export const head = () => generateHydrationScript();
