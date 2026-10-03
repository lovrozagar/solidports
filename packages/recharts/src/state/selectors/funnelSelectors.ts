/* eslint-disable import/no-cycle */
import { computeFunnelTrapezoids, type FunnelTrapezoidItem } from "../../cartesian/Funnel"
import type { ChartData } from "../chartDataSlice"
import type { ChartState } from "../store"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { selectChartDataAndAlwaysIgnoreIndexes } from "./dataSelectors"
import type { ChartOffsetInternal, DataKey, TooltipType } from "../../util/types"
import { chartSelector } from "./chartSelector"
import type { GraphicalItemId } from "../graphicalItemsSlice"

export type ResolvedFunnelSettings = {
	dataKey: DataKey<unknown>
	data: ChartData | undefined
	nameKey: DataKey<unknown>
	tooltipType?: TooltipType
	lastShapeType?: "triangle" | "rectangle"
	reversed?: boolean
	customWidth?: string | number
	cells: ReadonlyArray<Record<string, unknown>>
	presentationProps: Record<string, unknown> | null
	id: GraphicalItemId
}

export const selectFunnelTrapezoids = chartSelector(function selectFunnelTrapezoids(state: ChartState, funnelSettings: ResolvedFunnelSettings): ReadonlyArray<FunnelTrapezoidItem> {
	const offset: ChartOffsetInternal = selectChartOffsetInternal(state)
	const { chartData } = selectChartDataAndAlwaysIgnoreIndexes(state)
	const {
		data,
		dataKey,
		nameKey,
		tooltipType,
		lastShapeType,
		reversed,
		customWidth,
		cells,
		presentationProps,
		id: graphicalItemId,
	} = funnelSettings

	let displayedData: ChartData | undefined
	if (data != null && data.length > 0) {
		displayedData = data
	} else if (chartData != null && chartData.length > 0) {
		displayedData = chartData
	}

	if (displayedData && displayedData.length) {
		displayedData = displayedData.map((entry: unknown, index: number) =>
			Object.assign(
				{ payload: entry },
				presentationProps,
				entry as Record<string, unknown>,
				cells && cells[index] ? cells[index] : undefined,
			),
		)
	} else if (cells && cells.length) {
		displayedData = cells.map((cell: Record<string, unknown>) =>
			Object.assign({}, presentationProps, cell),
		)
	} else {
		return []
	}

	return computeFunnelTrapezoids({
		customWidth,
		dataKey,
		displayedData,
		graphicalItemId,
		lastShapeType,
		nameKey,
		offset,
		reversed,
		tooltipType,
	})
})
