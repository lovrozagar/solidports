/* eslint-disable import/no-cycle */
import { ChartState } from "../store"
import { AxisId } from "../cartesianAxisSlice"
import { chartSelector } from "./chartSelector"
import { selectPolarAxisTicks } from "./polarScaleSelectors"

export type PolarAngles = Array<number>

export type PolarRadius = Array<number>

/* reselect's createSelector short-circuits on input-reference equality, which
   breaks Solid's fine-grained tracking (GOTCHA-003). chartSelector memoizes per
   chart instead, and each memo tracks its own proxy reads. */
export const selectPolarGridAngles = chartSelector(function selectPolarGridAngles(state: ChartState, angleAxisId: AxisId): PolarAngles | undefined {
	const ticks = selectPolarAxisTicks(state, "angleAxis", angleAxisId, false)
	if (!ticks) {
		return undefined
	}
	return ticks.map((tick) => tick.coordinate)
})

export const selectPolarGridRadii = chartSelector(function selectPolarGridRadii(state: ChartState, radiusAxisId: AxisId): PolarRadius | undefined {
	const ticks = selectPolarAxisTicks(state, "radiusAxis", radiusAxisId, false)
	if (!ticks) {
		return undefined
	}
	return ticks.map((tick) => tick.coordinate)
})
