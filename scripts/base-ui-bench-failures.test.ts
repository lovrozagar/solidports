import { describe, expect, test } from "bun:test"
import {
	EXIT_BAR_SUSPENDED,
	failureEntries,
	judgeFailures,
	measuredVerdicts,
	timingRow,
} from "../packages/base-ui/scripts/bench-failures.mjs"

// The `## Failures` section of the 2026-10-25 4a-1a compare (cur c1349cb1), which exited 1 and was
// read as two timing rows: its hydrated-DOM mismatch was the Tabs.Panel bug that turned main's CI
// red (run 40162124626).
const A1A = [
	"## Failures",
	"",
	"- SSR bench exited 1",
	'- ssr: tabs/200: hydrated DOM differs: react {"nodes":205,"expanded":0,"checkboxes":0,"dialog":0,"tabsSelected":1,"labelled":1} ≠ cur {"nodes":205,"expanded":0,"checkboxes":0,"dialog":0,"tabsSelected":1,"labelled":0}',
	"- exit bar: accordion/300 serverMs 2.26 ms is 1.40x the floor and 0.36x React (floor 0.26x React); the bar is 1.25x the floor and below React",
	"- regressed: button/button-1000 › mount sync 3.10 → 3.70 (95% CI of the shift 0.50 to 0.80, minimum effect 0.10, p 2.8e-8)",
	"- regressed: button/button-1000 › mount script 3.09 → 3.67 (95% CI of the shift 0.46 to 0.80, minimum effect 0.10, p 3.9e-8)",
	"",
	"written /tmp/report.{md,json}",
].join("\n")

const BUTTON_ALLOWED = {
	entries: [
		{ row: "button/button-1000 › mount", metric: "sync", shift: 0.3 },
		{ row: "button/button-1000 › mount", metric: "script", shift: 0.37 },
	],
}

describe("bench failures: what a push may carry", () => {
	test("refuses the 4a-1a compare: an SSR exit and a hydrated-DOM mismatch, whatever the allowlist", () => {
		const verdict = judgeFailures(failureEntries(A1A), BUTTON_ALLOWED)
		expect(verdict.ok).toBe(false)
		expect(verdict.refused).toEqual(["SSR bench exited 1", expect.stringContaining("hydrated DOM differs")])
		expect(verdict.allowed).toHaveLength(2)
		expect(verdict.suspended).toEqual([expect.stringContaining("exit bar: accordion/300 serverMs")])
	})

	test("carries timing rows only when the allowlist names them", () => {
		const timingOnly = failureEntries(A1A).filter((entry) => entry.startsWith("regressed:"))
		expect(judgeFailures(timingOnly, BUTTON_ALLOWED).ok).toBe(true)
		const unnamed = judgeFailures(timingOnly, { entries: [BUTTON_ALLOWED.entries[0]] })
		expect(unnamed.ok).toBe(false)
		expect(unnamed.refused).toEqual([expect.stringContaining("mount script 3.09 → 3.67 (")])
		expect(judgeFailures(timingOnly, null).ok).toBe(false)
	})

	const row = (metric: string, ci: string, verdict: string) =>
		`| button/button-1000 › mount | ${metric} | 3.10 | 3.12 | 0.02 | ${ci} | 0.10 | 4.0e-1 | ${verdict} |`

	test("an entry whose row the run bounded under its shift, not regressed, has expired, and refuses", () => {
		const report = [row("sync", "-0.10 to 0.10", "same"), row("script", "-0.10 to 0.20", "same")].join("\n")
		const verdict = judgeFailures(failureEntries(report), BUTTON_ALLOWED, measuredVerdicts(report))
		expect(verdict.ok).toBe(false)
		expect(verdict.expired).toEqual([
			"button/button-1000 › mount sync: no longer regressed; remove its allowlist entry",
			"button/button-1000 › mount script: no longer regressed; remove its allowlist entry",
		])
	})

	test("an entry the run found not regressed with a CI too wide to say so is inconclusive, and passes", () => {
		// The 2026-10-25 3b0846a5 pair under load: "same", with the shift's CI reaching 0.60 ms.
		const report = [row("sync", "-1.10 to 0.60", "same"), row("script", "-1.15 to 0.65", "same")].join("\n")
		const verdict = judgeFailures(failureEntries(report), BUTTON_ALLOWED, measuredVerdicts(report))
		expect(verdict).toMatchObject({ ok: true, expired: [] })
		expect(verdict.inconclusive).toHaveLength(2)
	})

	test("an entry for a row the run did not measure is unused, not expired", () => {
		const toggleOnly = [
			"| toggle/1000 › mount | sync | 6.30 | 6.30 | 0.00 | -0.60 to 0.20 | 0.19 | 9.0e-1 | same |",
			"| toggle/1000 › mount | script | 6.25 | 6.27 | 0.02 | -0.59 to 0.24 | 0.19 | 8.8e-1 | same |",
		].join("\n")
		const verdict = judgeFailures(failureEntries(toggleOnly), BUTTON_ALLOWED, measuredVerdicts(toggleOnly))
		expect(verdict).toMatchObject({ ok: true, expired: [], inconclusive: [], refused: [] })
	})

	test("with the exit bar no longer suspended (D32 lifted), its entries refuse", () => {
		const entries = failureEntries(A1A).filter((entry) => entry.startsWith("exit bar: "))
		expect(EXIT_BAR_SUSPENDED).toBe(true)
		expect(judgeFailures(entries, null).ok).toBe(true)
		const lifted = judgeFailures(entries, null, new Map(), false)
		expect(lifted.ok).toBe(false)
		expect(lifted.refused).toEqual(entries)
	})

	test("a heap regression is not a timing row", () => {
		expect(timingRow("regressed: field/100 › heap after mount KB heapKB 100.00 → 140.00 (95% CI…)")).toBeNull()
		expect(timingRow("regressed: toggle/1000 › mount sync 6.30 → 6.90 (95% CI…)")).toEqual({
			row: "toggle/1000 › mount",
			metric: "sync",
		})
	})

	test("a report with no Failures section has nothing to carry", () => {
		expect(failureEntries("# Base UI bench\n\n| row |\n")).toEqual([])
		expect(judgeFailures([], { entries: [] }).ok).toBe(true)
	})
})
