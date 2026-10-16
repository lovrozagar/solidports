import { describe, expect, test } from "bun:test"
import { compareVariants, summarize } from "../packages/base-ui/test/perf-solid/shared/report.mjs"

// Ten samples per side: the rule judges nothing below MIN_SAMPLES.
const ten = (values: number[]) => Array.from({ length: 10 }, (_, i) => values[i % values.length])
const step = (syncIn: number[], scriptIn: number[], settledIn: number[] = []) => {
	const sync = ten(syncIn)
	const script = ten(scriptIn)
	const settled = settledIn.length ? ten(settledIn) : []
	return {
		sync,
		paint: sync.map((v) => v + 1),
		script,
		layout: sync.map(() => 0),
		style: sync.map(() => 0),
		settled,
	}
}

// One scenario, three variants; "leave" waits on a 40 ms timer.
const results = {
	"popover/content-200": {
		react: { steps: { leave: step([2, 2, 2], [1, 1, 1], [50, 50, 50]) }, heapKB: ten([200]) },
		base: { steps: { leave: step([4, 4, 4], [2, 2, 2], [45, 45, 45]) }, heapKB: ten([300]) },
		cur: { steps: { leave: step([6, 6, 6], [2, 2, 2], [60, 60, 60]) }, heapKB: ten([300]) },
	},
}
const timers = { "popover/content-200": { leave: 40 } }

describe("perf report", () => {
	test("summarize keeps medians, settled minus the declared timer, and every ratio to the first variant", () => {
		const summary = summarize(results, ["react", "base", "cur"], timers)
		const leave = summary["popover/content-200 › leave"]
		expect(leave.cur).toMatchObject({ sync: 6, script: 2, settled: 20 })
		expect(leave.base.samples.settled).toEqual(ten([5]))
		expect(leave.ratios).toEqual({ "base/react": { sync: 2, script: 2 }, "cur/react": { sync: 3, script: 2 } })
		expect(summary["popover/content-200 › heap after mount KB"].cur).toMatchObject({ heapKB: 300 })
	})

	test("compareVariants reports raw floor scenarios but never judges them", () => {
		const withRaw = {
			...results,
			"collapsible/raw-300": {
				react: { steps: { close: step([1, 1, 1], [1, 1, 1]) }, heapKB: ten([0]) },
				base: { steps: { close: step([1, 1, 1], [1, 1, 1]) }, heapKB: ten([0]) },
				cur: { steps: { close: step([9, 9, 9], [9, 9, 9]) }, heapKB: ten([0]) },
			},
		}
		const summary = summarize(withRaw, ["react", "base", "cur"], timers)
		const verdicts = compareVariants(summary, "base", "cur", { raw: ["collapsible/raw-300"] })
		expect(verdicts.filter((v) => v.key.startsWith("collapsible/raw-300")).map((v) => v.verdict)).toEqual([
			"unjudged (raw floor)",
			"unjudged (raw floor)",
			"unjudged (raw floor)",
		])
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
