import { defineConfig, devices } from "@playwright/test";

const DEV_PORT = 4099;
const PROD_PORT = 4100;

export default defineConfig({
	expect: { timeout: 10_000 },
	forbidOnly: true,
	maxFailures: 40,
	projects: [
		{
			name: "chromium-ltr",
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://localhost:${DEV_PORT}`,
			},
		},
		{
			name: "chromium-rtl",
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://localhost:${DEV_PORT}?dir=rtl`,
			},
		},
		{
			name: "firefox-ltr",
			use: {
				...devices["Desktop Firefox"],
				baseURL: `http://localhost:${DEV_PORT}`,
			},
		},
		{
			name: "firefox-rtl",
			use: {
				...devices["Desktop Firefox"],
				baseURL: `http://localhost:${DEV_PORT}?dir=rtl`,
			},
		},
		{
			name: "webkit-ltr",
			use: {
				...devices["Desktop Safari"],
				baseURL: `http://localhost:${DEV_PORT}`,
			},
		},
		{
			name: "webkit-rtl",
			use: {
				...devices["Desktop Safari"],
				baseURL: `http://localhost:${DEV_PORT}?dir=rtl`,
			},
		},
	],
	retries: 0,
	testDir: "./tests/e2e",
	timeout: 30_000,
	/* Unused at the config level but keeps PROD_PORT in scope for the future prod `webServer`
	 * entry; delete once that project is added. */
	use: {
		bypassCSP: true,
		trace: "on-first-retry",
	},
	webServer: {
		command: "cd tests/fixture && bunx vite dev --port 4099",
		port: DEV_PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});

export { DEV_PORT, PROD_PORT };
