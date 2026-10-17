import { describe, expect, test } from "bun:test"
import { censusReport, summarizeCensus } from "../packages/base-ui/scripts/warning-census.mjs"

const entry = (over: Record<string, unknown>) => ({
	file: "src/a.test.tsx",
	test: "a > b",
	kind: "warn",
	code: null,
	message: "Base UI: x",
	origin: "library",
	swallowed: false,
	...over,
})

describe("warning census report", () => {
	const entries = [
		entry({}),
		entry({ test: "a > c" }),
		entry({ kind: "error", message: "Boom", origin: "test" }),
		entry({
			file: "src/b.test.tsx",
			code: "FLUSH_IN_EFFECT_CALLBACK",
			message: "[FLUSH_IN_EFFECT_CALLBACK] flush",
			origin: "harness",
			swallowed: true,
		}),
	]

	test("counts per suite by kind, origin and swallowed, suites with the most first", () => {
		const summary = summarizeCensus(entries)
		expect(summary.total).toBe(4)
		expect(summary.suites).toEqual([
			{ file: "src/a.test.tsx", warn: 2, error: 1, library: 2, harness: 0, test: 1, dependency: 0, swallowed: 0 },
			{ file: "src/b.test.tsx", warn: 1, error: 0, library: 0, harness: 1, test: 0, dependency: 0, swallowed: 1 },
		])
	})

	test("groups distinct messages by code or text, with their origin, count and suites", () => {
		expect(summarizeCensus(entries).messages).toEqual([
			{ key: "Base UI: x", kind: "warn", origin: "library", count: 2, suites: 1, swallowed: 0 },
			{ key: "Boom", kind: "error", origin: "test", count: 1, suites: 1, swallowed: 0 },
			{ key: "FLUSH_IN_EFFECT_CALLBACK", kind: "warn", origin: "harness", count: 1, suites: 1, swallowed: 1 },
		])
	})

	test("the report is markdown with the totals, the library share and both tables", () => {
		const md = censusReport(summarizeCensus(entries))
		expect(md).toContain(
			"4 messages in 2 suites: 2 library, 1 harness, 1 test, 0 dependency; 1 swallowed by the harness",
		)
		expect(md).toContain("| src/a.test.tsx | 2 | 1 | 2 | 0 | 1 | 0 | 0 |")
		expect(md).toContain("| FLUSH_IN_EFFECT_CALLBACK | warn | harness | 1 | 1 | 1 |")
	})

	test("an empty census says so", () => {
		expect(censusReport(summarizeCensus([]))).toContain("0 messages")
	})
})
