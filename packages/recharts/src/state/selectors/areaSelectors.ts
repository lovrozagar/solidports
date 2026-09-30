/* eslint-disable import/no-cycle */
import type { NullableCoordinate } from "../../util/types"
import { computeArea } from "../../cartesian/Area"
import {
	selectAxisWithScale,
	selectStackGroups,
	selectTicksOfGraphicalItem,
	selectUnfilteredCartesianItems,
} from "./axisSelectors"
import type { RechartsRootState } from "../store"
import type { AxisId, XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { selectChartDataWithIndexesIfNotInPanoramaPosition3 } from "./dataSelectors"
import { getBandSizeOfAxis, isCategoricalAxis, type StackId } from "../../util/ChartUtils"
import type { ChartData } from "../chartDataSlice"
import { getStackSeriesIdentifier } from "../../util/stacks/getStackSeriesIdentifier"
import type {
	StackDataPoint,
	StackGroup,
	StackSeries,
	StackSeriesIdentifier,
} from "../../util/stacks/stackTypes"
import type { AreaSettings } from "../types/AreaSettings"
import type { GraphicalItemId } from "../graphicalItemsSlice"
import { selectChartBaseValue } from "./rootPropsSelectors"
import {
	selectXAxisIdFromGraphicalItemId,
	selectYAxisIdFromGraphicalItemId,
} from "./graphicalItemSelectors"

/** Optional overrides — bypass the _solid probe path on hot animation frames. */
export type AreaAxisOverrides = {
	xAxis?: XAxisSettings
	yAxis?: YAxisSettings
	areaSettings?: AreaSettings
}

export interface AreaPointItem extends NullableCoordinate {
	x: number | null
	y: number | null
	value?: ReadonlyArray<unknown>
	payload?: unknown
}

export type ComputedArea = {
	points: ReadonlyArray<AreaPointItem>
	baseLine: number | ReadonlyArray<AreaPointItem>
	isRange: boolean
}

const selectXAxisWithScale = (
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
	override?: XAxisSettings,
) =>
	selectAxisWithScale(
		state,
		"xAxis",
		selectXAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
		override,
	)

const selectXAxisTicks = (
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
) =>
	selectTicksOfGraphicalItem(
		state,
		"xAxis",
		selectXAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
	)

const selectYAxisWithScale = (
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
	override?: YAxisSettings,
) =>
	selectAxisWithScale(
		state,
		"yAxis",
		selectYAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
		override,
	)

const selectYAxisTicks = (
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
) =>
	selectTicksOfGraphicalItem(
		state,
		"yAxis",
		selectYAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
	)

function selectBandSize(
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
	overrides?: AreaAxisOverrides,
) {
	const layout = selectChartLayout(state)
	const xAxis = selectXAxisWithScale(state, graphicalItemId, isPanorama, overrides?.xAxis)
	const yAxis = selectYAxisWithScale(state, graphicalItemId, isPanorama, overrides?.yAxis)
	const xAxisTicks = selectXAxisTicks(state, graphicalItemId, isPanorama)
	const yAxisTicks = selectYAxisTicks(state, graphicalItemId, isPanorama)
	if (isCategoricalAxis(layout, "xAxis")) {
		return getBandSizeOfAxis(xAxis, xAxisTicks, false)
	}
	return getBandSizeOfAxis(yAxis, yAxisTicks, false)
}

function selectSynchronisedAreaSettings(
	state: RechartsRootState,
	id: GraphicalItemId,
): AreaSettings | undefined {
	const graphicalItems = selectUnfilteredCartesianItems(state)
	return graphicalItems.filter((item) => item.type === "area").find((item) => item.id === id) as
		| AreaSettings
		| undefined
}

const selectNumericalAxisType = (state: RechartsRootState): "xAxis" | "yAxis" => {
	const layout = selectChartLayout(state)
	const isXAxisCategorical = isCategoricalAxis(layout, "xAxis")
	return isXAxisCategorical ? "yAxis" : "xAxis"
}

const selectNumericalAxisIdFromGraphicalItemId = (
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
): AxisId => {
	const axisType = selectNumericalAxisType(state)
	if (axisType === "yAxis") {
		return selectYAxisIdFromGraphicalItemId(state, graphicalItemId)
	}
	return selectXAxisIdFromGraphicalItemId(state, graphicalItemId)
}

const selectNumericalAxisStackGroups = (
	state: RechartsRootState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
): Record<StackId, StackGroup> | undefined =>
	selectStackGroups(
		state,
		selectNumericalAxisType(state),
		selectNumericalAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
	)

export function selectGraphicalItemStackedData(
	state: RechartsRootState,
	id: GraphicalItemId,
	isPanorama: boolean,
): ReadonlyArray<StackDataPoint> | undefined {
	const areaSettings = selectSynchronisedAreaSettings(state, id)
	const stackGroups = selectNumericalAxisStackGroups(state, id, isPanorama)
	if (areaSettings == null || stackGroups == null) {
		return undefined
	}
	const { stackId } = areaSettings
	const stackSeriesIdentifier: StackSeriesIdentifier | undefined =
		getStackSeriesIdentifier(areaSettings)
	if (stackId == null || stackSeriesIdentifier == null) {
		return undefined
	}
	const groups: ReadonlyArray<StackSeries> | undefined = stackGroups[stackId]?.stackedData
	const found: StackSeries | undefined = groups?.find((v) => v.key === stackSeriesIdentifier)
	if (found == null) {
		return undefined
	}
	return found.map((item): StackDataPoint => [item[0], item[1]])
}

export function selectArea(
	state: RechartsRootState,
	id: GraphicalItemId,
	isPanorama: boolean,
	overrides?: AreaAxisOverrides,
): ComputedArea | undefined {
	const layout = selectChartLayout(state)
	const xAxis = selectXAxisWithScale(state, id, isPanorama, overrides?.xAxis)
	const yAxis = selectYAxisWithScale(state, id, isPanorama, overrides?.yAxis)
	const xAxisTicks = selectXAxisTicks(state, id, isPanorama)
	const yAxisTicks = selectYAxisTicks(state, id, isPanorama)
	const stackedData = selectGraphicalItemStackedData(state, id, isPanorama)
	const { chartData, dataStartIndex, dataEndIndex } =
		selectChartDataWithIndexesIfNotInPanoramaPosition3(state, undefined, isPanorama)
	const bandSize = selectBandSize(state, id, isPanorama, overrides)
	const areaSettings = overrides?.areaSettings ?? selectSynchronisedAreaSettings(state, id)
	const chartBaseValue = selectChartBaseValue(state)

	if (
		areaSettings == null ||
		(layout !== "horizontal" && layout !== "vertical") ||
		xAxis == null ||
		yAxis == null ||
		xAxisTicks == null ||
		yAxisTicks == null ||
		xAxisTicks.length === 0 ||
		yAxisTicks.length === 0 ||
		bandSize == null
	) {
		return undefined
	}
	const { data } = areaSettings

	let displayedData: ChartData | undefined
	if (data && data.length > 0) {
		displayedData = data
	} else {
		displayedData = chartData?.slice(dataStartIndex, dataEndIndex + 1)
	}

	if (displayedData == null) {
		return undefined
	}

	return computeArea({
		areaSettings,
		bandSize,
		chartBaseValue,
		dataStartIndex,
		displayedData,
		layout,
		stackedData,
		xAxis,
		xAxisTicks,
		yAxis,
		yAxisTicks,
	})
}
