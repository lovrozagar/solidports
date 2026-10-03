// @vitest-environment node
import { beforeAll, describe, expect, test, vi } from "vitest"
import { average, measureTwins, twinsReachable } from "./liveTwins"

const ROUTE = "bar"
const SELECTOR = ".recharts-bar-rectangle"
const PASSES = 5
const WINDOW_MS = 800
/* Post-mount animation frames must cost no more than React's on the same machine and run. */
const MAX_RATIO = 1

/* test/vitest.setup.ts installs fake timers; page waits and fetch timeouts need real ones. */
beforeAll(() => {
	vi.useRealTimers()
})

describe("animation tick benchmark — T4", () => {
	test(
		"avg post-mount rAF time Solid / React <= 1 (live React twin)",
		async () => {
			if (!(await twinsReachable())) {
				return
			}
			const runs = await measureTwins(ROUTE, SELECTOR, PASSES, WINDOW_MS)
			const solidSamples = runs.solid.flatMap((r) => r.rafSamples)
			const reactSamples = runs.react.flatMap((r) => r.rafSamples)
			if (solidSamples.length === 0 || reactSamples.length === 0) {
				console.log("T4: no post-mount rAF samples on one side; skipping ratio assertion")
				return
			}
			const solid = average(solidSamples)
			const react = average(reactSamples)
			const ratio = solid / react
			console.log(
				`T4 animation ${ROUTE}: solid=${solid.toFixed(4)}ms (${solidSamples.length}) react=${react.toFixed(4)}ms (${reactSamples.length}) ratio=${ratio.toFixed(3)}`,
			)
			expect(ratio).toBeLessThanOrEqual(MAX_RATIO)
		},
		180_000,
	)
})
