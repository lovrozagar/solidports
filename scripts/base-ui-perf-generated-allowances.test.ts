import { describe, expect, test } from "bun:test"
import { generateAllowances, validateGenerated } from "../packages/base-ui/test/perf-solid/shared/allowances.mjs"

// D28 as amended by D29: the gate applies the D24 rule itself. A time regression is allowed when
// the same run (base..cur, one commit range) holds a win in its family at least 10x the family's
// losses, the shift is within max(0.5 ms, 10% of base), the keeps-React rule holds, and the entry
// expires at the family's next leaf. A row with a hand entry is never generated, so a generated
// rule never widens a reviewed bound.
const verdict = (key: string, metric: string, base: number, cur: number, kind = "regressed") => ({
	key,
	metric,
	base,
	cur,
	delta: cur - base,
	ci: [cur - base, cur - base] as [number, number],
	verdict: kind,
})
const react = () => 100

describe("generated allowances (D28, D29)", () => {
	test("a small loss paid for by a same-family win of 10x or more is allowed, with its evidence", () => {
		const loss = verdict("toolbar/200 › Tab x50", "sync", 0.9, 1.2)
		const win = verdict("toolbar/200 › ArrowRight x100", "sync", 40, 17.9, "improved")
		const { generated, failing } = generateAllowances([loss], [win], { reactMedian: react })
		expect(failing).toEqual([])
		expect(generated).toHaveLength(1)
		const [entry] = generated
		expect(entry.allowance.win).toBe("toolbar/200 › ArrowRight x100 sync")
		expect(entry.allowance.ratio).toBeCloseTo(22.1 / 0.3, 5)
		expect(entry.allowance.cap).toBe(0.5)
		expect(entry.allowance.until).not.toBe("")
		expect(validateGenerated(generated)).toEqual([])
	})

	test("past the cap, under 10x, or with no same-family win, it fails", () => {
		const capped = verdict("toolbar/200 › Tab x50", "sync", 2, 2.7)
		const win = verdict("toolbar/200 › ArrowRight x100", "sync", 40, 17.9, "improved")
		expect(generateAllowances([capped], [win], { reactMedian: react }).failing).toHaveLength(1)
		const loss = verdict("toolbar/200 › Tab x50", "sync", 0.9, 1.2)
		const small = verdict("toolbar/200 › ArrowRight x100", "sync", 40, 38, "improved")
		expect(generateAllowances([loss], [small], { reactMedian: react }).failing).toHaveLength(1)
		const elsewhere = verdict("menu/500 › open", "sync", 40, 10, "improved")
		expect(generateAllowances([loss], [elsewhere], { reactMedian: react }).failing).toHaveLength(1)
	})

	test("the keeps-React rule still holds", () => {
		const loss = verdict("toolbar/200 › Tab x50", "sync", 0.9, 1.2)
		const win = verdict("toolbar/200 › ArrowRight x100", "sync", 40, 17.9, "improved")
		expect(generateAllowances([loss], [win], { reactMedian: () => 1.0 }).failing).toHaveLength(1)
	})

	test("a row with a hand entry is never generated, even past its bound", () => {
		// toolbar/200 open menu via toolbar button sync has a hand entry (D25, maxDelta 0.2).
		const over = verdict("toolbar/200 › open menu via toolbar button", "sync", 3.4, 3.8)
		const win = verdict("toolbar/200 › ArrowRight x100", "sync", 40, 17.9, "improved")
		const { generated, failing } = generateAllowances([over], [win], { reactMedian: react })
		expect(generated).toEqual([])
		expect(failing).toHaveLength(1)
	})

	test("validation rejects a generated row whose evidence no longer meets the rule", () => {
		const loss = verdict("toolbar/200 › Tab x50", "sync", 0.9, 1.2)
		const win = verdict("toolbar/200 › ArrowRight x100", "sync", 40, 17.9, "improved")
		const { generated } = generateAllowances([loss], [win], { reactMedian: react })
		const widened = [{ ...generated[0], delta: 0.8 }]
		expect(validateGenerated(widened).length).toBeGreaterThan(0)
	})

	test("a TTI or INP loss is paid only by a win in the same metric, never by a raw sync win", () => {
		const loss = verdict("menu/page", "ttiMs", 300, 301)
		const syncWin = verdict("menu/500 › open", "sync", 40, 10, "improved")
		expect(generateAllowances([loss], [syncWin], { reactMedian: () => 1000 }).failing).toHaveLength(1)
		const ttiWin = verdict("menu/page", "ttiMs", 400, 300, "improved")
		expect(generateAllowances([loss], [ttiWin], { reactMedian: () => 1000 }).generated).toHaveLength(1)
	})
})
