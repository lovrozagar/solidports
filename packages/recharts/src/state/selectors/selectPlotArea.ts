/* eslint-disable import/no-cycle */
import { selectChartOffset } from "./selectChartOffset"
import { selectChartHeight, selectChartWidth } from "./containerSelectors"
import type { RechartsRootState } from "../store"

export function selectPlotArea(state: RechartsRootState) {
	const offset = selectChartOffset(state)
	const chartWidth = selectChartWidth(state)
	const chartHeight = selectChartHeight(state)

	if (!offset || chartWidth == null || chartHeight == null) {
		return undefined
	}

	return {
		height: Math.max(0, chartHeight - offset.top - offset.bottom),
		width: Math.max(0, chartWidth - offset.left - offset.right),
		x: offset.left,
		y: offset.top,
	}
}
