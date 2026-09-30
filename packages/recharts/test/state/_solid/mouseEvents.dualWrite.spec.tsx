/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { fireEvent, render } from "@solidjs/testing-library"
import { LineChart, Line, XAxis, YAxis, Tooltip } from "../../../src"
import { useChartState } from "../../../src/state/_solid/useChartState"
import type { ChartState } from "../../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

/* Captures new chartState so tests can assert against it post-event. */
function setupChart() {
	let capturedState: ChartState | undefined

	const Capture = (): null => {
		capturedState = useChartState().state
		return null
	}

	const { container } = render(() => (
		<LineChart width={400} height={200} data={data}>
			<XAxis dataKey="name" />
			<YAxis />
			<Line dataKey="value" isAnimationActive={false} />
			<Tooltip />
			<Capture />
		</LineChart>
	))

	const svg = container.querySelector("svg")!
	/* onMouseLeave is on the outer wrapper div, not the svg — mouseleave doesn't bubble. */
	const wrapper = container.firstElementChild as HTMLElement
	return { capturedState: () => capturedState!, svg, wrapper }
}

describe("Phase 5b — mouseEventsMiddleware dual-writes to new ChartState.tooltip", () => {
	it("mouseMove activates axisInteraction.hover.active in new state", () => {
		/* Phase 5b RED: mouseEventsMiddleware only calls setStore (legacy) — new
		   ChartState.tooltip.axisInteraction.hover.active stays false after mouseMove.
		   After GREEN: batch dual-write sets it true via setChartState. */
		const { capturedState, svg } = setupChart()

		expect(capturedState().tooltip.axisInteraction.hover.active).toBe(false)

		fireEvent.mouseMove(svg, { clientX: 100, clientY: 50 })

		/* RED: dual-write doesn't exist yet — new state stays false */
		expect(capturedState().tooltip.axisInteraction.hover.active).toBe(true)
	})

	it("mouseMove populates axisInteraction.hover.coordinate in new state", () => {
		/* Phase 5b RED: coordinate write targets only legacy store — new
		   ChartState.tooltip.axisInteraction.hover.coordinate stays undefined.
		   After GREEN: batch dual-write fills coordinate in new state. */
		const { capturedState, svg } = setupChart()

		fireEvent.mouseMove(svg, { clientX: 100, clientY: 30 })

		/* RED: new state coordinate is undefined — dual-write not implemented */
		expect(capturedState().tooltip.axisInteraction.hover.coordinate).toBeDefined()
	})

	it("mouseMove populates axisInteraction.hover.index in new state", () => {
		/* Phase 5b RED: index is resolved by selectActivePropsFromChartPointer and
		   stored in legacy only — new ChartState.tooltip.axisInteraction.hover.index
		   stays null. After GREEN: dual-write sets the resolved index. */
		const { capturedState, svg } = setupChart()

		fireEvent.mouseMove(svg, { clientX: 100, clientY: 50 })

		/* RED: new state index still null */
		expect(capturedState().tooltip.axisInteraction.hover.index).not.toBeNull()
	})

	it("mouseMove followed by mouseLeave deactivates axisInteraction.hover in new state", () => {
		/* Phase 5b RED: mouseMove dual-write doesn't exist yet so hover never becomes
		   true in new state. This test verifies the full move→leave lifecycle: after
		   GREEN, hover goes true on move then false on leave. Assert both transitions. */
		const { capturedState, svg, wrapper } = setupChart()

		fireEvent.mouseMove(svg, { clientX: 100, clientY: 50 })

		/* RED: dual-write not implemented — active is still false; both assertions fail */
		expect(capturedState().tooltip.axisInteraction.hover.active).toBe(true)

		fireEvent.mouseLeave(wrapper)
		expect(capturedState().tooltip.axisInteraction.hover.active).toBe(false)
	})

	it("mouseClick activates axisInteraction.click in new state", () => {
		/* Phase 5b RED: click write goes to legacy axisInteraction.click only — new
		   ChartState.tooltip.axisInteraction.click.active stays false.
		   After GREEN: mouseClickAction dual-writes click state. */
		const { capturedState, svg } = setupChart()

		/* Hover first so activeIndex resolves, then click */
		fireEvent.mouseMove(svg, { clientX: 100, clientY: 50 })
		fireEvent.click(svg, { clientX: 100, clientY: 50 })

		/* RED: new state click not set */
		expect(capturedState().tooltip.axisInteraction.click.active).toBe(true)
	})
})
