/* eslint-disable import/no-cycle */
import { ChartState } from "../store"
import { TooltipPayloadSearcher } from "../tooltipSlice"

export const selectTooltipPayloadSearcher = (state: ChartState): TooltipPayloadSearcher =>
	state.options.tooltipPayloadSearcher
