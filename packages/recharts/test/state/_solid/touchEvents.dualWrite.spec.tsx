/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { fireEvent, render } from "@solidjs/testing-library"
import { LineChart, Line, XAxis, YAxis, Tooltip } from "../../../src"
import { useChartState } from "../../../src/state/useChartState"
import type { ChartState } from "../../../src/state/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

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
	return { capturedState: () => capturedState!, svg }
}

describe("Phase 5b — touchEventsMiddleware dual-writes to new ChartState.tooltip", () => {
	it("touchMove activates axisInteraction.hover.active in new state", () => {
		/* Phase 5b RED: touchEventsMiddleware only writes to legacy store — new
		   ChartState.tooltip.axisInteraction.hover.active stays false after touchMove.
		   After GREEN: batch dual-write populates new state via setChartState. */
		const { capturedState, svg } = setupChart()

		expect(capturedState().tooltip.axisInteraction.hover.active).toBe(false)

		fireEvent.touchMove(svg, {
			touches: [{ clientX: 100, clientY: 50 }],
		})

		/* RED: new state never receives dual-write */
		expect(capturedState().tooltip.axisInteraction.hover.active).toBe(true)
	})

	it("touchMove populates axisInteraction.hover.index in new state", () => {
		/* Phase 5b RED: resolved index written to legacy only — new
		   ChartState.tooltip.axisInteraction.hover.index stays null.
		   After GREEN: dual-write propagates the index. */
		const { capturedState, svg } = setupChart()

		fireEvent.touchMove(svg, {
			touches: [{ clientX: 100, clientY: 50 }],
		})

		/* RED: index still null in new state */
		expect(capturedState().tooltip.axisInteraction.hover.index).not.toBeNull()
	})

	it("touchMove populates axisInteraction.hover.coordinate in new state", () => {
		/* Phase 5b RED: coordinate computed and stored in legacy only — new
		   ChartState.tooltip.axisInteraction.hover.coordinate stays undefined.
		   After GREEN: coordinate is dual-written. */
		const { capturedState, svg } = setupChart()

		fireEvent.touchMove(svg, {
			touches: [{ clientX: 80, clientY: 40 }],
		})

		/* RED: coordinate remains undefined in new state */
		expect(capturedState().tooltip.axisInteraction.hover.coordinate).toBeDefined()
	})

	it("second touchMove updates axisInteraction.hover.index in new state", () => {
		/* Phase 5b RED: successive touchMove events only update legacy — new state
		   never sees any of the updates. After GREEN: each dual-write overwrites
		   the previous value so new state tracks latest index. */
		const { capturedState, svg } = setupChart()

		fireEvent.touchMove(svg, { touches: [{ clientX: 100, clientY: 50 }] })
		const firstIndex = capturedState().tooltip.axisInteraction.hover.index

		fireEvent.touchMove(svg, { touches: [{ clientX: 300, clientY: 50 }] })
		const secondIndex = capturedState().tooltip.axisInteraction.hover.index

		/* RED: both are null — no dual-write; after GREEN they differ (different data point) */
		expect(firstIndex).not.toBeNull()
		expect(secondIndex).not.toBeNull()
	})
})
