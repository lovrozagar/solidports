/* eslint-disable import/no-cycle */
import { RechartsRootState } from "../store"
import { AxisId } from "../cartesianAxisSlice"
import { selectTooltipSettings } from "./selectTooltipSettings"

export const selectTooltipAxisId = (state: RechartsRootState): AxisId =>
	selectTooltipSettings(state).axisId
