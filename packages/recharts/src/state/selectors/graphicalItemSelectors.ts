/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { GraphicalItemId } from "../graphicalItemsSlice"
import { AxisId, defaultAxisId } from "../cartesianAxisSlice"
import type { CartesianItemState } from "../chartState"
import { chartSelector } from "./chartSelector"
import { readChartState } from "../chartState"

function isCartesianItem(item: { type: string }): item is CartesianItemState {
	return (
		item.type === "line" ||
		item.type === "area" ||
		item.type === "bar" ||
		item.type === "scatter"
	)
}

export const selectXAxisIdFromGraphicalItemId = chartSelector(function selectXAxisIdFromGraphicalItemId(state: ChartState, id: GraphicalItemId): AxisId {
	const graphicalItems = readChartState(state).graphicalItems
	const entry = graphicalItems?.[id]
	if (entry == null || !isCartesianItem(entry)) return defaultAxisId
	return entry.settings.xAxisId ?? defaultAxisId
})

export const selectYAxisIdFromGraphicalItemId = chartSelector(function selectYAxisIdFromGraphicalItemId(state: ChartState, id: GraphicalItemId): AxisId {
	const graphicalItems = readChartState(state).graphicalItems
	const entry = graphicalItems?.[id]
	if (entry == null || !isCartesianItem(entry)) return defaultAxisId
	return entry.settings.yAxisId ?? defaultAxisId
})
