import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createRechartsStore } from "../../src/state/store"
import { createMouseEventHandlers } from "../../src/state/mouseEventsMiddleware"
import { createKeyboardEventHandlers } from "../../src/state/keyboardEventsMiddleware"
import { createExternalEventHandlers } from "../../src/state/externalEventsMiddleware"
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

describe("Throttling Handlers", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})
	describe("mouseMoveHandlers", () => {
		it("should use RAF by default", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: "raf", throttledEvents: "all" })
			const handlers = createMouseEventHandlers(store, setStore)
			const move1 = createMockMousePointer(50, 50)

			handlers.handleMouseMove(move1)
			expect(vi.getTimerCount()).toBe(1)

			vi.advanceTimersByTime(10_000)
			expect(vi.getTimerCount()).toBe(0)
		})
		it("should use setTimeout when throttleDelay is a number", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: 100, throttledEvents: "all" })
			const handlers = createMouseEventHandlers(store, setStore)
			const move1 = createMockMousePointer(50, 50)

			handlers.handleMouseMove(move1)
			expect(vi.getTimerCount()).toBe(1)

			vi.advanceTimersByTime(50)
			expect(vi.getTimerCount()).toBe(1)

			vi.advanceTimersByTime(50)
			expect(vi.getTimerCount()).toBe(0)
		})
		it("should run synchronously when throttledEvents does not include mousemove", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: "raf", throttledEvents: ["click"] })
			const handlers = createMouseEventHandlers(store, setStore)
			const move1 = createMockMousePointer(50, 50)

			handlers.handleMouseMove(move1)
			expect(vi.getTimerCount()).toBe(0)
		})
		it("should run synchronously when throttledEvents is empty", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: "raf", throttledEvents: [] })
			const handlers = createMouseEventHandlers(store, setStore)
			const move1 = createMockMousePointer(50, 50)

			handlers.handleMouseMove(move1)
			expect(vi.getTimerCount()).toBe(0)
		})
		it("should throttle mousemove events (not debounce) when throttleDelay is a number", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: 100, throttledEvents: "all" })
			const handlers = createMouseEventHandlers(store, setStore)
			const move1 = createMockMousePointer(50, 50)
			const move2 = createMockMousePointer(60, 60)

			/* t=0 */
			handlers.handleMouseMove(move1)
			expect(vi.getTimerCount()).toBe(1)

			/* t=50 */
			vi.advanceTimersByTime(50)
			handlers.handleMouseMove(move2)
			/*
			 * Should still be 1 timer.
			 * If debounced: new timer starts at t=50, expires at t=150.
			 * If throttled: old timer kept at t=0, expires at t=100.
			 */
			expect(vi.getTimerCount()).toBe(1)

			/* t=110 (advance another 60) */
			vi.advanceTimersByTime(60)
			/* If throttled, timer should have fired at t=100. */
			expect(vi.getTimerCount()).toBe(0)
		})
	})
	describe("keyboardEventsHandlers", () => {
		it("should throttle keydown events (not debounce) when throttleDelay is a number", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: 100, throttledEvents: "all" })
			const handlers = createKeyboardEventHandlers(store, setStore)

			/* t=0 */
			handlers.handleKeyDown("ArrowRight")
			expect(vi.getTimerCount()).toBe(1)

			/* t=50 */
			vi.advanceTimersByTime(50)
			handlers.handleKeyDown("ArrowRight")
			expect(vi.getTimerCount()).toBe(1)

			/* t=110 */
			vi.advanceTimersByTime(60)
			expect(vi.getTimerCount()).toBe(0)
		})
	})
	describe("externalEventsHandlers", () => {
		it("should execute first event immediately (leading edge) when throttleDelay is a number", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: 100, throttledEvents: "all" })
			const handlers = createExternalEventHandlers(store, setStore)
			const mockHandler = vi.fn()
			const mockEvent = new Event("click")

			handlers.handleExternalEvent(mockEvent, mockHandler)

			expect(mockHandler).toHaveBeenCalledTimes(1)
			expect(vi.getTimerCount()).toBe(1)

			vi.advanceTimersByTime(10_000)
			expect(vi.getTimerCount()).toBe(0)
		})
		it("should throttle click event (leading + trailing) when configured", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: 100, throttledEvents: "all" })
			const handlers = createExternalEventHandlers(store, setStore)
			const mockHandler = vi.fn()
			const mockEvent = new Event("click")

			/* t=0: Event 1 (Leading) */
			handlers.handleExternalEvent(mockEvent, mockHandler)
			expect(mockHandler).toHaveBeenCalledTimes(1)

			/* t=50: Event 2 (Ignored/Saved for trailing) */
			handlers.handleExternalEvent(mockEvent, mockHandler)
			expect(mockHandler).toHaveBeenCalledTimes(1)

			/* t=110: Timer fires (Trailing) */
			vi.advanceTimersByTime(110)
			expect(mockHandler).toHaveBeenCalledTimes(2)
			expect(vi.getTimerCount()).toBe(0)
		})
		it("should NOT throttle click event when not in allowlist", () => {
			const [store, setStore] = createRechartsStore()
			setStore("eventSettings", { throttleDelay: 100, throttledEvents: ["mousemove"] })
			const handlers = createExternalEventHandlers(store, setStore)
			const mockHandler = vi.fn()
			const mockEvent = new Event("click")

			handlers.handleExternalEvent(mockEvent, mockHandler)

			expect(vi.getTimerCount()).toBe(0)
			expect(mockHandler).toHaveBeenCalled()
		})
	})
})
