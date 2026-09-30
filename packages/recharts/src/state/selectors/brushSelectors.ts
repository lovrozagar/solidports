/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { selectMargin } from "./containerSelectors"
import { isNumber } from "../../util/DataUtils"
import type { BrushSettings } from "../brushSlice"

export const selectBrushSettings = (state: RechartsRootState): BrushSettings => {
	const solidBrush = (state._solid as Partial<typeof state._solid>).brush
	if (solidBrush != null && solidBrush.height !== 0) {
		return solidBrush
	}
	/* Legacy compat shim — fallback when _solid.brush is unset or zeroed */
	if (state.brush != null && state.brush.height !== 0) {
		return state.brush
	}
	/* Both zeroed/null — return whichever is defined (prefer _solid, then legacy) */
	return solidBrush ?? state.brush
}

export type BrushDimensions = {
	x: number
	y: number
	width: number
	height: number
}

export function selectBrushDimensions(state: RechartsRootState): BrushDimensions {
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
