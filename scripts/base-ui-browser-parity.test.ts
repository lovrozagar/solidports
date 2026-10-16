import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

const SCRIPT = join(import.meta.dir, "../packages/base-ui/scripts/browser-parity.mjs")
const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

type Tests = Array<[string, "passed" | "failed"]>

/** A Vitest JSON report: one entry per file, with the given tests (none: the file never ran). */
function report(root: string, files: Record<string, Tests>) {
	return {
		testResults: Object.entries(files).map(([file, tests]) => ({
			name: join(root, file),
			assertionResults: tests.map(([title, status]) => ({ ancestorTitles: [], title, status, failureMessages: [] })),
		})),
	}
}

/** Writes `onDisk` test files and both reports, then runs the script on them. */
function parity(onDisk: string[], upstream: Record<string, Tests>, solid: Record<string, Tests>) {
	const root = mkdtempSync(join(tmpdir(), "browser-parity-"))
	temps.push(root)
	for (const file of onDisk) {
		mkdirSync(dirname(join(root, file)), { recursive: true })
		writeFileSync(join(root, file), "")
	}
	writeFileSync(join(root, "react.json"), JSON.stringify(report(root, upstream)))
	writeFileSync(join(root, "solid.json"), JSON.stringify(report(root, solid)))
	return spawnSync("node", [SCRIPT, "react.json", "solid.json"], { cwd: root, encoding: "utf8" })
}

const A_REACT = "packages/react/src/a/A.test.tsx"
const B_REACT = "packages/react/src/b/B.test.tsx"
const A_SOLID = "packages/solid/src/a/A.test.tsx"
const B_SOLID = "packages/solid/src/b/B.test.tsx"

describe("browser parity", () => {
	test("passes when Solid fails only what upstream fails", () => {
		const result = parity(
			[A_REACT, A_SOLID],
			{ [A_REACT]: [["works", "failed"]] },
			{ [A_SOLID]: [["works", "failed"]] },
		)
		expect(result.status).toBe(0)
		expect(result.stdout).toContain("shared with upstream: 1; Solid-only: 0")
	})

	test("fails on an upstream test file that ran no test, instead of reporting Solid-only failures", () => {
		const result = parity(
			[A_REACT, B_REACT, A_SOLID, B_SOLID],
			{ [A_REACT]: [["works", "passed"]], [B_REACT]: [] },
			{ [A_SOLID]: [["works", "passed"]], [B_SOLID]: [["works", "failed"]] },
		)
		expect(result.status).toBe(1)
		expect(result.stderr).toContain("upstream ran tests in 1 of 2 test files under packages/react/src")
		expect(result.stderr).toContain("b/B.test.tsx")
		expect(result.stdout).not.toContain("Solid-only")
	})

	test("fails on a Solid test file on disk that the Solid report lacks", () => {
		const result = parity(
			[A_REACT, A_SOLID, B_SOLID],
			{ [A_REACT]: [["works", "passed"]] },
			{ [A_SOLID]: [["works", "passed"]] },
		)
		expect(result.status).toBe(1)
		expect(result.stderr).toContain("Solid ran tests in 1 of 2 test files under packages/solid/src")
	})
})
