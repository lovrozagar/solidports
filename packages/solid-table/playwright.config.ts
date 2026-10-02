import { defineConfig, devices } from "@playwright/test";

const DEV_PORT = 4110;
const PROD_PORT = 4111;

/* Same specs against the dev server (Solid dev build + diagnostics) and a production build. */
export default defineConfig({
	expect: { timeout: 5_000 },
	forbidOnly: true,
	projects: [
		{ name: "chromium-dev", use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV_PORT}` } },
		{ name: "chromium-prod", use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PROD_PORT}` } },
	],
	retries: 0,
	testDir: "./tests/e2e",
	timeout: 30_000,
	webServer: [
		{
			command: "cd tests/fixture && bunx vite dev",
			port: DEV_PORT,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
		{
			command: "cd tests/fixture && bunx vite build && bunx vite preview",
			port: PROD_PORT,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
	],
});
