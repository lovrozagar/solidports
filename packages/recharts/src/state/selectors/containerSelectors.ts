/* eslint-disable import/no-cycle */
import { ChartState } from "../store"
import { Margin } from "../../util/types"

export const selectChartWidth = (state: ChartState): number => state.layout.width

export const selectChartHeight = (state: ChartState): number => state.layout.height

export const selectContainerScale: (state: ChartState) => number = (state) =>
	state.layout.scale

export const selectMargin = (state: ChartState): Margin => state.layout.margin
