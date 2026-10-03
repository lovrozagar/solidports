/* eslint-disable import/no-cycle */
import type { CartesianViewBoxRequired, ChartOffsetInternal } from "../../util/types"
import type { XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import {
	selectChartOffsetInternal,
	selectChartViewBox,
	selectAxisViewBox,
} from "../selectors/selectChartOffsetInternal"
import { selectAllXAxes, selectAllYAxes } from "../selectors/selectAllAxes"
import { useChartStore } from "../RechartsStoreContext"

/*
 * Chart-level selector hooks. The selectors are chartSelector memos, so every consumer of a chart
 * shares one computation per selector; outside a chart the hooks return undefined.
 */

/** Returns the current chart offset. */
export const useChartOffsetInternal = (): ChartOffsetInternal | undefined => {
	const ctx = useChartStore()
	return ctx ? selectChartOffsetInternal(ctx.store) : undefined
}

/** Returns all registered X axes. */
export const useAllXAxes = (): ReadonlyArray<XAxisSettings> | undefined => {
	const ctx = useChartStore()
	return ctx ? selectAllXAxes(ctx.store) : undefined
}

/** Returns all registered Y axes. */
export const useAllYAxes = (): ReadonlyArray<YAxisSettings> | undefined => {
	const ctx = useChartStore()
	return ctx ? selectAllYAxes(ctx.store) : undefined
}

/** Returns the axis viewBox. */
export const useAxisViewBox = (): CartesianViewBoxRequired | undefined => {
	const ctx = useChartStore()
	return ctx ? selectAxisViewBox(ctx.store) : undefined
}

/** Returns the chart viewBox. */
export const useChartViewBox = (): CartesianViewBoxRequired | undefined => {
	const ctx = useChartStore()
	return ctx ? selectChartViewBox(ctx.store) : undefined
}
