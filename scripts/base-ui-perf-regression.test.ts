import { describe, expect, test } from "bun:test"
import {
	EXIT_BAR,
	exitBar,
	GATED,
	judge,
	MIN_SAMPLES,
	median,
	p90,
} from "../packages/base-ui/test/perf-solid/shared/regression.mjs"

const repeat = (value: number, count = 10) => Array.from({ length: count }, () => value)

describe("perf regression rule", () => {
	test("median is the upper middle and p90 the 90th-percentile sample, as run.mjs reports them", () => {
		expect(median([3, 1, 2, 4])).toBe(3)
		expect(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10)
		expect(p90([1, 2, 3, 4, 5])).toBe(5)
	})

	test("a shift larger than both sides' p90 spread is a regression", () => {
		// base: median 10, p90 11 (spread 1); cur: median 12.5, p90 13 (spread 0.5); delta 2.5 > 1.5
		const base = [10, 10, 10, 10, 10, 10, 10, 10, 11, 11]
		const cur = [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 13, 13]
		expect(judge(base, cur, { floor: 0.1 })).toMatchObject({
			verdict: "regressed",
			delta: 2.5,
			tolerance: 1.5,
		})
	})

	test("a shift inside the summed spread is the same", () => {
		const base = [10, 10, 10, 10, 10, 10, 10, 10, 11, 11]
		const cur = [11, 11, 11, 11, 11, 11, 11, 11, 11.6, 11.6]
		expect(judge(base, cur, { floor: 0.1 }).verdict).toBe("same")
	})

	test("an equal shift the other way is an improvement", () => {
		const base = [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 13, 13]
		const cur = [10, 10, 10, 10, 10, 10, 10, 10, 11, 11]
		expect(judge(base, cur, { floor: 0.1 }).verdict).toBe("improved")
	})

	test("the absolute floor holds when both sides have no spread", () => {
		expect(judge(repeat(0.1), repeat(0.2), { floor: 0.1 })).toMatchObject({ verdict: "same", tolerance: 0.1 })
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

	test("gated metrics: sync, script, settled, server and hydration ms on a 0.1 ms floor; heap above 100 KB", () => {
		expect(GATED).toEqual({
			sync: { floor: 0.1 },
			script: { floor: 0.1 },
			settled: { floor: 0.1 },
			serverMs: { floor: 0.1 },
			hydrateSyncMs: { floor: 0.1 },
			heapKB: { floor: 0, minBoth: 100 },
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
