/* eslint-disable import/no-cycle */
import { selectLegendSettings, selectLegendSize } from "./legendSelectors"
import type {
	CartesianViewBoxRequired,
	ChartOffsetInternal,
	Margin,
	OffsetHorizontal,
	OffsetVertical,
	Size,
} from "../../util/types"
import type { XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import type { LegendSettings } from "../legendSlice"
import { appendOffsetOfLegend } from "../../util/ChartUtils"
import { selectChartHeight, selectChartWidth, selectMargin } from "./containerSelectors"
import { selectAllXAxes, selectAllYAxes } from "./selectAllAxes"
import { DEFAULT_X_AXIS_HEIGHT, DEFAULT_Y_AXIS_WIDTH } from "../../util/Constants"
import type { ChartState } from "../store"
import { readChartState } from "../chartState"

export const selectBrushHeight = (state: ChartState) => {
	return readChartState(state).brush.height ?? 0
}

function selectLeftAxesOffset(state: ChartState): number {
	const yAxes = selectAllYAxes(state)
	return yAxes.reduce((result: number, entry: YAxisSettings): number => {
		if (entry.orientation === "left" && !entry.mirror && !entry.hide) {
			const width = typeof entry.width === "number" ? entry.width : DEFAULT_Y_AXIS_WIDTH
			return result + width
		}
		return result
	}, 0)
}

function selectRightAxesOffset(state: ChartState): number {
	const yAxes = selectAllYAxes(state)
	return yAxes.reduce((result: number, entry: YAxisSettings): number => {
		if (entry.orientation === "right" && !entry.mirror && !entry.hide) {
			const width = typeof entry.width === "number" ? entry.width : DEFAULT_Y_AXIS_WIDTH
			return result + width
		}
		return result
	}, 0)
}

function selectTopAxesOffset(state: ChartState): number {
	const xAxes = selectAllXAxes(state)
	return xAxes.reduce((result: number, entry: XAxisSettings): number => {
		if (entry.orientation === "top" && !entry.mirror && !entry.hide) {
			const height = typeof entry.height === "number" ? entry.height : DEFAULT_X_AXIS_HEIGHT
			return result + height
		}
		return result
	}, 0)
}

function selectBottomAxesOffset(state: ChartState): number {
	const xAxes = selectAllXAxes(state)
	return xAxes.reduce((result: number, entry: XAxisSettings): number => {
		if (entry.orientation === "bottom" && !entry.mirror && !entry.hide) {
			const height = typeof entry.height === "number" ? entry.height : DEFAULT_X_AXIS_HEIGHT
			return result + height
		}
		return result
	}, 0)
}

/**
 * For internal use only.
 *
 * @param state root state
 * @return ChartOffsetInternal
 */
export function selectChartOffsetInternal(state: ChartState): ChartOffsetInternal {
	const chartWidth: number = selectChartWidth(state)
	const chartHeight: number = selectChartHeight(state)
	const margin: Margin = selectMargin(state)
	const brushHeight: number = selectBrushHeight(state)
	const leftAxesOffset: number = selectLeftAxesOffset(state)
	const rightAxesOffset: number = selectRightAxesOffset(state)
	const topAxesOffset: number = selectTopAxesOffset(state)
	const bottomAxesOffset: number = selectBottomAxesOffset(state)
	const legendSettings: LegendSettings = selectLegendSettings(state)
	const legendSize: Size = selectLegendSize(state)

	const offsetH: OffsetHorizontal = {
		left: (margin.left || 0) + leftAxesOffset,
		right: (margin.right || 0) + rightAxesOffset,
	}

	const offsetV: OffsetVertical = {
		bottom: (margin.bottom || 0) + bottomAxesOffset,
		top: (margin.top || 0) + topAxesOffset,
	}

	let offset = { ...offsetV, ...offsetH }

	const brushBottom = offset.bottom

	offset.bottom += brushHeight

	offset = appendOffsetOfLegend(offset, legendSettings, legendSize)

	const offsetWidth = chartWidth - offset.left - offset.right
	const offsetHeight = chartHeight - offset.top - offset.bottom

	return {
		brushBottom,
		...offset,
		/* never return negative values for height and width */
		height: Math.max(offsetHeight, 0),
		width: Math.max(offsetWidth, 0),
	}
}

export function selectChartViewBox(state: ChartState): CartesianViewBoxRequired {
	const offset = selectChartOffsetInternal(state)
	return {
		height: offset.height,
		width: offset.width,
		x: offset.left,
		y: offset.top,
	}
}

export function selectAxisViewBox(state: ChartState): CartesianViewBoxRequired {
	const width = selectChartWidth(state)
	const height = selectChartHeight(state)
	return {
		height,
		width,
		x: 0,
		y: 0,
	}
}
