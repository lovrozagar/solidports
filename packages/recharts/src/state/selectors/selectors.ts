/* eslint-disable import/no-cycle */
import sortBy from "es-toolkit/compat/sortBy"
import type { ChartState } from "../store"
import { selectChartName } from "./rootPropsSelectors"

/**
 * Compatibility wrapper: returns chart name from the store.
 * In Solid, this reads reactively when called inside a tracking scope.
 */
export { selectChartName as useChartName }
import type {
	ActiveTooltipProps,
	TooltipIndex,
	TooltipInteractionState,
	TooltipPayload,
	TooltipPayloadConfiguration,
} from "../tooltipSlice"
import { calculateCartesianTooltipPos, calculatePolarTooltipPos } from "../../util/ChartUtils"
import type {
	AxisType,
	CartesianLayout,
	ChartOffsetInternal,
	RelativePointer,
	Coordinate,
	DataKey,
	PolarCoordinate,
	PolarLayout,
	PolarViewBoxRequired,
	TickItem,
	TooltipEventType,
} from "../../util/types"
import type { TooltipTrigger } from "../../chart/types"
import { selectChartDataWithIndexes } from "./dataSelectors"
import {
	selectTooltipAxisDomain,
	selectTooltipAxisTicks,
	selectTooltipDisplayedData,
} from "./tooltipSelectors"
import { type AxisRange, selectTooltipAxisDataKey } from "./axisSelectors"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { selectChartHeight, selectChartWidth } from "./containerSelectors"
import { combineActiveLabel } from "./combiners/combineActiveLabel"
import { combineTooltipInteractionState } from "./combiners/combineTooltipInteractionState"
import { combineActiveTooltipIndex } from "./combiners/combineActiveTooltipIndex"
import { combineCoordinateForDefaultIndex } from "./combiners/combineCoordinateForDefaultIndex"
import { combineTooltipPayloadConfigurations } from "./combiners/combineTooltipPayloadConfigurations"
import { selectTooltipPayloadSearcher } from "./selectTooltipPayloadSearcher"
import { selectTooltipState } from "./selectTooltipState"
import { combineTooltipPayload } from "./combiners/combineTooltipPayload"
import {
	calculateActiveTickIndex,
	getActiveCartesianCoordinate,
	getActivePolarCoordinate,
	isInCartesianRange,
} from "../../util/getActiveCoordinate"
import { inRangeOfSector } from "../../util/PolarUtils"

export function selectOrderedTooltipTicks(state: ChartState) {
	const ticks = selectTooltipAxisTicks(state)
	return sortBy(ticks, (o) => o.coordinate)
}

export function selectTooltipInteractionState(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): TooltipInteractionState {
	return combineTooltipInteractionState(
		selectTooltipState(state),
		tooltipEventType,
		trigger,
		defaultIndex,
	)
}

export function selectActiveIndex(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): TooltipIndex | null {
	return combineActiveTooltipIndex(
		selectTooltipInteractionState(state, tooltipEventType, trigger, defaultIndex),
		selectTooltipDisplayedData(state),
		selectTooltipAxisDataKey(state),
		selectTooltipAxisDomain(state),
	)
}

export function selectTooltipDataKey(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
): DataKey<unknown> | undefined {
	if (tooltipEventType == null) {
		return undefined
	}
	const tooltipState = selectTooltipState(state)
	if (tooltipEventType === "axis") {
		if (trigger === "hover") {
			return tooltipState.axisInteraction.hover.dataKey
		}
		return tooltipState.axisInteraction.click.dataKey
	}
	if (trigger === "hover") {
		return tooltipState.itemInteraction.hover.dataKey
	}
	return tooltipState.itemInteraction.click.dataKey
}

export function selectTooltipPayloadConfigurations(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): ReadonlyArray<TooltipPayloadConfiguration> {
	return combineTooltipPayloadConfigurations(
		selectTooltipState(state),
		tooltipEventType,
		trigger,
		defaultIndex,
	)
}

export function selectCoordinateForDefaultIndex(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): Coordinate | undefined {
	return combineCoordinateForDefaultIndex(
		selectChartWidth(state),
		selectChartHeight(state),
		selectChartLayout(state),
		selectChartOffsetInternal(state),
		selectTooltipAxisTicks(state),
		defaultIndex,
		selectTooltipPayloadConfigurations(state, tooltipEventType, trigger, defaultIndex),
	)
}

export function selectActiveCoordinate(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): Coordinate | undefined {
	const tooltipInteractionState = selectTooltipInteractionState(
		state,
		tooltipEventType,
		trigger,
		defaultIndex,
	)
	const defaultIndexCoordinate = selectCoordinateForDefaultIndex(
		state,
		tooltipEventType,
		trigger,
		defaultIndex,
	)
	return tooltipInteractionState.coordinate ?? defaultIndexCoordinate
}

