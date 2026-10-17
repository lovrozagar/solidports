import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

// The root oxlint ignores packages/base-ui (it keeps its own linters), and Base UI's ESLint runs on
// the library and the docs app only, so its scripts and perf harness had no lint at all: a `const`
// in bench-component's main shadowed the module's `run()` and the earlier calls hit its temporal
// dead zone, which only a Mac run caught. These two rules hold them; hoisted function
// declarations are allowed, since only `const`, `let` and `class` have a dead zone.
const RULES = {
	categories: { correctness: "off" },
	rules: { "no-shadow": "error", "no-use-before-define": ["error", { functions: false }] },
}

const BASE_UI = resolve(import.meta.dir, "../packages/base-ui")
const dir = mkdtempSync(join(tmpdir(), "base-ui-scripts-lint-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** The tooling scripts (not the docs generator under `scripts/docs`) and the perf harness. */
const targets = [
	...readdirSync(join(BASE_UI, "scripts"))
		.filter((name) => name.endsWith(".mjs"))
		.map((name) => join(BASE_UI, "scripts", name)),
	join(BASE_UI, "test/perf-solid"),
]

describe("Base UI scripts lint", () => {
	test("no shadowed names and no use before definition in the scripts and the perf harness", () => {
		const config = join(dir, "rules.json")
		writeFileSync(config, JSON.stringify(RULES))
		const result = Bun.spawnSync(["bunx", "oxlint", "-c", config, "--no-ignore", ...targets], {
			cwd: resolve(import.meta.dir, ".."),
			stdout: "pipe",
			stderr: "pipe",
		})
		const output = `${result.stdout.toString()}${result.stderr.toString()}`
		const diagnostics = output.split("\n").filter((line) => line.includes("eslint("))
		expect(diagnostics).toEqual([])
		expect(result.exitCode).toBe(0)
	})
})
