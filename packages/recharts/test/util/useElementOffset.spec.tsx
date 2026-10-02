import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@solidjs/testing-library"
import { flush } from "solid-js"
import { useElementOffset } from "../../src/util/useElementOffset"
import { getMockDomRect } from "../helper/mockGetBoundingClientRect"

/*
 * Solid's hook returns an accessor for the offset; `flush()` stands in for React's `act()`
 * so the ResizeObserver effect runs before assertions.
 */
describe("useElementOffset", () => {
	let resizeObserverCallback: ((entries: ResizeObserverEntry[]) => void) | undefined,
		observeSpy: ReturnType<typeof vi.fn>,
		disconnectSpy: ReturnType<typeof vi.fn>

	beforeEach(() => {
		resizeObserverCallback = undefined
		observeSpy = vi.fn()
		disconnectSpy = vi.fn()
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(function ResizeObserverMock(cb: (entries: ResizeObserverEntry[]) => void) {
				resizeObserverCallback = cb
				return { disconnect: disconnectSpy, observe: observeSpy, unobserve: vi.fn() }
			}),
		)
	})

	it("should return initial zero values", () => {
		const { result } = renderHook(() => useElementOffset())
		const [offset] = result
		expect(offset()).toEqual({ height: 0, left: 0, top: 0, width: 0 })
	})

	it("should measure element on ref callback with a non-null node", () => {
		const mockRect = getMockDomRect({ height: 50, left: 10, top: 20, width: 100 })
		const node = document.createElement("div")
		vi.spyOn(node, "getBoundingClientRect").mockReturnValue(mockRect)

		const { result } = renderHook(() => useElementOffset())
		result[1](node)
		flush()

		expect(result[0]()).toEqual({ height: 50, left: 10, top: 20, width: 100 })
	})

	it("should create a ResizeObserver and observe the node", () => {
		const node = document.createElement("div")
		vi.spyOn(node, "getBoundingClientRect").mockReturnValue(getMockDomRect({ height: 50, width: 100 }))

		const { result } = renderHook(() => useElementOffset())
		result[1](node)
		flush()

		expect(observeSpy).toHaveBeenCalledWith(node)
	})

	it("should update state when ResizeObserver detects a size change", () => {
		const node = document.createElement("div")
		vi.spyOn(node, "getBoundingClientRect")
			.mockReturnValueOnce(getMockDomRect({ height: 50, width: 100 }))
			.mockReturnValue(getMockDomRect({ height: 120, width: 100 }))

		const { result } = renderHook(() => useElementOffset())
		result[1](node)
		flush()
		expect(result[0]().height).toBe(50)

		resizeObserverCallback?.([] as unknown as ResizeObserverEntry[])
		flush()
		expect(result[0]().height).toBe(120)
	})

	it("should ignore changes smaller than EPS (1px)", () => {
		const node = document.createElement("div")
		vi.spyOn(node, "getBoundingClientRect")
			.mockReturnValueOnce(getMockDomRect({ height: 50, width: 100 }))
			.mockReturnValue(getMockDomRect({ height: 50.5, width: 100 }))

		const { result } = renderHook(() => useElementOffset())
		result[1](node)
		flush()
		expect(result[0]().height).toBe(50)

		resizeObserverCallback?.([] as unknown as ResizeObserverEntry[])
		flush()
		// Height change of 0.5 is below EPS=1, should not update
		expect(result[0]().height).toBe(50)
	})

	it("should not create a ResizeObserver when node is null", () => {
		const { result } = renderHook(() => useElementOffset())
		result[1](null)
		flush()

		expect(observeSpy).not.toHaveBeenCalled()
	})

	it("should disconnect the previous ResizeObserver when a new node is attached", () => {
		const node1 = document.createElement("div")
		const node2 = document.createElement("div")
		vi.spyOn(node1, "getBoundingClientRect").mockReturnValue(getMockDomRect({ height: 50, width: 100 }))
		vi.spyOn(node2, "getBoundingClientRect").mockReturnValue(getMockDomRect({ height: 80, width: 200 }))

		const { result } = renderHook(() => useElementOffset())
		result[1](node1)
		flush()
		expect(disconnectSpy).not.toHaveBeenCalled()

		result[1](node2)
		flush()
		expect(disconnectSpy).toHaveBeenCalledTimes(1)
		expect(result[0]()).toEqual({ height: 80, left: 0, top: 0, width: 200 })
	})

	it("should disconnect the ResizeObserver on unmount", () => {
		const node = document.createElement("div")
		vi.spyOn(node, "getBoundingClientRect").mockReturnValue(getMockDomRect({ height: 50, width: 100 }))

		const { result, cleanup } = renderHook(() => useElementOffset())
		result[1](node)
		flush()

		cleanup()
		expect(disconnectSpy).toHaveBeenCalled()
	})

	it("should disconnect the previous observer when node is set to null", () => {
		const node = document.createElement("div")
		vi.spyOn(node, "getBoundingClientRect").mockReturnValue(getMockDomRect({ height: 50, width: 100 }))

		const { result } = renderHook(() => useElementOffset())
		result[1](node)
		flush()
		expect(disconnectSpy).not.toHaveBeenCalled()

		result[1](null)
		flush()
		expect(disconnectSpy).toHaveBeenCalledTimes(1)
	})
})
