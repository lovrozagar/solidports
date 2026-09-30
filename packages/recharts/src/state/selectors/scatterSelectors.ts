/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { computeScatterPoints, type ScatterPointItem } from "../../cartesian/Scatter"
import type { RechartsRootState } from "../store"
import type { AxisId, XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import { selectChartDataWithIndexesIfNotInPanoramaPosition4 } from "./dataSelectors"
import type { ChartData, ChartDataState } from "../chartDataSlice"
import {
	selectAxisWithScale,
	selectTicksOfGraphicalItem,
	selectUnfilteredCartesianItems,
	selectZAxisWithScale,
	type ZAxisWithScale,
} from "./axisSelectors"
import type { ScatterSettings } from "../types/ScatterSettings"
import type { GraphicalItemId } from "../graphicalItemsSlice"

/** Optional overrides — bypass the _solid probe path on hot animation frames. */
export type ScatterAxisOverrides = {
	xAxis?: XAxisSettings
	yAxis?: YAxisSettings
	scatterSettings?: ScatterSettings
}

const selectXAxisWithScale = (
	state: RechartsRootState,
	xAxisId: AxisId,
	isPanorama: boolean,
	override?: XAxisSettings,
) => selectAxisWithScale(state, "xAxis", xAxisId, isPanorama, override)

const selectXAxisTicks = (state: RechartsRootState, xAxisId: AxisId, isPanorama: boolean) =>
	selectTicksOfGraphicalItem(state, "xAxis", xAxisId, isPanorama)

const selectYAxisWithScale = (
	state: RechartsRootState,
	yAxisId: AxisId,
	isPanorama: boolean,
	override?: YAxisSettings,
) => selectAxisWithScale(state, "yAxis", yAxisId, isPanorama, override)

const selectYAxisTicks = (state: RechartsRootState, yAxisId: AxisId, isPanorama: boolean) =>
	selectTicksOfGraphicalItem(state, "yAxis", yAxisId, isPanorama)

const selectZAxis = (state: RechartsRootState, zAxisId: AxisId): ZAxisWithScale | undefined =>
	selectZAxisWithScale(state, "zAxis", zAxisId, false)

function selectSynchronisedScatterSettings(
	state: RechartsRootState,
	id: GraphicalItemId,
): ScatterSettings | undefined {
	const graphicalItems = selectUnfilteredCartesianItems(state)
	return graphicalItems.filter((item) => item.type === "scatter").find((item) => item.id === id) as
		| ScatterSettings
		| undefined
}

export function selectScatterPoints(
	state: RechartsRootState,
	xAxisId: AxisId,
	yAxisId: AxisId,
	zAxisId: AxisId,
	id: GraphicalItemId,
	cells: ReadonlyArray<Record<string, unknown>> | undefined,
	isPanorama: boolean,
	overrides?: ScatterAxisOverrides,
): ReadonlyArray<ScatterPointItem> | undefined {
	const { chartData, dataStartIndex, dataEndIndex }: ChartDataState =
		selectChartDataWithIndexesIfNotInPanoramaPosition4(state, undefined, undefined, isPanorama)
	const xAxis = selectXAxisWithScale(state, xAxisId, isPanorama, overrides?.xAxis)
	const xAxisTicks = selectXAxisTicks(state, xAxisId, isPanorama)
	const yAxis = selectYAxisWithScale(state, yAxisId, isPanorama, overrides?.yAxis)
	const yAxisTicks = selectYAxisTicks(state, yAxisId, isPanorama)
	const zAxis = selectZAxis(state, zAxisId)
	const scatterSettings = overrides?.scatterSettings ?? selectSynchronisedScatterSettings(state, id)

	if (scatterSettings == null) {
		return undefined
	}
	let displayedData: ChartData | undefined
	if (scatterSettings?.data != null && scatterSettings.data.length > 0) {
		displayedData = scatterSettings.data
	} else {
		displayedData = chartData?.slice(dataStartIndex, dataEndIndex + 1)
	}
	if (
		displayedData == null ||
		xAxis == null ||
		yAxis == null ||
		xAxisTicks == null ||
		yAxisTicks == null ||
		xAxisTicks?.length === 0 ||
		yAxisTicks?.length === 0
	) {
		return undefined
	}
	return computeScatterPoints({
		cells: cells as ReadonlyArray<JSX.Element> | undefined,
		displayedData,
		scatterSettings,
		xAxis,
		xAxisTicks,
		yAxis,
		yAxisTicks,
		zAxis,
	})
}
