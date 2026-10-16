import { describe, expect, test } from "bun:test"
import { compareVariants, summarize } from "../packages/base-ui/test/perf-solid/shared/report.mjs"

const step = (sync: number[], script: number[], settled: number[] = []) => ({
	sync,
	paint: sync.map((v) => v + 1),
	script,
	layout: sync.map(() => 0),
	style: sync.map(() => 0),
	settled,
})

// One scenario, three variants; "leave" waits on a 40 ms timer.
const results = {
	"popover/content-200": {
		react: { steps: { leave: step([2, 2, 2], [1, 1, 1], [50, 50, 50]) }, heapKB: [200, 200, 200] },
		base: { steps: { leave: step([4, 4, 4], [2, 2, 2], [45, 45, 45]) }, heapKB: [300, 300, 300] },
		cur: { steps: { leave: step([6, 6, 6], [2, 2, 2], [60, 60, 60]) }, heapKB: [300, 300, 300] },
	},
}
const timers = { "popover/content-200": { leave: 40 } }

describe("perf report", () => {
	test("summarize keeps medians, settled minus the declared timer, and every ratio to the first variant", () => {
		const summary = summarize(results, ["react", "base", "cur"], timers)
		const leave = summary["popover/content-200 › leave"]
		expect(leave.cur).toMatchObject({ sync: 6, script: 2, settled: 20 })
		expect(leave.base.samples.settled).toEqual([5, 5, 5])
		expect(leave.ratios).toEqual({ "base/react": { sync: 2, script: 2 }, "cur/react": { sync: 3, script: 2 } })
		expect(summary["popover/content-200 › heap after mount KB"].cur).toMatchObject({ heapKB: 300 })
	})

	test("a step without a timer reports no settled value", () => {
		const summary = summarize(results, ["react", "base", "cur"], {})
		expect(summary["popover/content-200 › leave"].cur.settled).toBeNull()
	})

	test("compareVariants judges each gated metric of cur against base and lists regressions", () => {
		const summary = summarize(results, ["react", "base", "cur"], timers)
		const verdicts = compareVariants(summary, "base", "cur")
		const leave = verdicts.filter((v) => v.key === "popover/content-200 › leave")
		expect(leave.map((v) => [v.metric, v.verdict])).toEqual([
			["sync", "regressed"],
			["script", "same"],
			["settled", "regressed"],
		])
		const heap = verdicts.find((v) => v.metric === "heapKB")
		expect(heap?.verdict).toBe("same")
	})
})
