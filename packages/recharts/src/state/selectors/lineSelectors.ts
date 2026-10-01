/* eslint-disable import/no-cycle */
import { computeLinePoints, type LinePointItem } from "../../cartesian/Line"
import type { ChartState } from "../store"
import type { AxisId, XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import { selectChartDataWithIndexesIfNotInPanoramaPosition4 } from "./dataSelectors"
import { selectChartLayout } from "../../context/chartLayoutContext"
import {
	selectAxisWithScale,
	selectTicksOfGraphicalItem,
	selectUnfilteredCartesianItems,
} from "./axisSelectors"
import { getBandSizeOfAxis, isCategoricalAxis } from "../../util/ChartUtils"
import type { ChartData } from "../chartDataSlice"
import type { CartesianGraphicalItemSettings, GraphicalItemId } from "../graphicalItemsSlice"
import type { LineSettings } from "../types/LineSettings"

/** Optional overrides — when supplied, bypass the axis-settings lookup on hot animation frames. */
export type LineAxisOverrides = {
	xAxis?: XAxisSettings
	yAxis?: YAxisSettings
	lineSettings?: LineSettings
}

const selectXAxisWithScale = (
	state: ChartState,
	xAxisId: AxisId,
	_yAxisId: AxisId,
	isPanorama: boolean,
	override?: XAxisSettings,
) => selectAxisWithScale(state, "xAxis", xAxisId, isPanorama, override)

const selectXAxisTicks = (
	state: ChartState,
	xAxisId: AxisId,
	_yAxisId: AxisId,
	isPanorama: boolean,
) => selectTicksOfGraphicalItem(state, "xAxis", xAxisId, isPanorama)

const selectYAxisWithScale = (
	state: ChartState,
	_xAxisId: AxisId,
	yAxisId: AxisId,
	isPanorama: boolean,
	override?: YAxisSettings,
) => selectAxisWithScale(state, "yAxis", yAxisId, isPanorama, override)

const selectYAxisTicks = (
	state: ChartState,
	_xAxisId: AxisId,
	yAxisId: AxisId,
	isPanorama: boolean,
) => selectTicksOfGraphicalItem(state, "yAxis", yAxisId, isPanorama)

function selectBandSize(
	state: ChartState,
	xAxisId: AxisId,
	yAxisId: AxisId,
	isPanorama: boolean,
	overrides?: LineAxisOverrides,
) {
	const layout = selectChartLayout(state)
	const xAxis = selectXAxisWithScale(state, xAxisId, yAxisId, isPanorama, overrides?.xAxis)
	const yAxis = selectYAxisWithScale(state, xAxisId, yAxisId, isPanorama, overrides?.yAxis)
	const xAxisTicks = selectXAxisTicks(state, xAxisId, yAxisId, isPanorama)
	const yAxisTicks = selectYAxisTicks(state, xAxisId, yAxisId, isPanorama)
	if (isCategoricalAxis(layout, "xAxis")) {
		return getBandSizeOfAxis(xAxis, xAxisTicks, false)
	}
	return getBandSizeOfAxis(yAxis, yAxisTicks, false)
}

function isLineSettings(item: CartesianGraphicalItemSettings): item is LineSettings {
	return item.type === "line"
}

/*
 * There is a race condition problem because we read some data from props and some from the state.
 * The state is updated through a dispatch and is one render behind,
 * and so we have this weird one tick render where the displayedData in one selector have the old dataKey
 * but the new dataKey in another selector.
 *
 * So here instead of reading the dataKey from the props, we always read it from the state.
 */
function selectSynchronisedLineSettings(
	state: ChartState,
	_xAxisId: AxisId,
	_yAxisId: AxisId,
	_isPanorama: boolean,
	id: GraphicalItemId,
): LineSettings | undefined {
	const graphicalItems = selectUnfilteredCartesianItems(state)
	return graphicalItems.filter(isLineSettings).find((x) => x.id === id)
}

export function selectLinePoints(
	state: ChartState,
	xAxisId: AxisId,
	yAxisId: AxisId,
	isPanorama: boolean,
	id: GraphicalItemId,
	overrides?: LineAxisOverrides,
): ReadonlyArray<LinePointItem> | undefined {
	const layout = selectChartLayout(state)
	const xAxis = selectXAxisWithScale(state, xAxisId, yAxisId, isPanorama, overrides?.xAxis)
	const yAxis = selectYAxisWithScale(state, xAxisId, yAxisId, isPanorama, overrides?.yAxis)
	const xAxisTicks = selectXAxisTicks(state, xAxisId, yAxisId, isPanorama)
	const yAxisTicks = selectYAxisTicks(state, xAxisId, yAxisId, isPanorama)
	const lineSettings =
		overrides?.lineSettings ??
		selectSynchronisedLineSettings(state, xAxisId, yAxisId, isPanorama, id)
	const bandSize = selectBandSize(state, xAxisId, yAxisId, isPanorama, overrides)
	const { chartData, dataStartIndex, dataEndIndex } =
		selectChartDataWithIndexesIfNotInPanoramaPosition4(state, undefined, undefined, isPanorama)

	if (
		lineSettings == null ||
		xAxis == null ||
		yAxis == null ||
		xAxisTicks == null ||
		yAxisTicks == null ||
		xAxisTicks.length === 0 ||
		yAxisTicks.length === 0 ||
		bandSize == null ||
		(layout !== "horizontal" && layout !== "vertical")
	) {
		return undefined
	}

	const { dataKey, data } = lineSettings
	let displayedData: ChartData | undefined

	if (data != null && data.length > 0) {
		displayedData = data
	} else {
		displayedData = chartData?.slice(dataStartIndex, dataEndIndex + 1)
	}

	if (displayedData == null) {
		return undefined
	}

	return computeLinePoints({
		bandSize,
		dataKey,
		displayedData,
		layout,
		xAxis,
		xAxisTicks,
		yAxis,
		yAxisTicks,
	})
}
