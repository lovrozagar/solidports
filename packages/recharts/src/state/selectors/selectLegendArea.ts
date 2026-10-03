import type { CartesianViewBoxRequired, Margin } from "../../util/types"
import type { ChartState } from "../store"
import { selectChartHeight, selectChartWidth, selectMargin } from "./containerSelectors"
import { chartSelector } from "./chartSelector"

/**
 * Margin-inset chart area. Outside Legend positions (`top`/`bottom`/`left`/`right`)
 * use this instead of the plot-area viewBox so the legend sits beyond any axes.
 */
export const selectLegendArea = chartSelector(function selectLegendArea(state: ChartState): CartesianViewBoxRequired {
	const chartWidth: number = selectChartWidth(state)
	const chartHeight: number = selectChartHeight(state)
	const margin: Margin = selectMargin(state)
	return {
		height: Math.max(chartHeight - (margin.top || 0) - (margin.bottom || 0), 0),
		width: Math.max(chartWidth - (margin.left || 0) - (margin.right || 0), 0),
		x: margin.left || 0,
		y: margin.top || 0,
	}
})
