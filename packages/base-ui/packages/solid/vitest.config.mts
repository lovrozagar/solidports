import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { defineProject, mergeConfig } from 'vitest/config';
// eslint-disable-next-line import/no-relative-packages
import sharedConfig from '../../vitest.shared.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '../..');

export default mergeConfig(
  sharedConfig,
  defineProject({
    define: {
      'process.env.NODE_ENV': JSON.stringify('test'),
    },
    plugins: [solidPlugin() as any],
    resolve: {
      alias: {
        '@solidports/base-ui': resolve(__dirname, 'src'),
      },
    },
    server: {
      /* jest-dom resolves into a parent workspace's node_modules — allow @fs traversal */
      fs: {
        allow: [WORKSPACE_ROOT, resolve(WORKSPACE_ROOT, '../../')],
      },
    },
    test: {
      // Server rendering runs in its own Node project (vitest.ssr.config.mts).
      exclude: ['test/ssr/**'],
      // Hydration fixtures are server-rendered in Node up front (browser mode has no SSR loader).
      globalSetup: [resolve(__dirname, 'test/hydration/globalSetup.ts')],
      setupFiles: [
        resolve(__dirname, 'test/disableAutoCleanup.ts'),
        resolve(__dirname, 'test/setupSolid.ts'),
      ],
      // TODO: Remove this once we have solved the PopoverPopup test timeout issue.
      // testTimeout: 500,
      server: {
        deps: {
          inline: [/^solid-js/, /^@solidjs\//, /solid-js\/dist/, /@solidjs\/(web|signals|testing-library|router)/],
        },
      },
    },
  }),
);
