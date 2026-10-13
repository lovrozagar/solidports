import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { defineProject, mergeConfig } from 'vitest/config';
// eslint-disable-next-line import/no-relative-packages
import sharedConfig from '../../vitest.shared.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_BROWSER = ['chromium', 'firefox', 'webkit', 'all-browsers'].includes(
  process.env.VITEST_ENV ?? '',
);
const WORKSPACE_ROOT = resolve(__dirname, '../..');

/*
 * Every dependency the browser tests load, optimized in one pass up front. Vite otherwise discovers
 * them while the suite runs and reloads the page each time, which fails the files mid-import and,
 * when `@solidjs/signals` is optimized after `solid-js`, leaves two reactive cores in one page.
 * A warm local cache hides this; a fresh CI runner hits it on every run.
 */
const DATE_FNS_MODULES = [
  'src/internals/temporal-adapter-date-fns/TemporalAdapterDateFns.ts',
  'src/internals/temporal-adapter-date-fns/TemporalAdapterDateFns.test.ts',
].flatMap((file) =>
  Array.from(
    readFileSync(resolve(__dirname, file), 'utf8').matchAll(/from '(date-fns\/[^']+)'/g),
    (match) => match[1],
  ),
);

const OPTIMIZED_DEPENDENCIES = [
  'solid-js',
  '@solidjs/signals',
  '@solidjs/web',
  '@solidjs/testing-library',
  '@testing-library/dom',
  '@testing-library/jest-dom/vitest',
  '@testing-library/user-event',
  '@mui/internal-test-utils',
  '@mui/internal-test-utils/setupVitest',
  '@floating-ui/dom',
  '@floating-ui/utils',
  '@floating-ui/utils/dom',
  '@date-fns/tz',
  'clsx',
  'luxon',
  'sinon',
  ...new Set(DATE_FNS_MODULES),
];

export default mergeConfig(
  sharedConfig,
  defineProject({
    define: {
      'process.env.NODE_ENV': JSON.stringify('test'),
    },
    plugins: [solidPlugin({ solid: { hydratable: true } }) as any],
    optimizeDeps: {
      include: OPTIMIZED_DEPENDENCIES,
    },
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
      // Server rendering runs in its own Node project (vitest.ssr.config.mts). Package checks read
      // the shipped files with Node APIs: they run under jsdom, and browsers can't load them.
      exclude: ['test/ssr/**', ...(IN_BROWSER ? ['test/package/**'] : [])],
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
