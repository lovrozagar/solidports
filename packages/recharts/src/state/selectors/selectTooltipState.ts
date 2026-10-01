/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { TooltipState } from "../tooltipSlice"
import { readChartState } from "../chartState"

export const selectTooltipState = (state: ChartState): TooltipState => {
	return readChartState(state).tooltip
}
