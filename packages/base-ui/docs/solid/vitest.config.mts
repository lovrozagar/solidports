import { resolve } from 'node:path';
import solidPlugin from '@solidjs/vite-plugin';
import { configDefaults, defineProject } from 'vitest/config';

/** Module paths as the docs app resolves them (`tsconfig.json`'s `paths`). */
export const docsAliases = [
  {
    find: /^@solidports\/base-ui(.*)$/,
    replacement: resolve(import.meta.dirname, '../../packages/solid/src$1'),
  },
  {
    find: /^@mui\/internal-docs-infra\/(.*)$/,
    replacement: resolve(import.meta.dirname, 'docs-infra/src/$1'),
  },
  {
    find: /^@base-ui\/utils\/(.*)$/,
    replacement: resolve(import.meta.dirname, 'base-ui-utils/src/$1'),
  },
  { find: /^docs\/(.*)$/, replacement: resolve(import.meta.dirname, '$1') },
];

// The Solid counterpart of upstream's `docs` project, in Node: the docs app's unit tests and the
// generator that builds the Solid docs from `docs/react`. Upstream lets a component test ask for
// jsdom in its file; Solid's Vite plugin picks Solid's client or server output by the project's
// environment, so component tests (`*.test.tsx`) run in `vitest.dom.config.mts` instead.
export default defineProject({
  plugins: [solidPlugin() as any],
  resolve: { alias: docsAliases },
  test: {
    name: '@solidports/docs',
    root: resolve(import.meta.dirname, '../..'),
    include: ['docs/solid/**/*.test.{ts,mts,mjs}', 'scripts/docs/**/*.test.{ts,mts,mjs}'],
    exclude: [...configDefaults.exclude, 'docs/solid/dist/**', 'docs/solid/.output/**'],
    environment: 'node',
    env: {
      VITEST_ENV: 'node',
    },
  },
});
