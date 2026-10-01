/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import { readChartState } from "../chartState"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { selectMargin } from "./containerSelectors"
import { isNumber } from "../../util/DataUtils"
import type { BrushSettings } from "../brushSlice"

export const selectBrushSettings = (state: ChartState): BrushSettings => {
	return readChartState(state).brush
}

export type BrushDimensions = {
	x: number
	y: number
	width: number
	height: number
}

export function selectBrushDimensions(state: ChartState): BrushDimensions {
	const brushSettings = selectBrushSettings(state)
	const offset = selectChartOffsetInternal(state)
	const margin = selectMargin(state)
	return {
		height: brushSettings.height,
		width: isNumber(brushSettings.width) ? brushSettings.width : offset.width,
		x: isNumber(brushSettings.x) ? brushSettings.x : offset.left,
		y: isNumber(brushSettings.y)
			? brushSettings.y
			: offset.top + offset.height + offset.brushBottom - (margin?.bottom || 0),
	}
}
