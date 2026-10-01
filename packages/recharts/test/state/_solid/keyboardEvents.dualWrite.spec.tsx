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
		<LineChart width={400} height={200} data={data} accessibilityLayer>
			<XAxis dataKey="name" />
			<YAxis />
			<Line dataKey="value" isAnimationActive={false} />
			<Tooltip />
			<Capture />
		</LineChart>
	))

	/* The accessibility layer attaches keyboard listeners to the outermost div. */
	const wrapper = container.firstElementChild as HTMLElement
	return { capturedState: () => capturedState!, wrapper }
}

describe("Phase 5b — keyboardEventsMiddleware dual-writes to new ChartState.tooltip", () => {
	it("focus activates keyboardInteraction in new state", () => {
		/* Phase 5b RED: handleFocus writes to legacy store only — new
		   ChartState.tooltip.keyboardInteraction.active stays false on focus.
		   After GREEN: batch dual-write sets active true in new state. */
		const { capturedState, wrapper } = setupChart()

		expect(capturedState().tooltip.keyboardInteraction.active).toBe(false)

		fireEvent.focusIn(wrapper)

		/* RED: new state keyboardInteraction.active is still false */
		expect(capturedState().tooltip.keyboardInteraction.active).toBe(true)
	})

	it("ArrowRight sets keyboardInteraction.index in new state", () => {
		/* Phase 5b RED: keyDown ArrowRight resolves nextIndex and writes to legacy
		   keyboardInteraction only — new ChartState.tooltip.keyboardInteraction.index
		   stays null. After GREEN: dual-write propagates the new index. */
		const { capturedState, wrapper } = setupChart()

		fireEvent.focusIn(wrapper)
		fireEvent.keyDown(wrapper, { key: "ArrowRight" })

		/* RED: new state index null — no dual-write */
		expect(capturedState().tooltip.keyboardInteraction.index).not.toBeNull()
	})

	it("ArrowLeft decrements keyboardInteraction.index in new state", () => {
		/* Phase 5b RED: ArrowLeft movement written to legacy only — new state index
		   never changes. After GREEN: dual-write tracks ArrowLeft navigation. */
		const { capturedState, wrapper } = setupChart()

		fireEvent.focusIn(wrapper)
		/* Move to index 1 first */
		fireEvent.keyDown(wrapper, { key: "ArrowRight" })
		fireEvent.keyDown(wrapper, { key: "ArrowRight" })
		const indexAfterTwoRight = capturedState().tooltip.keyboardInteraction.index

		fireEvent.keyDown(wrapper, { key: "ArrowLeft" })
		const indexAfterLeft = capturedState().tooltip.keyboardInteraction.index

		/* RED: both null — no dual-write; after GREEN indexAfterLeft < indexAfterTwoRight */
		expect(indexAfterTwoRight).not.toBeNull()
		expect(indexAfterLeft).not.toBeNull()
		expect(Number(indexAfterLeft)).toBeLessThan(Number(indexAfterTwoRight))
	})

	it("blur deactivates keyboardInteraction in new state", () => {
		/* Phase 5b RED: focus dual-write doesn't exist yet — new state is never
		   activated. This test verifies the full focus→blur lifecycle: after GREEN,
		   active goes true on focus then false on blur. Assert both transitions. */
		const { capturedState, wrapper } = setupChart()

		fireEvent.focusIn(wrapper)

		/* RED: dual-write not implemented — active is still false after focus */
		expect(capturedState().tooltip.keyboardInteraction.active).toBe(true)

		fireEvent.focusOut(wrapper)
		expect(capturedState().tooltip.keyboardInteraction.active).toBe(false)
	})
})
