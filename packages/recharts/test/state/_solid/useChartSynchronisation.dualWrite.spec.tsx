/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { LineChart, Line, XAxis, YAxis, Tooltip } from "../../../src"
import { useChartState } from "../../../src/state/_solid/useChartState"
import { useChartStore } from "../../../src/state/RechartsStoreContext"
import { eventCenter, TOOLTIP_SYNC_EVENT } from "../../../src/util/Events"
import type { ChartState } from "../../../src/state/_solid/chartState"
import type { TooltipSyncState } from "../../../src/state/tooltipSlice"
import type { RechartsRootState } from "../../../src/state/store"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

const SYNC_ID = "test-sync-5b"

function setupSyncChart() {
	let capturedState: ChartState | undefined
	let capturedStore: RechartsRootState | undefined

	const Capture = (): null => {
		capturedState = useChartState().state
		const ctx = useChartStore()
		if (ctx != null) capturedStore = ctx.store
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

	return { capturedState: () => capturedState!, capturedStore: () => capturedStore! }
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
}

describe("Phase 5b — useChartSynchronisation dual-writes to new ChartState.tooltip", () => {
	it("incoming sync event activates syncInteraction in new state", () => {
		/* Phase 5b RED: useTooltipSyncEventsListener writes to legacy setStore only —
		   new ChartState.tooltip.syncInteraction.active stays false after sync event.
		   After GREEN: batch dual-write via setChartState from RechartsStateContext. */
		const { capturedState } = setupSyncChart()

		expect(capturedState().tooltip.syncInteraction.active).toBe(false)

		emitSync({ active: true })

		/* RED: new state syncInteraction.active stays false — dual-write not implemented */
		expect(capturedState().tooltip.syncInteraction.active).toBe(true)
	})

	it("incoming sync event sets syncInteraction.index in new state", () => {
		/* Phase 5b RED: resolved index written to legacy syncInteraction.index only —
		   new ChartState.tooltip.syncInteraction.index stays null.
		   After GREEN: dual-write propagates the incoming index. */
		const { capturedState } = setupSyncChart()

		emitSync({ active: true, index: "2" })

		/* RED: new state index stays null */
		expect(capturedState().tooltip.syncInteraction.index).not.toBeNull()
	})

	it("deactivating sync event clears syncInteraction.active in new state", () => {
		/* Phase 5b RED: dual-write doesn't exist yet so new state is never activated
		   to begin with. This test verifies the full activate→deactivate lifecycle:
		   after GREEN, active goes true on first emit then false on second. */
		const { capturedState } = setupSyncChart()

		emitSync({ active: true })

		/* RED: new state never activated — active is false; first assertion fails */
		expect(capturedState().tooltip.syncInteraction.active).toBe(true)

		emitSync({ active: false, index: null as unknown as string })
		expect(capturedState().tooltip.syncInteraction.active).toBe(false)
	})
})