export function selectActiveLabel(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): string | number | undefined {
	return combineActiveLabel(
		selectTooltipAxisTicks(state),
		selectActiveIndex(state, tooltipEventType, trigger, defaultIndex),
	)
}

export function selectTooltipPayload(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): TooltipPayload | undefined {
	return combineTooltipPayload(
		selectTooltipPayloadConfigurations(state, tooltipEventType, trigger, defaultIndex),
		selectActiveIndex(state, tooltipEventType, trigger, defaultIndex),
		selectChartDataWithIndexes(state),
		selectTooltipAxisDataKey(state),
		selectActiveLabel(state, tooltipEventType, trigger, defaultIndex),
		selectTooltipPayloadSearcher(state),
		tooltipEventType,
	)
}

export function selectIsTooltipActive(
	state: ChartState,
	tooltipEventType: TooltipEventType | undefined,
	trigger: TooltipTrigger,
	defaultIndex: TooltipIndex | undefined,
): { isActive: boolean; activeIndex: TooltipIndex | null } {
	const tooltipInteractionState = selectTooltipInteractionState(
		state,
		tooltipEventType,
		trigger,
		defaultIndex,
	)
	const activeIndex = selectActiveIndex(state, tooltipEventType, trigger, defaultIndex)
	return { activeIndex, isActive: tooltipInteractionState.active && activeIndex != null }
}

const combineActiveCartesianProps = (
	chartEvent: RelativePointer | undefined,
	layout: CartesianLayout,
	tooltipAxisType: AxisType | undefined,
	tooltipAxisRange: AxisRange | undefined,
	tooltipTicks: ReadonlyArray<TickItem> | undefined,
	orderedTooltipTicks: ReadonlyArray<TickItem> | undefined,
	offset: ChartOffsetInternal,
): ActiveTooltipProps | undefined => {
	if (!chartEvent || !tooltipAxisType || !tooltipAxisRange || !tooltipTicks) {
		return undefined
	}
	if (!isInCartesianRange(chartEvent, offset)) {
		return undefined
	}
	const pos: number | undefined = calculateCartesianTooltipPos(chartEvent, layout)

	const activeIndex = calculateActiveTickIndex(
		pos,
		orderedTooltipTicks,
		tooltipTicks,
		tooltipAxisType,
		tooltipAxisRange,
	)

	const activeCoordinate = getActiveCartesianCoordinate(
		layout,
		tooltipTicks,
		activeIndex,
		chartEvent,
	)

	return { activeCoordinate, activeIndex: String(activeIndex) }
}

const combineActivePolarProps = (
	chartEvent: RelativePointer | undefined,
	layout: PolarLayout,
	polarViewBox: PolarViewBoxRequired | undefined,
	tooltipAxisType: AxisType | undefined,
	tooltipAxisRange: AxisRange | undefined,
	tooltipTicks: ReadonlyArray<TickItem> | undefined,
	orderedTooltipTicks: ReadonlyArray<TickItem> | undefined,
): ActiveTooltipProps | undefined => {
	if (!chartEvent || !tooltipAxisType || !tooltipAxisRange || !tooltipTicks || !polarViewBox) {
		return undefined
	}
	const rangeObj = inRangeOfSector(chartEvent, polarViewBox)
	if (!rangeObj) {
		return undefined
	}
	const pos: number | undefined = calculatePolarTooltipPos(rangeObj, layout)

	const activeIndex = calculateActiveTickIndex(
		pos,
		orderedTooltipTicks,
		tooltipTicks,
		tooltipAxisType,
		tooltipAxisRange,
	)

	const activeCoordinate: PolarCoordinate = getActivePolarCoordinate(
		layout,
		tooltipTicks,
		activeIndex,
		rangeObj,
	)

	return { activeCoordinate, activeIndex: String(activeIndex) }
}

export const combineActiveProps = (
	chartEvent: RelativePointer | undefined,
	layout: CartesianLayout | PolarLayout | undefined,
	polarViewBox: PolarViewBoxRequired | undefined,
	tooltipAxisType: AxisType | undefined,
	tooltipAxisRange: AxisRange | undefined,
	tooltipTicks: ReadonlyArray<TickItem> | undefined,
	orderedTooltipTicks: ReadonlyArray<TickItem> | undefined,
	offset: ChartOffsetInternal,
): ActiveTooltipProps | undefined => {
	if (!chartEvent || !layout || !tooltipAxisType || !tooltipAxisRange || !tooltipTicks) {
		return undefined
	}
	if (layout === "horizontal" || layout === "vertical") {
		return combineActiveCartesianProps(
			chartEvent,
			layout,
			tooltipAxisType,
			tooltipAxisRange,
			tooltipTicks,
			orderedTooltipTicks,
			offset,
		)
	}
	return combineActivePolarProps(
		chartEvent,
		layout,
		polarViewBox,
		tooltipAxisType,
		tooltipAxisRange,
		tooltipTicks,
		orderedTooltipTicks,
	)
}
