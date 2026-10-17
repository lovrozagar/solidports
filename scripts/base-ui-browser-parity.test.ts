import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
	ALPHA,
	confirm,
	CONFIRM_RUNS,
	describeCounts,
	fisherOneSided,
	MAX_CONFIRM_RUNS,
} from "../packages/base-ui/scripts/browser-parity.mjs"

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

describe("confirming a Solid-only failure", () => {
	type Status = "passed" | "failed"
	const KEY = "popover/root/PopoverRoot :: opens"
	const entry = { key: KEY, message: "", upstream: "passed" }
	const runs = (statuses: string) =>
		[...statuses].map(
			(s) => new Map([[KEY, { file: "", status: (s === "f" ? "failed" : "passed") as Status, message: "" }]]),
		)

	test("computes the one-sided Fisher exact p of Solid failing more than upstream", () => {
		// Solid failed 10 of 10, upstream 7 of 10 (passed 3): 120 / 1140.
		expect(fisherOneSided(10, 10, 7, 10)).toBeCloseTo(120 / 1140, 10)
		expect(fisherOneSided(10, 10, 0, 10)).toBeCloseTo(1 / 184756, 12)
		expect(fisherOneSided(5, 10, 5, 10)).toBeGreaterThan(0.5)
	})

	test("confirms a Solid break on a test upstream fails in some reruns when the gap is significant", () => {
		const { confirmed, unconfirmed } = confirm([entry], runs("ffffffffff"), runs("fpppfpppfp"))
		expect(confirmed.map((e) => [e.solidFailed, e.upstreamPassed, e.runs])).toEqual([[10, 7, 10]])
		expect(confirmed[0].p).toBeLessThan(ALPHA)
		expect(unconfirmed).toEqual([])
	})

	test("leaves a gap that ten reruns cannot settle inconclusive, for ten more", () => {
		// Popover's Enter-or-Space test at 75bdb4e3 on CI's WebKit: Solid failed 10 of 10, upstream
		// passed 3 of 10. Both move focus one frame after the open, and WebKit's driver can press the
		// next key in that frame, so upstream fails it most of the time too.
		const { confirmed, unconfirmed } = confirm([entry], runs("ffffffffff"), runs("fpffpfffpf"))
		expect(confirmed).toEqual([])
		expect(unconfirmed.map((e) => [e.solidFailed, e.upstreamPassed, e.inconclusive])).toEqual([[10, 3, true]])
	})

	test("decides at twenty reruns", () => {
		const solid = runs("f".repeat(20))
		expect(confirm([entry], solid, runs("ffffffffffffpppppppp")).confirmed).toHaveLength(1)
		const { unconfirmed } = confirm([entry], solid, runs("fffffffffffffffppppp"))
		expect(unconfirmed[0].inconclusive).toBe(false)
	})

	test("does not confirm a failure Solid passes in a rerun", () => {
		const { confirmed, unconfirmed } = confirm([entry], runs("fffffffffp"), runs("pppppppppp"))
		expect(confirmed).toEqual([])
		expect(unconfirmed[0].inconclusive).toBe(false)
	})

	test("confirms a failure of a test upstream does not have on Solid's reruns alone", () => {
		const absent = { ...entry, upstream: "absent" }
		expect(confirm([absent], runs("ffffffffff"), []).confirmed).toHaveLength(1)
	})

	test("holds a Solid flake's false red and a real break's miss under 1%", () => {
		// A Solid test failing 60% of runs fails every one of ten reruns by chance.
		expect(0.6 ** CONFIRM_RUNS).toBeLessThan(0.01)
		// A deterministic Solid break on a test upstream passes 63% of the time: at twenty reruns it
		// is confirmed once upstream passes 7, which happens with probability over 99%.
		expect(fisherOneSided(MAX_CONFIRM_RUNS, MAX_CONFIRM_RUNS, MAX_CONFIRM_RUNS - 7, MAX_CONFIRM_RUNS)).toBeLessThan(
			ALPHA,
		)
		const binomial = (n: number, k: number, p: number) => {
			let c = 1
			for (let i = 0; i < k; i += 1) c = (c * (n - i)) / (i + 1)
			return c * p ** k * (1 - p) ** (n - k)
		}
		let atLeastSeven = 0
		for (let k = 7; k <= MAX_CONFIRM_RUNS; k += 1) atLeastSeven += binomial(MAX_CONFIRM_RUNS, k, 0.63)
		expect(atLeastSeven).toBeGreaterThan(0.99)
	})
})

describe("printing a rerun result", () => {
	test("gives both counts and p, or says upstream has no such test", () => {
		expect(describeCounts({ solidFailed: 7, upstreamPassed: 5, runs: 10, p: 0.3204, upstream: "passed" })).toBe(
			" (Solid failed 7/10, upstream passed 5/10, p 0.32)",
		)
		// A Solid-only test file: no upstream reruns, so no upstream count and no p.
		expect(describeCounts({ solidFailed: 0, upstreamPassed: 0, runs: 10, p: 0, upstream: "absent" })).toBe(
			" (Solid failed 0/10, upstream absent)",
		)
		expect(describeCounts({ upstream: "passed" })).toBe("")
	})
})
