import { describe, expect, test } from "bun:test"
import {
	compareVariants,
	mainThreadLines,
	summarize,
	unmeasuredPairs,
	variantPairs,
} from "../packages/base-ui/test/perf-solid/shared/report.mjs"

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

describe("SSR main-thread table", () => {
	const measured = {
		commitTaskMs: 1.5,
		commitLayoutMs: 0,
		commitStyleMs: 0,
		commitLayouts: 0,
		commitStyles: 0,
		settleTaskMs: 0.4,
		settleLayoutMs: 0,
		settleStyleMs: 0,
	}

	test("writes one row per fixture with both steps", () => {
		const lines = mainThreadLines(["a/1"], { "a/1": { react: measured, solid: measured } }, ["react", "solid"])
		expect(lines.at(-1)).toBe(
			"| a/1 | 1.50 / 0.00 / 0.00 / 0 / 0 · 0.40 / 0.00 / 0.00 | 1.50 / 0.00 / 0.00 / 0 / 0 · 0.40 / 0.00 / 0.00 |",
		)
	})

	test("writes nothing when hydration did not run (SERVER_ONLY)", () => {
		expect(
			mainThreadLines(["a/1"], { "a/1": { react: { serverMs: 1 }, solid: { serverMs: 1 } } }, ["react", "solid"]),
		).toEqual([])
	})
})

// A metric only one side measured (a step one engine skips, an SSR fixture one variant did not
// hydrate) is never judged: an empty side would read as a pass. It is listed as not measured.
describe("one-sided samples", () => {
	const sample = (values: number[]) => ({ samples: { sync: values, script: values, settled: [] } })
	const summary = {
		"menu/200 › open": { base: sample([1, 2, 3]), cur: sample([1, 2, 3]) },
		"menu/200 › long-press": { base: sample([5, 6]), cur: sample([]) },
	}

	test("pairs only metrics both sides measured", () => {
		const pairs = variantPairs(summary, "base", "cur")
		expect(pairs.map((pair) => `${pair.key} ${pair.metric}`)).toEqual([
			"menu/200 › open sync",
			"menu/200 › open script",
		])
	})

	test("judges a step's heap growth as its own metric where both sides measured it", () => {
		const grown = (values: number[]) => ({ samples: { sync: values, script: values, settled: [], growthKB: values } })
		const pairs = variantPairs(
			{ "select/1000 › open": { base: grown([200, 210]), cur: grown([400, 410]) } },
			"base",
			"cur",
		)
		expect(pairs.map((pair) => pair.metric)).toEqual(["sync", "script", "growthKB"])
		expect(pairs[2].rule).toEqual({ floor: 0, minBoth: 100 })
	})

	test("summarize keeps the median heap growth and its samples", () => {
		const withGrowth = {
			"select/1000": {
				base: { steps: { open: { ...step([1, 1, 1], [1, 1, 1]), growthKB: [120, 130, 140] } }, heapKB: ten([0]) },
			},
		}
		const summary = summarize(withGrowth, ["base"], {})
		expect(summary["select/1000 › open"].base).toMatchObject({ growthKB: 130 })
		expect(summary["select/1000 › open"].base.samples.growthKB).toEqual([120, 130, 140])
	})

	test("judges a first-open step's growth together with the mount's heap, one budget", () => {
		const withGrowth = {
			"accordion/300": {
				base: {
					steps: {
						"open all": { ...step([1, 1, 1], [1, 1, 1]), growthKB: [100, 110, 120] },
						"close all": { ...step([1, 1, 1], [1, 1, 1]), growthKB: [50, 60, 70] },
					},
					heapKB: [900, 1000, 1100],
				},
			},
		}
		const summary = summarize(withGrowth, ["base"], {}, { "accordion/300": ["open all"] })
		const open = summary["accordion/300 › open all"]
		expect(open.firstOpen).toBe(true)
		expect(open.base.samples.openBudgetKB).toEqual([1100, 1110, 1120])
		expect(open.base).toMatchObject({ openBudgetKB: 1110 })
		expect(summary["accordion/300 › close all"].firstOpen).toBeUndefined()
		const pair = (entry: object) => ({ base: entry, cur: entry })
		const pairs = variantPairs(
			{
				"accordion/300 › open all": { ...pair(open.base), firstOpen: true },
				"accordion/300 › close all": pair(summary["accordion/300 › close all"].base),
			},
			"base",
			"cur",
		)
		expect(pairs.map((p) => `${p.key.split(" › ")[1]} ${p.metric}`)).toEqual([
			"open all sync",
			"open all script",
			"open all openBudgetKB",
			"close all sync",
			"close all script",
			"close all growthKB",
		])
	})

	test("lists the metrics one side did not measure", () => {
		expect(unmeasuredPairs(summary, "base", "cur")).toEqual([
			"menu/200 › long-press sync: measured by base only",
			"menu/200 › long-press script: measured by base only",
		])
	})
})
