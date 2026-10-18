import { describe, expect, test } from "bun:test"
import {
	EXIT_BAR,
	exitBar,
	GATED,
	FDR_Q,
	judge,
	judgeAll,
	MIN_SAMPLES,
	median,
	mannWhitney,
	p90,
} from "../packages/base-ui/test/perf-solid/shared/regression.mjs"
import { machine, SEEDS, singleRenderSamples } from "./perf-noise-model"
import { DEFAULT_RUNS } from "../packages/base-ui/scripts/bench-component.mjs"

/** Samples a side in a default `bench:component` browser step: two rounds of `--runs`. */
const BENCH_SAMPLES = 2 * DEFAULT_RUNS

const repeat = (value: number, count = 10) => Array.from({ length: count }, () => value)

describe("perf regression rule", () => {
	test("median is the upper middle and p90 the 90th-percentile sample, as run.mjs reports them", () => {
		expect(median([3, 1, 2, 4])).toBe(3)
		expect(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10)
		expect(p90([1, 2, 3, 4, 5])).toBe(5)
	})

	test("a consistent shift beyond the minimum effect is a regression, with its p value and CI", () => {
		const base = [10, 10, 10, 10, 10, 10, 10, 10, 11, 11]
		const cur = [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 13, 13]
		const judged = judge(base, cur, { floor: 0.1 })
		expect(judged).toMatchObject({ verdict: "regressed", delta: 2.5, minEffect: 0.3 })
		expect(judged.p).toBeLessThan(0.01)
		expect(judged.ci[0]).toBeGreaterThan(0)
		expect(judged.ci[0]).toBeLessThanOrEqual(2.5)
		expect(judged.ci[1]).toBeGreaterThanOrEqual(2.5)
	})

	test("an equal shift the other way is an improvement", () => {
		const base = [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 13, 13]
		const cur = [10, 10, 10, 10, 10, 10, 10, 10, 11, 11]
		expect(judge(base, cur, { floor: 0.1 }).verdict).toBe("improved")
	})

	test("a consistent shift within 3% of the base median is the same", () => {
		const base = [100, 100.5, 101, 99.5, 100, 100.2, 99.8, 100.1, 100.4, 99.9]
		const cur = base.map((value) => value * 1.025)
		const judged = judge(base, cur, { floor: 0.1 })
		expect(judged.p).toBeLessThan(0.01)
		expect(judged.verdict).toBe("same")
	})

	test("one outlier on each side does not hide a clear shift", () => {
		// The Mac's progress/1000 server samples, 2026-10-17: the old p90-spread tolerance (72.6 ms)
		// called this halving "same".
		const base = [115.0, 100.8, 98.1, 90.7, 96.8, 91.9, 99.3, 89.4, 93.7, 93.3]
		const cur = [101.8, 46.3, 49.5, 45.8, 45.9, 47.4, 31.7, 53.4, 46.7, 47.7]
		expect(judge(base, cur, { floor: 0.1 }).verdict).toBe("improved")
	})

	test("Mann–Whitney: complete separation of two samples of ten is significant one way only", () => {
		const low = repeat(1).map((value, index) => value + index * 0.01)
		const high = low.map((value) => value + 1)
		expect(mannWhitney(low, high).greater).toBeLessThan(0.001)
		expect(mannWhitney(low, high).less).toBeGreaterThan(0.99)
		expect(mannWhitney(low, low).greater).toBeGreaterThan(0.4)
		expect(mannWhitney(repeat(5), repeat(5))).toEqual({ greater: 1, less: 1 })
	})

	test("the absolute floor holds when both sides have no spread", () => {
		expect(judge(repeat(0.1), repeat(0.2), { floor: 0.1 })).toMatchObject({ verdict: "same", minEffect: 0.1 })
		expect(judge(repeat(0.1), repeat(0.3), { floor: 0.1 }).verdict).toBe("regressed")
	})

	test("a metric with a minimum is ungated unless both medians exceed it", () => {
		expect(judge(repeat(40), repeat(90), { floor: 0, minBoth: 100 }).verdict).toBe("ungated")
		expect(judge(repeat(150), repeat(400), { floor: 0, minBoth: 100 }).verdict).toBe("regressed")
	})

	test("fewer than MIN_SAMPLES on either side is insufficient, never a verdict", () => {
		expect(MIN_SAMPLES).toBe(10)
		expect(judge([1, 1, 1, 1], [2, 2, 2, 2], { floor: 0.1 })).toMatchObject({ verdict: "insufficient" })
		expect(judge(repeat(1, 10), repeat(2, 10), { floor: 0.1 }).verdict).toBe("regressed")
	})

	test("empty samples throw instead of passing", () => {
		expect(() => judge([], [1], { floor: 0.1 })).toThrow("no samples")
	})

	describe("on noisy samples (the simulated Mac clock, first-run outliers included)", () => {
		const verdicts = (baseMs: number, curMs: number) =>
			SEEDS.map((seed) => {
				const samples = singleRenderSamples(machine(seed), baseMs, curMs)
				return judge(samples.base, samples.cur, GATED.sync).verdict
			})
		const count = (list: string[], verdict: string) => list.filter((v) => v === verdict).length

		test("a 2x slowdown is a regression for at least 19 of 20 seeds", () => {
			expect(count(verdicts(50, 100), "regressed")).toBeGreaterThanOrEqual(19)
		})

		test("a 2x speed-up is an improvement for at least 19 of 20 seeds", () => {
			expect(count(verdicts(100, 50), "improved")).toBeGreaterThanOrEqual(19)
		})

		test("a 1.03x shift is the same for every seed", () => {
			expect(count(verdicts(100, 103), "same")).toBe(SEEDS.length)
		})

		test("identical builds are the same for at least 19 of 20 seeds", () => {
			expect(count(verdicts(80, 80), "same")).toBeGreaterThanOrEqual(19)
		})
	})

	describe("one run's many comparisons (Benjamini–Hochberg at q = 0.05, then the margin)", () => {
		const PAIRS = 400
		/**
		 * One simulated full-bench run: `PAIRS` step × metric pairs, `slow` of them 2x slower in cur,
		 * 24 samples a side (`bench:component`'s default `--runs 12`, two rounds). At 16 a side the
		 * rank test cannot reach the BH threshold for five discoveries among 400 when GC outliers
		 * straddle the shift: 14 of 100 true regressions were missed, 3 at 20, none at 24.
		 */
		const run = (seed: number, slow: Set<number>) =>
			judgeAll(
				Array.from({ length: PAIRS }, (_, index) => {
					const samples = singleRenderSamples(
						machine(seed * 10_000 + index),
						40,
						slow.has(index) ? 80 : 40,
						BENCH_SAMPLES,
					)
					return { key: `pair-${index}`, metric: "sync", base: samples.base, cur: samples.cur, rule: GATED.sync }
				}),
			)

		test("an A/A run of 400 pairs averages at most one false regression over 20 seeds", () => {
			const falseRegressions = SEEDS.map(
				(seed) => run(seed, new Set()).verdicts.filter((v) => v.verdict === "regressed").length,
			)
			const mean = falseRegressions.reduce((sum, count) => sum + count, 0) / SEEDS.length
			expect(mean).toBeLessThanOrEqual(1)
		})

		test("five true 2x regressions among 400 pairs are all flagged, for every seed", () => {
			const slow = new Set([3, 77, 150, 261, 399])
			for (const seed of SEEDS) {
				const flagged = run(seed, slow)
					.verdicts.filter((v) => v.verdict === "regressed")
					.map((v) => Number(v.key.slice(5)))
				expect(flagged.filter((index) => slow.has(index)).sort((a, b) => a - b)).toEqual([...slow])
			}
		})

		test("the run reports how many pairs it judged and the BH threshold it used", () => {
			const judged = judgeAll([
				{ key: "a", metric: "sync", base: repeat(1, 10), cur: repeat(1, 10), rule: GATED.sync },
				{ key: "b", metric: "sync", base: [1, 1, 1, 1], cur: [2, 2, 2, 2], rule: GATED.sync },
				{
					key: "c",
					metric: "sync",
					base: repeat(1).map((v, i) => v + i * 0.01),
					cur: repeat(3).map((v, i) => v + i * 0.01),
					rule: GATED.sync,
				},
			])
			expect(FDR_Q).toBe(0.05)
			// "b" has too few samples: it is insufficient and not counted.
			expect(judged.pairs).toBe(2)
			expect(judged.threshold).toBeGreaterThan(0)
			expect(judged.verdicts.map((v) => v.verdict)).toEqual(["same", "insufficient", "regressed"])
		})
	})

	test("gated metrics: sync, script, settled, server and hydration ms on a 0.1 ms floor; heap, step heap growth and a first open's budget above 100 KB", () => {
		expect(GATED).toEqual({
			sync: { floor: 0.1 },
			script: { floor: 0.1 },
			settled: { floor: 0.1 },
			serverMs: { floor: 0.1 },
			hydrateSyncMs: { floor: 0.1 },
			heapKB: { floor: 0, minBoth: 100 },
			retainedKB: { floor: 0, minBoth: 100 },
			openBudgetKB: { floor: 0, minBoth: 100 },
		})
	})
})

