import type { ErrorBarDirection } from "../cartesian/ErrorBar"
import type { DataKey } from "../util/types"
import type { GraphicalItemId } from "./graphicalItemsSlice"

/**
 * ErrorBars have lot more settings but all the others are scoped to the component itself.
 * Only some of them required to be reported to the global store because XAxis and YAxis need to know
 * if the error bar is contributing to extending the axis domain.
 */
export type ErrorBarsSettings = {
	/**
	 * The direction is only used in Scatter chart, and decided based on ChartLayout in other charts.
	 */
	direction: ErrorBarDirection
	/**
	 * The dataKey decides which property from the data will each individual ErrorBar use.
	 * If it so happens that the ErrorBar data are bigger than the axis domain,
	 * the error bar data will stretch the axis domain.
	 */
	dataKey: DataKey<unknown>
	/*
	 * ErrorBar props say that it has explicit xAxis and yAxis props,
	 * but actually it always inherits the xAxis and yAxis defined on the parent graphical item.
	 */
}

export type ErrorBarsState = Record<GraphicalItemId, ReadonlyArray<ErrorBarsSettings>>

export const initialErrorBarState: ErrorBarsState = {}
