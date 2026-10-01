import type { TickItem } from "../util/types"
import type { AxisId } from "./cartesianAxisSlice"

export type RenderedTicksAxisState = {
	[axisId: AxisId]: ReadonlyArray<TickItem>
}

export type RenderedTicksState = {
	xAxis: RenderedTicksAxisState
	yAxis: RenderedTicksAxisState
}

export function createInitialRenderedTicksState(): RenderedTicksState {
	return { xAxis: {}, yAxis: {} }
}
