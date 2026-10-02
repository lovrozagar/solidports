/* @jsxImportSource @solidjs/web */
import { describe, it, expect, vi } from "vitest"
import { createSignal, flush, For } from "solid-js"
import { fireEvent, render } from "../helper/render"
import { BarChart } from "../../src"
import { RechartsWrapper } from "../../src/chart/RechartsWrapper"
import { assertNotNull } from "../helper/assertNotNull"

describe("RechartsWrapper", () => {
	it("should call onMouseEnter, and onMouseLeave handlers", async () => {
		const onMouseEnterSpy = vi.fn()
		const onMouseLeaveSpy = vi.fn()
		const { container } = render(() => (
			<BarChart
				width={800}
				height={400}
				onMouseEnter={onMouseEnterSpy}
				onMouseLeave={onMouseLeaveSpy}
			/>
		))

		const wrapper = container.querySelector(".recharts-wrapper")
		assertNotNull(wrapper)
		expect(wrapper).toBeInTheDocument()

		expect(onMouseEnterSpy).not.toHaveBeenCalled()
		expect(onMouseLeaveSpy).not.toHaveBeenCalled()

		fireEvent.mouseEnter(wrapper)

		vi.advanceTimersByTime(0)
		flush()

		expect(onMouseEnterSpy).toHaveBeenCalledTimes(1)
		expect(onMouseLeaveSpy).not.toHaveBeenCalled()

		fireEvent.mouseLeave(wrapper)

		vi.advanceTimersByTime(0)
		flush()

		expect(onMouseEnterSpy).toHaveBeenCalledTimes(1)
		expect(onMouseLeaveSpy).toHaveBeenCalledTimes(1)
	})

	it("should disconnect the previous ResizeObserver before creating a new one when the DOM node changes", () => {
		const observeSpy = vi.fn()
		const disconnectSpy = vi.fn()

		// Mock global ResizeObserver
		const ResizeObserverMock = vi.fn(function ResizeObserverMock() {
			return {
				disconnect: disconnectSpy,
				observe: observeSpy,
				unobserve: vi.fn(),
			}
		})
		vi.stubGlobal("ResizeObserver", ResizeObserverMock)

		/* Solid only replaces the wrapper's DOM node by remounting it; a keyed list stands in
		   for upstream's re-render with a new callback ref. */
		const [instance, setInstance] = createSignal(1)
		render(() => (
			<For each={[instance()]}>
				{() => (
					<RechartsWrapper responsive width={100} height={100} ref={() => {}}>
						<div />
					</RechartsWrapper>
				)}
			</For>
		))

		expect(ResizeObserverMock).toHaveBeenCalledTimes(1)
		expect(observeSpy).toHaveBeenCalledTimes(1)
		expect(disconnectSpy).not.toHaveBeenCalled()

		setInstance(2)
		flush()

		// The first observer was disconnected before the second one was created
		expect(disconnectSpy).toHaveBeenCalledTimes(1)

		// A second observer was created
		expect(ResizeObserverMock).toHaveBeenCalledTimes(2)
		expect(observeSpy).toHaveBeenCalledTimes(2)

		vi.unstubAllGlobals()
	})
})
