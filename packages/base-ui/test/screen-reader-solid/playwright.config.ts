import { defineConfig, devices } from '@playwright/test';
import { screenReaderConfig } from '@guidepup/playwright';

// Upstream's screen reader suite (`test/screen-reader`, unchanged) against the Solid e2e app,
// which serves the same fixtures at the same URLs. As upstream's config otherwise.
const BASE_URL = 'http://localhost:5173';

export default defineConfig({
  ...screenReaderConfig,
  outputDir: '../../test-results/screen-reader-solid',
  testDir: '../screen-reader',
  testMatch: '*.spec.ts',
  timeout: 5 * 60_000,
  retries: 1,
  use: {
    ...screenReaderConfig.use,
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.CI ? 'chrome' : undefined,
      },
    },
  ],
  webServer: {
    command: 'bun run test:e2e:solid:dev',
    cwd: process.cwd(),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: BASE_URL,
  },
});
