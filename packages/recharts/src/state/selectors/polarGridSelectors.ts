/* eslint-disable import/no-cycle */
import { RechartsRootState } from "../store"
import { AxisId } from "../cartesianAxisSlice"
import { selectPolarAxisTicks } from "./polarScaleSelectors"

export type PolarAngles = Array<number>

export type PolarRadius = Array<number>

/* reselect's createSelector short-circuits on input-reference equality, which
   breaks Solid's fine-grained tracking — proxy reads inside the input selector
   are skipped on cache hit, and downstream memos never refresh (GOTCHA-003).
   Plain functions let Solid track the proxy reads naturally. */
export function selectPolarGridAngles(
	state: RechartsRootState,
	angleAxisId: AxisId,
): PolarAngles | undefined {
	const ticks = selectPolarAxisTicks(state, "angleAxis", angleAxisId, false)
	if (!ticks) {
		return undefined
	}
	return ticks.map((tick) => tick.coordinate)
}

export function selectPolarGridRadii(
	state: RechartsRootState,
	radiusAxisId: AxisId,
): PolarRadius | undefined {
	const ticks = selectPolarAxisTicks(state, "radiusAxis", radiusAxisId, false)
	if (!ticks) {
		return undefined
	}
	return ticks.map((tick) => tick.coordinate)
}
