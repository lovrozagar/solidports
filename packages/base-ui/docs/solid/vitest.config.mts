import { resolve } from 'node:path';
import { configDefaults, defineProject } from 'vitest/config';

// The Solid counterpart of upstream's `docs` project: the docs app's unit tests and the generator
// that builds the Solid docs from `docs/react`, in Node.
export default defineProject({
  test: {
    name: '@solidports/docs',
    root: resolve(import.meta.dirname, '../..'),
    include: ['docs/solid/**/*.test.{ts,tsx,mts,mjs}', 'scripts/docs/**/*.test.{ts,mts,mjs}'],
    exclude: [...configDefaults.exclude, 'docs/solid/dist/**', 'docs/solid/.output/**'],
    environment: 'node',
    env: {
      VITEST_ENV: 'node',
    },
  },
});
