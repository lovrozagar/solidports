import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { runStep } from "../packages/base-ui/test/perf-solid/shared/step.ts"
import type { Step, StepContext } from "../packages/base-ui/test/perf-solid/shared/types.ts"

// A minimal DOM for the step runner: frames fire every `frameMs` (0 = the next task, as fast
// frames do in a lightly loaded browser), and `mutate()` delivers a mutation batch to every
// connected observer, as the browser does after a DOM write.
let frameMs = 0
const observers = new Set<FakeObserver>()
let constructed = 0

class FakeObserver {
	constructor(private readonly callback: () => void) {
		constructed += 1
	}
	observe() {
		observers.add(this)
	}
	disconnect() {
		observers.delete(this)
	}
	deliver() {
		this.callback()
	}
}

function mutate() {
	queueMicrotask(() => {
		for (const observer of observers) observer.deliver()
	})
}

beforeAll(() => {
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
		setTimeout(() => callback(performance.now()), frameMs) as unknown as number
	Object.assign(globalThis, { MutationObserver: FakeObserver, document: {} })
})

afterEach(() => {
	frameMs = 0
	constructed = 0
	observers.clear()
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
				mutate()
			}, 40)
		},
		settle: true,
		until: () => !open,
		timerMs: 40,
		verify: () => ({ open }),
	}
}

describe("perf harness step", () => {
	test("verify waits for `until` instead of reading after a fixed number of frames", async () => {
		const result = await runStep(closingStep(), ctx)
		expect({ summary: result.summary, error: result.error }).toEqual({ summary: '{"open":false}', error: null })
	})

	test("an `until` that never holds fails the step with a named error", async () => {
		const step: Step = { name: "stuck", run: () => {}, until: () => false, timerMs: 0, verify: () => ({}) }
		const result = await runStep(step, ctx)
		expect(result.summary).toBeNull()
		expect(result.error).toMatch(/^until: did not hold within \d+ ms$/)
	})

	test("settled is timed at the mutation where `until` first holds, not at a frame", async () => {
		frameMs = 200
		const result = await runStep(closingStep(), ctx)
		expect(result.error).toBeNull()
		expect(result.settled).toBeGreaterThanOrEqual(40)
		expect(result.settled).toBeLessThan(200)
	})

	test("an `until` that already holds before the step runs is an error, not a zero", async () => {
		const step: Step = { name: "vacuous", run: () => {}, until: () => true, timerMs: 0, verify: () => ({}) }
		const result = await runStep(step, ctx)
		expect(result.error).toBe("until: held before the step ran, so it measures nothing")
	})

	test("an `until` on state no mutation reports still settles through the frame fallback", async () => {
		let done = false
		const step: Step = {
			name: "state",
			run: () => {
				setTimeout(() => {
					done = true
				}, 10)
			},
			until: () => done,
			timerMs: 10,
		}
		const result = await runStep(step, ctx)
		expect({ error: result.error, settled: typeof result.settled }).toEqual({ error: null, settled: "number" })
	})

	test("steps without `until` create no observer and report no settled time", async () => {
		const result = await runStep({ name: "plain", run: () => {}, settle: true }, ctx)
		expect({ constructed, settled: result.settled }).toEqual({ constructed: 0, settled: null })
	})
})