describe("plan 3 exit bar", () => {
	const row = (react: number, solid: number) => ({
		react: { serverMs: react, hydrateCommitMs: react },
		cur: { serverMs: solid, hydrateCommitMs: solid },
	})

	test("the port must be within 1.25x of its floor and faster than React, per metric", () => {
		expect(EXIT_BAR).toBe(1.25)
		const results = { "x/300": row(10, 5), "x/300-floor": row(10, 4) }
		expect(exitBar(results, "cur")).toEqual([
			{
				key: "x/300",
				metric: "serverMs",
				port: 5,
				floor: 4,
				react: 10,
				portVsFloor: 1.25,
				portVsReact: 0.5,
				floorVsReact: 0.4,
				pass: true,
			},
			{
				key: "x/300",
				metric: "hydrateCommitMs",
				port: 5,
				floor: 4,
				react: 10,
				portVsFloor: 1.25,
				portVsReact: 0.5,
				floorVsReact: 0.4,
				pass: true,
			},
		])
	})

	test("fails above 1.25x of the floor, or at or above React", () => {
		expect(exitBar({ "x/1": row(10, 5.1), "x/1-floor": row(10, 4) }, "cur").every((v) => !v.pass)).toBe(true)
		expect(exitBar({ "x/1": row(5, 5), "x/1-floor": row(5, 4.5) }, "cur").every((v) => !v.pass)).toBe(true)
	})

	test("judges only cases with a floor twin, and skips a metric either side lacks", () => {
		expect(exitBar({ "x/1": row(10, 5) }, "cur")).toEqual([])
		const results = { "x/1": row(10, 5), "x/1-floor": { react: { serverMs: 10 }, cur: { serverMs: 4 } } }
		expect(exitBar(results, "cur").map((v) => v.metric)).toEqual(["serverMs"])
	})
})
