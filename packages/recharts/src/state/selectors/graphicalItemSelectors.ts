/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import type { GraphicalItemId } from "../graphicalItemsSlice"
import { AxisId, defaultAxisId } from "../cartesianAxisSlice"
import type { CartesianItemState } from "../_solid/chartState"

function isCartesianItem(item: { type: string }): item is CartesianItemState {
	return (
		item.type === "line" ||
		item.type === "area" ||
		item.type === "bar" ||
		item.type === "scatter"
	)
}

export function selectXAxisIdFromGraphicalItemId(
	state: RechartsRootState,
	id: GraphicalItemId,
): AxisId {
	const graphicalItems = (state._solid as Partial<typeof state._solid>).graphicalItems
	const entry = graphicalItems?.[id]
	if (entry == null || !isCartesianItem(entry)) return defaultAxisId
	return entry.settings.xAxisId ?? defaultAxisId
}

export function selectYAxisIdFromGraphicalItemId(
	state: RechartsRootState,
	id: GraphicalItemId,
): AxisId {
	const graphicalItems = (state._solid as Partial<typeof state._solid>).graphicalItems
	const entry = graphicalItems?.[id]
	if (entry == null || !isCartesianItem(entry)) return defaultAxisId
	return entry.settings.yAxisId ?? defaultAxisId
}
