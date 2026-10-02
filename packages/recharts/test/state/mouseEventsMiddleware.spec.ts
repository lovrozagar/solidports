import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../src/state/store"
import { createMouseEventHandlers } from "../../src/state/mouseEventsMiddleware"
import type { HTMLMousePointer } from "../../src/util/types"
import { getMockDomRect } from "../helper/mockGetBoundingClientRect"

function createMockMousePointer(x: number, y: number): HTMLMousePointer {
	return {
		clientX: x,
		clientY: y,
		currentTarget: {
			getBoundingClientRect: () => getMockDomRect({ height: 300, width: 500 }),
			offsetHeight: 300,
			offsetWidth: 500,
		},
	}
}

describe("mouseClickHandlers", () => {
	let store: ReturnType<typeof createRechartsStore>[0]
	let setStore: ReturnType<typeof createRechartsStore>[1]
	let handlers: ReturnType<typeof createMouseEventHandlers>

	beforeEach(() => {
		vi.useFakeTimers()
		const result = createRechartsStore()
		store = result[0]
		setStore = result[1]
		handlers = createMouseEventHandlers(store, setStore)
	})
	afterEach(() => {
		vi.useRealTimers()
	})
	it("should run immediately without requestAnimationFrame", () => {
		const mockMousePointer = createMockMousePointer(100, 100)
		expect(vi.getTimerCount()).toBe(0)

		handlers.handleMouseClick(mockMousePointer)
		expect(vi.getTimerCount()).toBe(0)
	})
	it("should handle multiple clicks without canceling each other", () => {
		const click1 = createMockMousePointer(50, 50)
		const click2 = createMockMousePointer(100, 100)
		const click3 = createMockMousePointer(150, 150)

		handlers.handleMouseClick(click1)
		handlers.handleMouseClick(click2)
		handlers.handleMouseClick(click3)

		/* No timers should be pending since clicks are synchronous */
		expect(vi.getTimerCount()).toBe(0)
	})
})
describe("mouseMoveHandlers", () => {
	let store: ReturnType<typeof createRechartsStore>[0]
	let setStore: ReturnType<typeof createRechartsStore>[1]
	let handlers: ReturnType<typeof createMouseEventHandlers>

	beforeEach(() => {
		vi.useFakeTimers()
		const result = createRechartsStore()
		store = result[0]
		setStore = result[1]
		handlers = createMouseEventHandlers(store, setStore)
	})
	afterEach(() => {
		vi.useRealTimers()
	})
	it("should debounce rapid mousemove events using requestAnimationFrame", () => {
		const move1 = createMockMousePointer(50, 50)
		const move2 = createMockMousePointer(100, 100)
		const move3 = createMockMousePointer(150, 150)

		handlers.handleMouseMove(move1)
		expect(vi.getTimerCount()).toBe(1)

		handlers.handleMouseMove(move2)
		/* Should cancel previous RAF and schedule new one - still 1 timer */
		expect(vi.getTimerCount()).toBe(1)

		handlers.handleMouseMove(move3)
		/* Should cancel previous RAF and schedule new one - still 1 timer */
		expect(vi.getTimerCount()).toBe(1)

		/* Process the RAF */
		vi.runOnlyPendingTimers()
		flush()
		expect(vi.getTimerCount()).toBe(0)
	})
})
