/* eslint-disable import/no-cycle */
import { ChartState } from "../store"
import { AxisId } from "../cartesianAxisSlice"
import { selectTooltipSettings } from "./selectTooltipSettings"

export const selectTooltipAxisId = (state: ChartState): AxisId =>
	selectTooltipSettings(state).axisId
