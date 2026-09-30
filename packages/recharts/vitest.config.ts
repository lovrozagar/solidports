import { defineConfig } from "vitest/config"
import solidPlugin from "vite-plugin-solid"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fs from "node:fs"

const dirname =
	typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url))

const srcDir = path.resolve(dirname, "src")

/* Vite plugin: resolve bare-directory `require("../../../src")` to `src/index.ts`.
   Used by the panorama test which lazy-requires Brush to avoid circular-dep lint warnings.
   resolveId handles Vite's module graph; transform handles vite-node's injected require()
   which uses Node's createRequire and bypasses Vite's resolver entirely. */
const resolveIndexPlugin = {
	name: "recharts-test-resolve-src-index",
	resolveId(id: string, importer: string | undefined) {
		if (!importer) return null
		const resolved = path.resolve(path.dirname(importer), id)
		if (resolved === srcDir && fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) {
			return path.join(srcDir, "index.ts")
		}
		return null
	},
	transform(code: string, id: string) {
		/* Rewrite runtime require("../../../src") to a top-level dynamic import.
		   vite-node's injected require = createRequire(href) is Node-native and bypasses
		   Vite's resolver + transform pipeline — it cannot load .ts files. Replace with
		   an await import() hoisted to the top of the module; vite-node wraps all modules
		   in async functions so top-level await is always valid here.
		   Scoped to the one file that uses this pattern — avoids scanning every test module. */
		if (!id.includes("test/state/_solid/cartesianAxes.reactivity.spec")) return null
		const relToSrc = path.relative(path.dirname(id), srcDir)
		const escaped = relToSrc.replace(/[/\\]/g, "[/\\\\]").replace(/\./g, "\\.")
		const requirePattern = new RegExp(
			`require\\(["'\`]${escaped}["'\`]\\)`,
			"g",
		)
		if (!requirePattern.test(code)) return null
		const srcIndexPath = path.join(srcDir, "index.ts")
		const varName = "__recharts_src_index__"
		const hoisted = `const ${varName} = await import(${JSON.stringify(srcIndexPath)});\n`
		const replaced = code.replace(
			new RegExp(`require\\(["'\`]${escaped}["'\`]\\)`, "g"),
			varName,
		)
		return { code: hoisted + replaced, map: null }
	},
}

export default defineConfig({
	plugins: [solidPlugin({ hot: false }), resolveIndexPlugin],
	resolve: {
		alias: {
			"@solidports/recharts": path.resolve(dirname, "src"),
		},
		conditions: ["solid", "development", "browser"],
	},
	test: {
		environment: "jsdom",
		globals: true,
		include: ["test/**/*.spec.ts?(x)", "test/**/*.test.ts?(x)", "test/**/*.spec-d.ts"],
		restoreMocks: true,
		setupFiles: [
			"test/vitest.setup.ts",
			"test/helper/toBeRechartsScale.ts",
			"test/helper/expectStackGroups.ts",
			"test/helper/expectFunctionReturning.ts",
		],
		transformMode: {
			web: [/\.[jt]sx?$/],
		},
	},
})
