import { describe, expect, test } from "bun:test"
import { parseArgs } from "../packages/base-ui/scripts/bench-component.mjs"
import { reactCacheFrom, resolveReact } from "../packages/base-ui/test/perf-solid/shared/react-cache.mjs"

// D29: the scoped gate runs base and cur only and reads React's medians from the last daily regate,
// behind a drift guard: a cached median decides the keeps-React rule only when the decision is the
// same with React 10% faster or slower than cached; otherwise React is re-measured in session.
const meta = { date: "2026-10-21", sha: "abc", reactVersion: "1.9.0", power: "AC" }
const cache = {
	meta,
	medians: { "menu/500 › open": { sync: 10 } },
}
const current = { reactVersion: "1.9.0", power: "AC" }
const below = { maxDelta: 1 }
const verdict = (cur: number, base = cur - 0.5) => ({ key: "menu/500 › open", metric: "sync", base, cur })

describe("React medians for the scoped gate (D29)", () => {
	test("a same-session React median wins", () => {
		expect(resolveReact(verdict(9.95), below, { session: 10.2, cache, current })).toEqual({
			react: 10.2,
			source: "session",
		})
	})

	test("a cached median decides a row that clears it by the margin", () => {
		expect(resolveReact(verdict(8.5), below, { cache, current })).toEqual({ react: 10, source: "cache" })
	})

	test("a row inside the margin is re-measured, not decided on another session's React", () => {
		expect(resolveReact(verdict(9.5), below, { cache, current })).toEqual({ remeasure: true })
	})

	test("a cache from another React version or power state is not used", () => {
		expect(resolveReact(verdict(5), below, { cache, current: { ...current, reactVersion: "1.10.0" } })).toEqual({
			remeasure: true,
		})
		expect(resolveReact(verdict(5), below, { cache, current: { ...current, power: "Battery" } })).toEqual({
			remeasure: true,
		})
		expect(resolveReact(verdict(5), below, { current })).toEqual({ remeasure: true })
	})

	test("the near-React rule is guarded the same way", () => {
		const near = { maxDelta: 2, nearReact: 1.1 }
		expect(resolveReact(verdict(9), near, { cache, current }).source).toBe("cache")
		expect(resolveReact(verdict(10.5), near, { cache, current })).toEqual({ remeasure: true })
	})

	test("the daily regate's React medians become the cache, with their session", () => {
		const summary = {
			"menu/500 › open": { react: { samples: { sync: [9, 10, 11] } }, cur: { samples: { sync: [1] } } },
		}
		expect(reactCacheFrom(summary, meta)).toEqual({ meta, medians: { "menu/500 › open": { sync: 10 } } })
	})

	test("--scoped selects the base-vs-cur gate", () => {
		expect(parseArgs(["menu", "--compare", "b0", "--scoped"]).scoped).toBe(true)
		expect(parseArgs(["menu"]).scoped).toBe(false)
	})
})
