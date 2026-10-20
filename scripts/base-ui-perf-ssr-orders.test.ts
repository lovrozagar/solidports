import { describe, expect, test } from "bun:test"
import { GATED, judgeAll } from "../packages/base-ui/test/perf-solid/shared/regression.mjs"
import { random } from "./perf-noise-model"

/**
 * One SSR process's samples: each variant's renders at `ms` with 1% noise, plus `offset` on the
 * variant whose bundle the process loaded first. The Mac's csbnoise and csbnoise2 (2026-10-20)
 * read such offsets on identical code: every sample of one bundle shifted together (CI width
 * 0.02 ms) and the sign followed the order of SSR_VARIANTS.
 */
function ssrProcess(seed: number, baseMs: number, curMs: number, offset: { base?: number; cur?: number }) {
	const next = random(seed)
	const samples = (ms: number, extra = 0) => Array.from({ length: 20 }, () => ms * (0.995 + next() * 0.01) + extra)
	return { base: samples(baseMs, offset.base), cur: samples(curMs, offset.cur) }
}

const rule = GATED.serverMs

describe("SSR verdicts from two processes in swapped order", () => {
	test("an offset that follows the load order flags each process alone, and neither when both must agree", () => {
		const ab = ssrProcess(1, 1, 1, { base: 0.15 })
		const ba = ssrProcess(2, 1, 1, { cur: 0.15 })
		expect(judgeAll([{ key: "x", metric: "serverMs", ...ba, rule }]).verdicts[0].verdict).toBe("regressed")
		const [verdict] = judgeAll([{ key: "x", metric: "serverMs", orders: [ab, ba], rule }]).verdicts
		expect(verdict.verdict).toBe("same")
		expect(verdict.orders.map((o: { verdict: string }) => o.verdict)).toEqual(["improved", "regressed"])
		// The mean cancels an additive order offset: it is the effect estimate.
		expect(Math.abs(verdict.delta)).toBeLessThan(0.02)
	})

	test("a real regression in both orders is a regression, its delta the mean of the two", () => {
		const ab = ssrProcess(3, 1, 1.3, { base: 0.05 })
		const ba = ssrProcess(4, 1, 1.3, { cur: 0.05 })
		const [verdict] = judgeAll([{ key: "x", metric: "serverMs", orders: [ab, ba], rule }]).verdicts
		expect(verdict.verdict).toBe("regressed")
		expect(verdict.orders).toHaveLength(2)
		expect(verdict.delta).toBeCloseTo((verdict.orders[0].delta + verdict.orders[1].delta) / 2, 10)
		expect(verdict.delta).toBeGreaterThan(0.25)
	})

	test("a shift in one order only stays visible: both deltas are reported though the verdict is same", () => {
		const ab = ssrProcess(5, 1, 1.3, {})
		const ba = ssrProcess(6, 1, 1, {})
		const [verdict] = judgeAll([{ key: "x", metric: "serverMs", orders: [ab, ba], rule }]).verdicts
		expect(verdict.verdict).toBe("same")
		expect(verdict.orders[0]).toMatchObject({ verdict: "regressed" })
		expect(verdict.orders[0].delta).toBeGreaterThan(0.25)
		expect(verdict.orders[1].delta).toBeLessThan(0.02)
	})

	test("Benjamini–Hochberg counts a two-order row once, at the larger of its two p values", () => {
		const items = [
			{ key: "a", metric: "serverMs", orders: [ssrProcess(7, 1, 1.3, {}), ssrProcess(8, 1, 1.3, {})], rule },
			{ key: "b", metric: "serverMs", orders: [ssrProcess(9, 1, 1, {}), ssrProcess(10, 1, 1, {})], rule },
		]
		const judged = judgeAll(items)
		expect(judged.pairs).toBe(2)
		expect(judged.verdicts.map((v: { verdict: string }) => v.verdict)).toEqual(["regressed", "same"])
	})

	test("a row with too few samples in either order is insufficient", () => {
		const short = { base: [1, 1, 1], cur: [1, 1, 1] }
		const [verdict] = judgeAll([
			{ key: "x", metric: "serverMs", orders: [ssrProcess(11, 1, 1, {}), short], rule },
		]).verdicts
		expect(verdict.verdict).toBe("insufficient")
	})
})
