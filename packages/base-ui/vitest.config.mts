import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(CURRENT_DIR, "./")

export default defineConfig({
	test: {
		coverage: {
			exclude: ["**/*.test.{js,ts,tsx}", "**/*.test/*"],
			include: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"],
			provider: "istanbul",
			reporter: [["text", { maxCols: 200 }], "lcov"],
			reportsDirectory: resolve(WORKSPACE_ROOT, "coverage"),
		},
		projects: [
			"packages/*/vitest.config.mts",
			"packages/solid/vitest.ssr.config.mts",
			"docs/react/vitest.config.mts",
			"docs/solid/vitest.config.mts",
			"docs/solid/vitest.dom.config.mts",
			"test/e2e/vitest.config.mts",
			"test/regressions/vitest.config.mts",
		],
		// The filter guard fails a run whose file filters miss (scripts/vitest-filter-guard.mjs).
		reporters: process.env.CI
			? ["default", "./scripts/vitest-filter-guard.mjs", ["junit", { outputFile: "./test-results/junit.xml" }]]
			: ["default", "./scripts/vitest-filter-guard.mjs"],
		sequence: {
			hooks: "list",
		},
	},
})
