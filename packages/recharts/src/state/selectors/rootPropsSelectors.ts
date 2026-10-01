/* eslint-disable import/no-cycle */
import { ChartState } from "../store"
import { StackOffsetType } from "../../util/types"
import { SyncMethod } from "../../synchronisation/types"
import { BaseValue } from "../../cartesian/Area"

export const selectRootMaxBarSize = (state: ChartState): number | undefined =>
	state.rootProps.maxBarSize
export const selectBarGap = (state: ChartState): string | number => state.rootProps.barGap
export const selectBarCategoryGap = (state: ChartState): string | number =>
	state.rootProps.barCategoryGap
export const selectRootBarSize = (state: ChartState): string | number | undefined =>
	state.rootProps.barSize
export const selectStackOffsetType = (state: ChartState): StackOffsetType =>
	state.rootProps.stackOffset
export const selectReverseStackOrder = (state: ChartState): boolean =>
	state.rootProps.reverseStackOrder
export const selectChartName = (state: ChartState) => state.options.chartName

export const selectSyncId = (state: ChartState) => state.rootProps.syncId
export const selectSyncMethod = (state: ChartState): SyncMethod => state.rootProps.syncMethod
export const selectEventEmitter = (state: ChartState) => state.options.eventEmitter
export const selectChartBaseValue: (state: ChartState) => BaseValue | undefined = (
	state: ChartState,
) => state.rootProps.baseValue
