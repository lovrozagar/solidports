import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type UserWorkspaceConfig } from 'vitest/config';
// eslint-disable-next-line import/extensions
import viteConfig from '@base-ui/monorepo-tests/vite.shared.config.mjs';
import { playwright } from '@vitest/browser-playwright';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(CURRENT_DIR, './');
const environment = process.env.VITEST_ENV;

type BrowserModeConfig = (UserWorkspaceConfig['test'] & {})['browser'];

const supportedBrowsers = new Set(['chromium', 'webkit', 'firefox'] as const);
type SupportedBrowser = typeof supportedBrowsers extends Set<infer U> ? U : never;

function isSupportedBrowser(env: string | undefined): env is SupportedBrowser {
  return !!env && (supportedBrowsers as Set<string>).has(env);
}

function getBrowserConfig(): BrowserModeConfig {
  if (!environment) {
    return undefined;
  }

  let instances;

  if (environment === 'all-browsers') {
    instances = Array.from(supportedBrowsers, (browser) => ({ browser }));
  } else if (isSupportedBrowser(environment)) {
    instances = [{ browser: environment }];
  } else {
    return undefined;
  }

  return {
    enabled: true,
    // Pin the browser timezone: date tests expect UTC (as CI), and a browser cannot follow
    // `process.env.TZ` changes the way Node does.
    provider: playwright({ contextOptions: { timezoneId: 'UTC' } }),
    screenshotFailures: false,
    headless: true,
    // One address: with only a port, Vite binds `localhost` beside another process that holds the
    // same port on the other address family, and the browser can then load that process into the
    // test iframe ("Cannot connect to the iframe ... unknown due to CORS"). Pinning the host keeps
    // the iframe URLs on this server. Not strict here: upstream's run starts two browser projects
    // (`@base-ui/react`, `@base-ui/utils`) in one process, and the second takes the next port. The
    // Solid project, alone in its run, makes a taken port fail it (`packages/solid/vitest.config.mts`).
    api: { host: '127.0.0.1', port: 63315 },
    instances,
  };
}

const config: UserWorkspaceConfig = {
  test: {
    exclude: ['node_modules', 'build', '**/*.spec.*'],
    globals: true,
    setupFiles: [resolve(WORKSPACE_ROOT, './test/setupVitest.ts')],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
        url: 'http://localhost',
      },
    },
    browser: getBrowserConfig(),
    env: {
      VITEST: 'true',
    },
    // Avoid committing tests that influence their own retry
    retry: process.env.CI ? 1 : 0,
  },
  resolve: viteConfig.resolve,
};

export default config;
