// @vitest-environment node
import { beforeAll, describe, expect, test, vi } from "vitest"
import { average, measureTwins, twinsReachable } from "./liveTwins"

const ROUTE = "bar"
const SELECTOR = ".recharts-bar-rectangle"
const PASSES = 5
/* Solid must paint the first bar no later than React on the same machine and run. */
const MAX_RATIO = 1

/* test/vitest.setup.ts installs fake timers; page waits and fetch timeouts need real ones. */
beforeAll(() => {
	vi.useRealTimers()
})

describe("mount benchmark — T1", () => {
	test(
		"avg tFirstPaint Solid / React <= 1 (live React twin)",
		async () => {
			if (!(await twinsReachable())) {
				return
			}
			const runs = await measureTwins(ROUTE, SELECTOR, PASSES, 0)
			const solid = average(runs.solid.map((r) => r.tFirstPaint))
			const react = average(runs.react.map((r) => r.tFirstPaint))
			const ratio = solid / react
			console.log(`T1 mount ${ROUTE}: solid=${solid.toFixed(1)}ms react=${react.toFixed(1)}ms ratio=${ratio.toFixed(3)}`)
			expect(ratio).toBeLessThanOrEqual(MAX_RATIO)
		},
		180_000,
	)
})
