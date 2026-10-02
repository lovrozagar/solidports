/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import type { ChartState } from "../store"
import {
	type BaseAxisWithScale,
	selectAxisWithScale,
	selectCartesianAxisSize,
	selectStackGroups,
	selectTicksOfGraphicalItem,
	selectUnfilteredCartesianItems,
} from "./axisSelectors"
import type { XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import { isNullish } from "../../util/DataUtils"
import { type BarPositionPosition, getBandSizeOfAxis, type StackId } from "../../util/ChartUtils"
import type {
	CartesianViewBoxRequired,
	ChartOffsetInternal,
	DataKey,
	TickItem,
} from "../../util/types"
import { type BarRectangleItem, computeBarRectangles } from "../../cartesian/Bar"
import { selectChartLayout } from "../../context/chartLayoutContext"
import type { ChartData } from "../chartDataSlice"
import { selectChartDataWithIndexesIfNotInPanoramaPosition3 } from "./dataSelectors"
import { selectAxisViewBox, selectChartOffsetInternal } from "./selectChartOffsetInternal"
import {
	selectBarCategoryGap,
	selectBarGap,
	selectRootBarSize,
	selectRootMaxBarSize,
} from "./rootPropsSelectors"
import type { AllStackGroups, StackSeries } from "../../util/stacks/stackTypes"
import type { BarSettings } from "../types/BarSettings"

/** Optional overrides — bypass the axis-settings lookup on hot animation frames. */
export type BarAxisOverrides = {
	xAxis?: XAxisSettings
	yAxis?: YAxisSettings
	barSettings?: BarSettings
}
import type { GraphicalItemId } from "../graphicalItemsSlice"
import { type BarCategory, combineBarSizeList } from "./combiners/combineBarSizeList"
import { combineAllBarPositions } from "./combiners/combineAllBarPositions"
import { combineStackedData } from "./combiners/combineStackedData"
import {
	selectXAxisIdFromGraphicalItemId,
	selectYAxisIdFromGraphicalItemId,
} from "./graphicalItemSelectors"
import { combineBarPosition } from "./combiners/combineBarPosition"

function selectSynchronisedBarSettings(
	state: ChartState,
	id: GraphicalItemId,
): BarSettings | undefined {
	const graphicalItems = selectUnfilteredCartesianItems(state)
	return graphicalItems.filter((item) => item.type === "bar").find((item) => item.id === id) as
		| BarSettings
		| undefined
}

export function selectMaxBarSize(
	_state: ChartState,
	id: GraphicalItemId,
): number | undefined {
	const barSettings = selectSynchronisedBarSettings(_state, id)
	return barSettings?.maxBarSize
}

export function selectAllVisibleBars(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): ReadonlyArray<BarSettings> {
	const layout = selectChartLayout(state)
	const allItems = selectUnfilteredCartesianItems(state)
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	return allItems
		.filter((i) => {
			if (layout === "horizontal") {
				return i.xAxisId === xAxisId
			}
			return i.yAxisId === yAxisId
		})
		.filter((i) => i.isPanorama === isPanorama)
		.filter((i) => i.hide === false)
		.filter((i) => i.type === "bar") as ReadonlyArray<BarSettings>
}

export type SizeList = ReadonlyArray<BarCategory>

const selectBarStackGroups = (
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): AllStackGroups | undefined => {
	const layout = selectChartLayout(state)
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	if (xAxisId == null || yAxisId == null) {
		return undefined
	}
	if (layout === "horizontal") {
		return selectStackGroups(state, "yAxis", yAxisId, isPanorama)
	}
	return selectStackGroups(state, "xAxis", xAxisId, isPanorama)
}

export const selectBarCartesianAxisSize = (state: ChartState, id: GraphicalItemId) => {
	const layout = selectChartLayout(state)
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	if (xAxisId == null || yAxisId == null) {
		return undefined
	}
	if (layout === "horizontal") {
		return selectCartesianAxisSize(state, "xAxis", xAxisId)
	}
	return selectCartesianAxisSize(state, "yAxis", yAxisId)
}

export function selectBarSizeList(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): SizeList {
	return combineBarSizeList(
		selectAllVisibleBars(state, id, isPanorama),
		selectRootBarSize(state),
		selectBarCartesianAxisSize(state, id),
	)
}

export function selectBarBandSize(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): number {
	const barSettings = selectSynchronisedBarSettings(state, id)
	if (barSettings == null) {
		return 0
	}
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	if (xAxisId == null || yAxisId == null) {
		return 0
	}
	const layout = selectChartLayout(state)
	const globalMaxBarSize: number | undefined = selectRootMaxBarSize(state)
	const { maxBarSize: childMaxBarSize } = barSettings
	const maxBarSize: number | undefined = isNullish(childMaxBarSize)
		? globalMaxBarSize
		: childMaxBarSize
	let axis: BaseAxisWithScale | undefined
	let ticks: ReadonlyArray<TickItem> | undefined
	if (layout === "horizontal") {
		axis = selectAxisWithScale(state, "xAxis", xAxisId, isPanorama)
		ticks = selectTicksOfGraphicalItem(state, "xAxis", xAxisId, isPanorama)
	} else {
		axis = selectAxisWithScale(state, "yAxis", yAxisId, isPanorama)
		ticks = selectTicksOfGraphicalItem(state, "yAxis", yAxisId, isPanorama)
	}
	return getBandSizeOfAxis(axis, ticks, true) ?? maxBarSize ?? 0
}

export function selectAxisBandSize(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): number | undefined {
	const layout = selectChartLayout(state)
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	if (xAxisId == null || yAxisId == null) {
		return undefined
	}
	let axis: BaseAxisWithScale | undefined
	let ticks: ReadonlyArray<TickItem> | undefined
	if (layout === "horizontal") {
		axis = selectAxisWithScale(state, "xAxis", xAxisId, isPanorama)
		ticks = selectTicksOfGraphicalItem(state, "xAxis", xAxisId, isPanorama)
	} else {
		axis = selectAxisWithScale(state, "yAxis", yAxisId, isPanorama)
		ticks = selectTicksOfGraphicalItem(state, "yAxis", yAxisId, isPanorama)
	}
	return getBandSizeOfAxis(axis, ticks)
}

export type BarWithPosition = {
	stackId: StackId | undefined
	/**
	 * List of dataKeys of items stacked at this position.
	 * All of these Bars are either sharing the same stackId,
	 * or this is an array with one Bar because it has no stackId defined.
	 *
	 * This structure limits us to having one dataKey only once per stack which I think is reasonable.
	 * People who want to have the same data twice can duplicate their data to have two distinct dataKeys.
	 */
	dataKeys: ReadonlyArray<DataKey<unknown>>
	/**
	 * Position of this stack in absolute pixels measured from the start of the chart
	 */
	position: BarPositionPosition
}

export function selectAllBarPositions(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): ReadonlyArray<BarWithPosition> | undefined {
	return combineAllBarPositions(
		selectBarSizeList(state, id, isPanorama),
		selectRootMaxBarSize(state),
		selectBarGap(state),
		selectBarCategoryGap(state),
		selectBarBandSize(state, id, isPanorama),
		selectAxisBandSize(state, id, isPanorama),
		selectMaxBarSize(state, id),
	)
}

const selectXAxisWithScale = (
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
	override?: XAxisSettings,
) => {
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	if (xAxisId == null) {
		return undefined
	}
	return selectAxisWithScale(state, "xAxis", xAxisId, isPanorama, override)
}

const selectYAxisWithScale = (
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
	override?: YAxisSettings,
) => {
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	if (yAxisId == null) {
		return undefined
	}
	return selectAxisWithScale(state, "yAxis", yAxisId, isPanorama, override)
}

const selectXAxisTicks = (state: ChartState, id: GraphicalItemId, isPanorama: boolean) => {
	const xAxisId = selectXAxisIdFromGraphicalItemId(state, id)
	if (xAxisId == null) {
		return undefined
	}
	return selectTicksOfGraphicalItem(state, "xAxis", xAxisId, isPanorama)
}

const selectYAxisTicks = (state: ChartState, id: GraphicalItemId, isPanorama: boolean) => {
	const yAxisId = selectYAxisIdFromGraphicalItemId(state, id)
	if (yAxisId == null) {
		return undefined
	}
	return selectTicksOfGraphicalItem(state, "yAxis", yAxisId, isPanorama)
}

export function selectBarPosition(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): BarPositionPosition | undefined {
	return combineBarPosition(
		selectAllBarPositions(state, id, isPanorama),
		selectSynchronisedBarSettings(state, id),
	)
}

export function selectStackedDataOfItem(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
): StackSeries | undefined {
	return combineStackedData(
		selectBarStackGroups(state, id, isPanorama),
		selectSynchronisedBarSettings(state, id),
	)
}

export function selectBarRectangles(
	state: ChartState,
	id: GraphicalItemId,
	isPanorama: boolean,
	cells: ReadonlyArray<JSX.Element> | undefined,
	xAxisOverride?: XAxisSettings,
	yAxisOverride?: YAxisSettings,
	barSettingsOverride?: BarSettings,
): ReadonlyArray<BarRectangleItem> | undefined {
	const offset: ChartOffsetInternal = selectChartOffsetInternal(state)
	const axisViewBox: CartesianViewBoxRequired = selectAxisViewBox(state)
	const xAxis = selectXAxisWithScale(state, id, isPanorama, xAxisOverride)
	const yAxis = selectYAxisWithScale(state, id, isPanorama, yAxisOverride)
	const xAxisTicks = selectXAxisTicks(state, id, isPanorama)
	const yAxisTicks = selectYAxisTicks(state, id, isPanorama)
	const pos = selectBarPosition(state, id, isPanorama)
	const layout = selectChartLayout(state)
	const { chartData, dataStartIndex, dataEndIndex } =
		selectChartDataWithIndexesIfNotInPanoramaPosition3(state, undefined, isPanorama)
	const bandSize = selectAxisBandSize(state, id, isPanorama)
	const stackedData = selectStackedDataOfItem(state, id, isPanorama)
	const barSettings = barSettingsOverride ?? selectSynchronisedBarSettings(state, id)

	if (
		barSettings == null ||
		pos == null ||
		axisViewBox == null ||
		(layout !== "horizontal" && layout !== "vertical") ||
		xAxis == null ||
		yAxis == null ||
		xAxisTicks == null ||
		yAxisTicks == null ||
		bandSize == null
	) {
		return undefined
	}
	const { data } = barSettings

	let displayedData: ChartData | undefined
	if (data != null && data.length > 0) {
		displayedData = data
	} else {
		displayedData = chartData?.slice(dataStartIndex, dataEndIndex + 1)
	}

	if (displayedData == null) {
		return undefined
	}

	return computeBarRectangles({
		bandSize,
		barSettings,
		cells,
		dataStartIndex,
		displayedData,
		layout,
		offset,
		parentViewBox: axisViewBox,
		pos,
		stackedData,
		xAxis,
		xAxisTicks,
		yAxis,
		yAxisTicks,
	})
}
