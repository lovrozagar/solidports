/* eslint-disable import/no-cycle */
import type { DataKey, NullableCoordinate } from "../../util/types"
import { computeArea } from "../../cartesian/Area"
import {
	selectAxisWithScale,
	selectStackGroups,
	selectTicksOfGraphicalItem,
	selectUnfilteredCartesianItems,
} from "./axisSelectors"
import type { ChartState } from "../store"
import type { AxisId, XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { selectChartDataWithIndexesIfNotInPanoramaPosition3 } from "./dataSelectors"
import { getBandSizeOfAxis, isCategoricalAxis, type StackId } from "../../util/ChartUtils"
import { isNotNil } from "../../util/DataUtils"
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
import { chartSelector } from "./chartSelector"
import {
	selectXAxisIdFromGraphicalItemId,
	selectYAxisIdFromGraphicalItemId,
} from "./graphicalItemSelectors"

/** Optional overrides — bypass the axis-settings lookup on hot animation frames. */
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

const selectXAxisWithScale = chartSelector((
	state: ChartState,
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
	))

const selectXAxisTicks = chartSelector((
	state: ChartState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
) =>
	selectTicksOfGraphicalItem(
		state,
		"xAxis",
		selectXAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
	))

const selectYAxisWithScale = chartSelector((
	state: ChartState,
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
	))

const selectYAxisTicks = chartSelector((
	state: ChartState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
) =>
	selectTicksOfGraphicalItem(
		state,
		"yAxis",
		selectYAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
	))

const selectBandSize = chartSelector(function selectBandSize(state: ChartState, graphicalItemId: GraphicalItemId, isPanorama: boolean, overrides?: AreaAxisOverrides) {
	const layout = selectChartLayout(state)
	const xAxis = selectXAxisWithScale(state, graphicalItemId, isPanorama, overrides?.xAxis)
	const yAxis = selectYAxisWithScale(state, graphicalItemId, isPanorama, overrides?.yAxis)
	const xAxisTicks = selectXAxisTicks(state, graphicalItemId, isPanorama)
	const yAxisTicks = selectYAxisTicks(state, graphicalItemId, isPanorama)
	if (isCategoricalAxis(layout, "xAxis")) {
		return getBandSizeOfAxis(xAxis, xAxisTicks, false)
	}
	return getBandSizeOfAxis(yAxis, yAxisTicks, false)
})

const selectSynchronisedAreaSettings = chartSelector(function selectSynchronisedAreaSettings(state: ChartState, id: GraphicalItemId): AreaSettings | undefined {
	const graphicalItems = selectUnfilteredCartesianItems(state)
	return graphicalItems.filter((item) => item.type === "area").find((item) => item.id === id) as
		| AreaSettings
		| undefined
})

const selectNumericalAxisType = chartSelector((state: ChartState): "xAxis" | "yAxis" => {
	const layout = selectChartLayout(state)
	const isXAxisCategorical = isCategoricalAxis(layout, "xAxis")
	return isXAxisCategorical ? "yAxis" : "xAxis"
})

const selectNumericalAxisIdFromGraphicalItemId = chartSelector((
	state: ChartState,
	graphicalItemId: GraphicalItemId,
): AxisId => {
	const axisType = selectNumericalAxisType(state)
	if (axisType === "yAxis") {
		return selectYAxisIdFromGraphicalItemId(state, graphicalItemId)
	}
	return selectXAxisIdFromGraphicalItemId(state, graphicalItemId)
})

const selectNumericalAxisStackGroups = chartSelector((
	state: ChartState,
	graphicalItemId: GraphicalItemId,
	isPanorama: boolean,
): Record<StackId, StackGroup> | undefined =>
	selectStackGroups(
		state,
		selectNumericalAxisType(state),
		selectNumericalAxisIdFromGraphicalItemId(state, graphicalItemId),
		isPanorama,
	))

export const selectGraphicalItemStackedData = chartSelector(function selectGraphicalItemStackedData(state: ChartState, id: GraphicalItemId, isPanorama: boolean): ReadonlyArray<StackDataPoint> | undefined {
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
})

const selectStackDataKeys = chartSelector(function selectStackDataKeys(state: ChartState, id: GraphicalItemId, isPanorama: boolean): ReadonlyArray<DataKey<unknown>> | undefined {
	const areaSettings = selectSynchronisedAreaSettings(state, id)
	const stackGroups = selectNumericalAxisStackGroups(state, id, isPanorama)
	if (areaSettings == null || areaSettings.stackId == null || stackGroups == null) {
		return undefined
	}
	const group: StackGroup | undefined = stackGroups[areaSettings.stackId]
	if (group == null) {
		return undefined
	}
	return group.graphicalItems.map((item) => item.dataKey).filter(isNotNil)
})

export const selectArea = chartSelector(function selectArea(state: ChartState, id: GraphicalItemId, isPanorama: boolean, overrides?: AreaAxisOverrides): ComputedArea | undefined {
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
	const stackDataKeys = selectStackDataKeys(state, id, isPanorama)

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
		stackDataKeys,
		xAxis,
		xAxisTicks,
		yAxis,
		yAxisTicks,
	})
})
