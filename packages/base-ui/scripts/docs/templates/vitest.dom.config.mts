import { resolve } from 'node:path';
import solidPlugin from '@solidjs/vite-plugin';
import { configDefaults, defineProject } from 'vitest/config';
import { docsAliases } from './vitest.config.mts';

// The docs' component tests (`*.test.tsx`), in jsdom with Solid's client output: the files
// upstream's `docs` project runs with `@vitest-environment jsdom`.
export default defineProject({
  plugins: [solidPlugin() as any],
  resolve: { alias: docsAliases },
  server: {
    // Test packages (jest-dom, which Solid's plugin adds) resolve into the monorepo's install.
    fs: { allow: [resolve(import.meta.dirname, '../../../..')] },
  },
  test: {
    name: '@solidports/docs:dom',
    root: resolve(import.meta.dirname, '../..'),
    include: ['docs/solid/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, 'docs/solid/dist/**', 'docs/solid/.output/**'],
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
