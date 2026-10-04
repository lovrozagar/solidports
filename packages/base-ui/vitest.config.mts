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
			"test/e2e/vitest.config.mts",
			"test/regressions/vitest.config.mts",
		],
		reporters: process.env.CI
			? ["default", ["junit", { outputFile: "./test-results/junit.xml" }]]
			: ["default"],
		sequence: {
			hooks: "list",
		},
	},
})
