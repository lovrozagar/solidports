/* eslint-disable import/no-cycle */
import { RechartsRootState } from "../store"
import { TooltipEventType } from "../../util/types"
import { useChartStore } from "../RechartsStoreContext"
import { SharedTooltipSettings } from "../tooltipSlice"

export const selectDefaultTooltipEventType = (state: RechartsRootState): TooltipEventType =>
	state.options.defaultTooltipEventType

export const selectValidateTooltipEventTypes = (
	state: RechartsRootState,
): ReadonlyArray<TooltipEventType> | undefined => state.options.validateTooltipEventTypes

export function combineTooltipEventType(
	shared: SharedTooltipSettings,
	defaultTooltipEventType: TooltipEventType,
	validateTooltipEventTypes: ReadonlyArray<TooltipEventType> | undefined,
): TooltipEventType {
	if (shared == null) {
		return defaultTooltipEventType
	}
	const eventType = shared ? "axis" : "item"
	if (validateTooltipEventTypes == null) {
		return defaultTooltipEventType
	}
	return validateTooltipEventTypes.includes(eventType) ? eventType : defaultTooltipEventType
}

export function selectTooltipEventType(
	state: RechartsRootState,
	shared: SharedTooltipSettings,
): TooltipEventType {
	const defaultTooltipEventType = selectDefaultTooltipEventType(state)
	const validateTooltipEventTypes = selectValidateTooltipEventTypes(state)
	return combineTooltipEventType(shared, defaultTooltipEventType, validateTooltipEventTypes)
}

/* 1:1 port of upstream useTooltipEventType. Returns bare T per GOTCHA-011;
   reads via useChartStore so panorama/standalone usage returns undefined
   instead of throwing. Caller is expected to live in a tracked scope
   (createMemo/createEffect/JSX) for reactivity. */
export function useTooltipEventType(
	shared: SharedTooltipSettings,
): TooltipEventType | undefined {
	const ctx = useChartStore()
	if (!ctx) {
		return undefined
	}
	return selectTooltipEventType(ctx.store, shared)
}
