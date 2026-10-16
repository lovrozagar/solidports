import { beforeAll, describe, expect, test } from "bun:test"
import { runStep } from "../packages/base-ui/test/perf-solid/shared/step.ts"
import type { Step, StepContext } from "../packages/base-ui/test/perf-solid/shared/types.ts"

// Frames resolve on the next task, so every fixed-frame wait finishes long before a 40 ms timer,
// the way fast frames do in a lightly loaded browser.
beforeAll(() => {
	globalThis.requestAnimationFrame ??= (callback: FrameRequestCallback) =>
		setTimeout(() => callback(performance.now()), 0) as unknown as number
})

const ctx = {
	lib: { name: "solid", mount() {}, unmount() {}, set() {}, flush() {} },
	root: {},
} as unknown as StepContext

/** A popup that closes on a timer after the action, as safePolygon's 40 ms close does. */
function closingStep(): Step {
	let open = true
	return {
		name: "leave",
		run: () => {
			setTimeout(() => {
				open = false
			}, 40)
		},
		settle: true,
		until: () => !open,
		verify: () => ({ open }),
	}
}

describe("perf harness step", () => {
	test("verify waits for `until` instead of reading after a fixed number of frames", async () => {
		const result = await runStep(closingStep(), ctx)
		expect({ summary: result.summary, error: result.error }).toEqual({ summary: '{"open":false}', error: null })
	})

	test("an `until` that never holds fails the step with a named error", async () => {
		const step: Step = { name: "stuck", run: () => {}, until: () => false, verify: () => ({}) }
		const result = await runStep(step, ctx)
		expect(result.summary).toBeNull()
		expect(result.error).toMatch(/^until: did not hold within \d+ ms$/)
	})
})
