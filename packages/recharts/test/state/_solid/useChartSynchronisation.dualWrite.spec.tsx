/* @jsxImportSource @solidjs/web */
import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { render } from "../../helper/render"
import { LineChart, Line, XAxis, YAxis, Tooltip } from "../../../src"
import { useChartState } from "../../../src/state/useChartState"
import { eventCenter, TOOLTIP_SYNC_EVENT } from "../../../src/util/Events"
import type { ChartState } from "../../../src/state/chartState"
import type { TooltipSyncState } from "../../../src/state/tooltipSlice"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

const SYNC_ID = "test-sync-5b"

function setupSyncChart() {
	let capturedState: ChartState | undefined

	const Capture = (): null => {
		capturedState = useChartState().state
		return null
	}

	render(() => (
		<LineChart width={400} height={200} data={data} syncId={SYNC_ID}>
			<XAxis dataKey="name" />
			<YAxis />
			<Line dataKey="value" isAnimationActive={false} />
			<Tooltip />
			<Capture />
		</LineChart>
	))

	return { capturedState: () => capturedState! }
}

/* Emits a fake TOOLTIP_SYNC_EVENT from a different emitter symbol so the
   chart's listener processes it (same syncId, different emitter). */
function emitSync(payload: Partial<TooltipSyncState> = {}) {
	const foreignEmitter = Symbol("foreign-chart")
	const syncState: TooltipSyncState = {
		active: true,
		coordinate: { x: 100, y: 50 },
		dataKey: undefined,
		graphicalItemId: undefined,
		index: "1",
		label: "B",
		sourceViewBox: undefined,
		...payload,
	}
	eventCenter.emit(TOOLTIP_SYNC_EVENT, SYNC_ID, syncState, foreignEmitter)
	flush()
}

describe("useChartSynchronisation writes ChartState.tooltip.syncInteraction", () => {
	it("incoming sync event activates syncInteraction", () => {
		const { capturedState } = setupSyncChart()

		expect(capturedState().tooltip.syncInteraction.active).toBe(false)

		emitSync({ active: true })

		expect(capturedState().tooltip.syncInteraction.active).toBe(true)
	})

	it("incoming sync event sets syncInteraction.index", () => {
		const { capturedState } = setupSyncChart()

		emitSync({ active: true, index: "2" })

		expect(capturedState().tooltip.syncInteraction.index).not.toBeNull()
	})

	it("deactivating sync event clears syncInteraction.active", () => {
		const { capturedState } = setupSyncChart()

		emitSync({ active: true })

		expect(capturedState().tooltip.syncInteraction.active).toBe(true)

		emitSync({ active: false, index: null as unknown as string })
		expect(capturedState().tooltip.syncInteraction.active).toBe(false)
	})
})
