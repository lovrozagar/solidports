/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import type { XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"

export function selectAllXAxes(state: RechartsRootState): ReadonlyArray<XAxisSettings> {
	const solidAxes = (state._solid as Partial<typeof state._solid>).cartesianAxes
	if (solidAxes != null) {
		/* Filter partial entries (test probes may write only { settings: { dataKey } }) */
		return Object.values(solidAxes.xAxis)
			.map((e) => e?.settings)
			.filter((s): s is XAxisSettings => s != null && "orientation" in s)
	}
	/* Legacy compat shim */
	return Object.values(state.cartesianAxis.xAxis)
}

export function selectAllYAxes(state: RechartsRootState): ReadonlyArray<YAxisSettings> {
	const solidAxes = (state._solid as Partial<typeof state._solid>).cartesianAxes
	if (solidAxes != null) {
		/* Filter partial entries (test probes may write only { settings: { dataKey } }) */
		return Object.values(solidAxes.yAxis)
			.map((e) => e?.settings)
			.filter((s): s is YAxisSettings => s != null && "orientation" in s)
	}
	/* Legacy compat shim */
	return Object.values(state.cartesianAxis.yAxis)
}
