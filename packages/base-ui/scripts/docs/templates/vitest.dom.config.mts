import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import solidPlugin from '@solidjs/vite-plugin';
import { configDefaults, defineProject } from 'vitest/config';
import { docsAliases } from './vitest.config.mts';

const JEST_DOM_DIR = dirname(
  createRequire(import.meta.url).resolve('@testing-library/jest-dom/package.json'),
);

// The docs' component tests (`*.test.tsx`), in jsdom with Solid's client output: the files
// upstream's `docs` project runs with `@vitest-environment jsdom`.
export default defineProject({
  // Hydratable output, as the docs app compiles it: the runtime's tests hydrate server HTML.
  plugins: [solidPlugin({ solid: { hydratable: true } }) as any],
  resolve: { alias: docsAliases },
  server: {
    // Test packages (jest-dom, which Solid's plugin adds) resolve into the monorepo's install, which
    // in a git worktree under the checkout is the checkout's, outside the worktree's root.
    fs: { allow: [resolve(import.meta.dirname, '../../../..'), JEST_DOM_DIR] },
  },
  test: {
    name: '@solidports/docs:dom',
    root: resolve(import.meta.dirname, '../..'),
    include: ['docs/solid/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, 'docs/solid/dist/**', 'docs/solid/.output/**'],
    // The docs-infra runtime's hydration tests hydrate server HTML rendered before the run.
    globalSetup: [resolve(import.meta.dirname, 'docs-infra/src/__fixtures__/globalSetup.ts')],
    environment: 'jsdom',
    env: {
      VITEST_ENV: 'jsdom',
    },
    server: {
      deps: {
        inline: [/^solid-js/, /^@solidjs\//],
      },
    },
  },
});
