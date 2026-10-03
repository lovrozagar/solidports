/* eslint-disable import/no-cycle */
import { ChartState } from "../store"
import { chartSelector } from "./chartSelector"
import { ChartData, ChartDataState } from "../chartDataSlice"

/**
 * This selector always returns the data with the indexes set by a Brush.
 * Trouble is, that might or might not be what you want.
 *
 * In charts with Brush, you will sometimes want to select the full range of data, and sometimes the one decided by the Brush
 * - even if the Brush is active, the panorama inside the Brush should show the full range of data.
 *
 * So instead of this selector, consider using either selectChartDataAndAlwaysIgnoreIndexes or selectChartDataWithIndexesIfNotInPanorama
 *
 * @param state ChartState
 * @returns data defined on the chart root element, such as BarChart or ScatterChart
 */
export const selectChartDataWithIndexes = (state: ChartState): ChartDataState =>
	state.chartData

/**
 * This selector will always return the full range of data, ignoring the indexes set by a Brush.
 * Useful for when you want to render the full range of data, even if a Brush is active.
 * For example: in the Brush panorama, in Legend, in Tooltip.
 */
export const selectChartDataAndAlwaysIgnoreIndexes = chartSelector(function selectChartDataAndAlwaysIgnoreIndexes(state: ChartState): ChartDataState {
	const dataState = selectChartDataWithIndexes(state)
	const dataEndIndex = dataState.chartData != null ? dataState.chartData.length - 1 : 0
	return {
		chartData: dataState.chartData,
		computedData: dataState.computedData,
		dataEndIndex,
		dataStartIndex: 0,
	}
})

export const selectChartDataWithIndexesIfNotInPanoramaPosition4 = chartSelector((
	state: ChartState,
	_unused1: unknown,
	_unused2: unknown,
	isPanorama: boolean,
): ChartDataState => {
	if (isPanorama) {
		return selectChartDataAndAlwaysIgnoreIndexes(state)
	}
	return selectChartDataWithIndexes(state)
})

/**
 * Returns the chart-level data sliced by the Brush indexes (full range in the panorama).
 */
export const selectChartDataSliceIfNotInPanorama = chartSelector((
	state: ChartState,
	_unused1: unknown,
	_unused2: unknown,
	isPanorama: boolean,
): ChartData => {
	const { chartData, dataStartIndex, dataEndIndex } = selectChartDataWithIndexesIfNotInPanoramaPosition4(
		state,
		_unused1,
		_unused2,
		isPanorama,
	)
	return chartData != null ? chartData.slice(dataStartIndex, dataEndIndex + 1) : []
})

export const selectChartDataWithIndexesIfNotInPanoramaPosition3 = chartSelector((
	state: ChartState,
	_unused1: unknown,
	isPanorama: boolean,
): ChartDataState => {
	if (isPanorama) {
		return selectChartDataAndAlwaysIgnoreIndexes(state)
	}
	return selectChartDataWithIndexes(state)
})

/** Chart-level data slice ignoring Brush indexes (polar charts always use the full range). */
export const selectChartDataSliceIgnoringIndexes = chartSelector(function selectChartDataSliceIgnoringIndexes(state: ChartState): ChartData {
	const { chartData, dataStartIndex, dataEndIndex } = selectChartDataAndAlwaysIgnoreIndexes(state)
	return chartData != null ? chartData.slice(dataStartIndex, dataEndIndex + 1) : []
})

/** Chart-level data slice honoring Brush indexes (tooltip never renders in the panorama). */
export const selectChartDataSliceWithIndexes = chartSelector(function selectChartDataSliceWithIndexes(state: ChartState): ChartData {
	const { chartData, dataStartIndex, dataEndIndex } = selectChartDataWithIndexes(state)
	return chartData != null ? chartData.slice(dataStartIndex, dataEndIndex + 1) : []
})
