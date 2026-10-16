import { describe, expect, test } from "bun:test"
import { GATED, judge, median, p90 } from "../packages/base-ui/test/perf-solid/shared/regression.mjs"

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

	test("empty samples throw instead of passing", () => {
		expect(() => judge([], [1], { floor: 0.1 })).toThrow("no samples")
	})

	test("gated metrics: sync, script, settled and server ms on a 0.1 ms floor; heap above 100 KB", () => {
		expect(GATED).toEqual({
			sync: { floor: 0.1 },
			script: { floor: 0.1 },
			settled: { floor: 0.1 },
			serverMs: { floor: 0.1 },
			heapKB: { floor: 0, minBoth: 100 },
		})
	})
})
