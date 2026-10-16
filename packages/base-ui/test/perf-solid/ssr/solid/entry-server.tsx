import { createComponent } from 'solid-js';
import { generateHydrationScript, renderToString } from '@solidjs/web';
import { ssrCases } from '../cases';
import { ssrFixtures } from './fixtures/index';

export const keys = Object.keys(ssrFixtures);

/** The shared case list, so the runner filters and checks registrations from the bundle. */
export const cases = ssrCases;

export function render(key: string): string {
  const Fixture = ssrFixtures[key] as () => any;
  return renderToString(() => createComponent(Fixture, {}));
}

/** The hydration runtime bootstrap `hydrate()` expects (`window._$HY`). */
export const head = () => generateHydrationScript();
