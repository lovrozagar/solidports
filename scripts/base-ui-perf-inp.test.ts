import { describe, expect, test } from "bun:test"
import { recordInteractions } from "../packages/base-ui/test/perf-solid/ssr/interact.mjs"

/** A window stand-in: capture listeners, a frame queue and a task queue, and a settable clock. */
function fakeWindow() {
	let now = 0
	const listeners = new Map<string, ((event: { timeStamp: number }) => void)[]>()
	const frames: (() => void)[] = []
	const tasks: (() => void)[] = []
	const target = {
		performance: { now: () => now },
		addEventListener(type: string, handler: (event: { timeStamp: number }) => void, capture: boolean) {
			expect(capture).toBe(true)
			listeners.set(type, [...(listeners.get(type) ?? []), handler])
		},
		requestAnimationFrame: (callback: () => void) => frames.push(callback),
		setTimeout: (callback: () => void) => tasks.push(callback),
	} as Record<string, any>
	return {
		target,
		at: (ms: number) => {
			now = ms
		},
		fire: (type: string) => {
			for (const handler of listeners.get(type) ?? []) handler({ timeStamp: now })
		},
		paint: (ms: number) => {
			now = ms
			for (const frame of frames.splice(0)) frame()
			for (const task of tasks.splice(0)) task()
		},
	}
}

describe("INP: press to the next paint after the click (D29)", () => {
	test("each interaction runs from its pointerdown to the paint after its click", () => {
		const page = fakeWindow()
		recordInteractions(page.target)
		page.at(100)
		page.fire("pointerdown")
		page.at(104)
		page.fire("click")
		page.paint(121.5)
		page.at(500)
		page.fire("pointerdown")
		page.at(503)
		page.fire("click")
		page.paint(509.25)
		expect(page.target.__interactions.map((i: { latencyMs: number }) => i.latencyMs)).toEqual([21.5, 9.25])
	})

	test("a click with no press (a keyboard activation) runs from the click", () => {
		const page = fakeWindow()
		recordInteractions(page.target)
		page.at(10)
		page.fire("click")
		page.paint(18)
		expect(page.target.__interactions[0].latencyMs).toBe(8)
	})
})
