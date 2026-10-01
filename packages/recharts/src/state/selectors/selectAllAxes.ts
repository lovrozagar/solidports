/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import { readChartState } from "../chartState"

export function selectAllXAxes(state: ChartState): ReadonlyArray<XAxisSettings> {
	return Object.values(readChartState(state).cartesianAxes.xAxis)
		.map((e) => e?.settings)
		.filter((s): s is XAxisSettings => s != null && "orientation" in s)
}

export function selectAllYAxes(state: ChartState): ReadonlyArray<YAxisSettings> {
	return Object.values(readChartState(state).cartesianAxes.yAxis)
		.map((e) => e?.settings)
		.filter((s): s is YAxisSettings => s != null && "orientation" in s)
}
