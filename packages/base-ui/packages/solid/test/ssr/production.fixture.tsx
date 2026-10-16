import * as web from '@solidjs/web';
import * as sentinel from '../hydrationSentinel';
import { renderFixtureModules } from '../hydration/renderFixtures';
import type { SsrFixtureModule } from '../hydration/renderFixtures';

/**
 * The SSR fixtures of every family on the native server path. A family joins when it migrates
 * (Tabs next).
 */
const modules = import.meta.glob<SsrFixtureModule>(
  [
    '../../src/accordion/**/*.ssr-fixtures.tsx',
    '../../src/collapsible/**/*.ssr-fixtures.tsx',
    '../../src/utils/native/*.ssr-fixtures.tsx',
  ],
  { eager: true },
);

/** Where this production server bundle resolves Solid's reactive core. */
export const signalsUrl = import.meta.resolve('@solidjs/signals');

/**
 * Renders every fixture as the dev harness does (`test/hydration/serverRender.ts`): string, stream
 * and stream inside boundaries. Keys use the path under `src/` from the glob, since a fixture's
 * own `import.meta.url` is this bundle's.
 */
export function renderFixtures() {
  return renderFixtureModules(
    web,
    sentinel,
    Object.entries(modules).map(([path, mod]) => {
      const file = path.split('/src/').pop()!;
      return [file, { default: mod.default && { ...mod.default, file } }];
    }),
  );
}
