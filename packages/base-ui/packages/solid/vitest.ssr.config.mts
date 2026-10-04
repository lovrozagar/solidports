import { defineProject } from 'vitest/config';

/*
 * Server rendering tests (test/ssr): Node, no DOM setup. Each test compiles its fixture with
 * Solid's SSR transform through Vite, as an SSR app does.
 */
export default defineProject({
  test: {
    environment: 'node',
    include: ['test/ssr/**/*.test.ts'],
    name: '@solidports/base-ui:ssr',
  },
});
