import { describe, expect, test } from "bun:test"
import { GATED } from "../packages/base-ui/test/perf-solid/shared/regression.mjs"
import { DEAD_TRIGGER, firstHandledClick } from "../packages/base-ui/test/perf-solid/ssr/interact.mjs"
import { ssrPairs } from "../packages/base-ui/scripts/bench-component.mjs"

/**
 * A page stand-in: a clock that advances 16 ms a frame, and a trigger that becomes interactive at
 * `liveAt` ms; a click after that produces the effect `lag` frames later. The clock is async, as
 * the page's `performance.now()` is read through `page.evaluate`.
 */
function page({ liveAt, lag = 0 }: { liveAt: number; lag?: number }) {
	let now = 0
	let effectAt = Number.POSITIVE_INFINITY
	const clicks: number[] = []
	return {
		clicks,
		driver: {
			async now() {
				return now
			},
			async nextFrame() {
				now += 16
			},
			async click() {
				clicks.push(now)
				if (now >= liveAt && effectAt === Number.POSITIVE_INFINITY) effectAt = now + lag * 16
			},
			async effectSeen() {
				return now >= effectAt
			},
		},
	}
}

describe("TTI: navigation start to the first click handled (D29)", () => {
	test("is the time of the first click whose effect appears, clicking once per frame", async () => {
		const { driver, clicks } = page({ liveAt: 100 })
		const result = await firstHandledClick(driver, { timeoutMs: 10_000 })
		// Clicks at 0, 16, ..., 96 do nothing; the one at 112 lands.
		expect(result.ttiMs).toBe(112)
		expect(result.clicks).toBe(clicks.length)
		expect(clicks.at(-1)).toBe(112)
	})

	test("checks the effect before clicking again, so a click that lands is not undone", async () => {
		const { driver, clicks } = page({ liveAt: 0, lag: 1 })
		const result = await firstHandledClick(driver, { timeoutMs: 10_000 })
		expect(result.ttiMs).toBe(0)
		expect(clicks).toEqual([0])
	})

	test("a trigger that never responds fails the case outright, not as a slow sample", async () => {
		const { driver, clicks } = page({ liveAt: Number.POSITIVE_INFINITY })
		await expect(firstHandledClick(driver, { timeoutMs: 10_000 })).rejects.toThrow(DEAD_TRIGGER)
		// One click a frame up to the deadline, then none: the page clock bounds the loop.
		expect(clicks.length).toBe(Math.floor(10_000 / 16) + 1)
	})

	test("TTI and both INP measures are gated metrics", () => {
		for (const metric of ["ttiMs", "inpFirstMs", "inpMs"]) expect(GATED).toHaveProperty(metric)
	})

	test("the gate judges TTI and INP in both orders, and leaves out a row that has none", () => {
		const row = (metric: string) => ({
			base: { samples: { serverMs: [1, 2], hydrateSyncMs: [1, 2], [metric]: [10, 11] } },
			cur: { samples: { serverMs: [1, 2], hydrateSyncMs: [1, 2], [metric]: [12, 13] } },
		})
		const ssr = { results: { "menu/page": row("ttiMs"), "progress/1000": row("other") } }
		const { pairs, unmeasured } = ssrPairs(ssr, ssr)
		const keys = pairs.map((p) => `${p.key} ${p.metric}`)
		expect(keys).toContain("menu/page ttiMs")
		expect(keys).not.toContain("progress/1000 ttiMs")
		expect(pairs.find((p) => p.metric === "ttiMs")?.orders).toHaveLength(2)
		expect(unmeasured).toEqual([])
	})
})
