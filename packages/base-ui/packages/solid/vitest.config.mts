import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { defineProject, mergeConfig } from 'vitest/config';
// eslint-disable-next-line import/no-relative-packages
import sharedConfig from '../../vitest.shared.mts';

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const IN_BROWSER = ['chromium', 'firefox', 'webkit', 'all-browsers'].includes(
  process.env.VITEST_ENV ?? '',
);
const WORKSPACE_ROOT = resolve(PACKAGE_DIR, '../..');

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
    readFileSync(resolve(PACKAGE_DIR, file), 'utf8').matchAll(/from '(date-fns\/[^']+)'/g),
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
      // The warning census's file (`test/warningCensus.ts`), substituted so browser mode sees it.
      ...(process.env.SOLID_WARNING_CENSUS
        ? { 'process.env.SOLID_WARNING_CENSUS': JSON.stringify(process.env.SOLID_WARNING_CENSUS) }
        : {}),
    },
    plugins: [solidPlugin({ solid: { hydratable: true } }) as any],
    optimizeDeps: {
      include: OPTIMIZED_DEPENDENCIES,
    },
    resolve: {
      alias: {
        '@solidports/base-ui': resolve(PACKAGE_DIR, 'src'),
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
      globalSetup: [
        resolve(PACKAGE_DIR, 'test/hydration/globalSetup.ts'),
        // The jsdom exit records keep the newest runs (`test/exitDiagnosticsSetup.ts`).
        ...(IN_BROWSER ? [] : [resolve(PACKAGE_DIR, 'test/exitDiagnosticsSetup.ts')]),
      ],
      setupFiles: [
        resolve(PACKAGE_DIR, 'test/disableAutoCleanup.ts'),
        resolve(PACKAGE_DIR, 'test/setupSolid.ts'),
        // Which jsdom worker ended how, and in which file (`test/exitDiagnostics.ts`).
        ...(IN_BROWSER ? [] : [resolve(PACKAGE_DIR, 'test/exitDiagnostics.ts')]),
      ],
      // The only browser project in its run: a taken port fails it rather than moving it.
      browser: {
        api: { strictPort: true },
        // The warning census (`test/warningCensus.ts`) appends its lines through the server in
        // browser mode, where the test has no file system.
        commands: {
          appendWarningCensus: (_context, file: string, line: string) => {
            appendFileSync(file, line);
          },
        },
      },
      // TODO: Remove this once we have solved the PopoverPopup test timeout issue.
      // testTimeout: 500,
      server: {
        deps: {
          inline: [
            /^solid-js/,
            /^@solidjs\//,
            /solid-js\/dist/,
            /@solidjs\/(web|signals|testing-library|router)/,
          ],
        },
      },
    },
  }),
);
