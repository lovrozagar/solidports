import { defineConfig, devices } from "@playwright/test"

/* Solid port and React reference run side-by-side; tests diff per-chart screenshots. */
const SOLID_PORT = 5183
const REACT_PORT = 5184

export default defineConfig({
	testDir: "./tests",
	snapshotDir: "./tests/__snapshots__",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	workers: 1,
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "playwright-report" }],
	],
	use: {
		baseURL: `http://localhost:${SOLID_PORT}`,
		trace: "retain-on-failure",
		viewport: { width: 1280, height: 720 },
		deviceScaleFactor: 1,
	},
	expect: {
		/* Sub-pixel diffs from anti-aliasing/font hinting are expected; keep tight enough to catch real regressions. */
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.05,
			threshold: 0.2,
			animations: "disabled",
			caret: "hide",
			scale: "css",
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: [
		{
			command: "bun run --filter @solidports/recharts-examples-basic dev",
			url: `http://localhost:${SOLID_PORT}`,
			cwd: "../../../..",
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: "bun run --filter @solidports/recharts-examples-react dev",
			url: `http://localhost:${REACT_PORT}`,
			cwd: "../../../..",
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
		},
	],
})
