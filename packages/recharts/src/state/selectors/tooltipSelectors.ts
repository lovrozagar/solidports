/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import { selectChartDataSliceWithIndexes } from "./dataSelectors"
import { readChartState } from "../chartState"
import {
	type AxisRange,
	combineAllAppliedValues,
	combineAreasDomain,
	combineAxisDomain,
	combineAxisDomainWithNiceTicks,
	combineCategoricalDomain,
	combineDisplayedData,
	combineDomainOfAllAppliedNumericalValuesIncludingErrorValues,
	combineDomainOfStackGroups,
	combineDotsDomain,
	combineDuplicateDomain,
	combineGraphicalItemsData,
	combineGraphicalItemsSettings,
	combineLinesDomain,
	combineNiceTicks,
	combineNumericalDomain,
	combineStackGroups,
	filterGraphicalNotStackedItems,
	filterReferenceElements,
	getDomainDefinition,
	itemAxisPredicate,
	mergeDomains,
	type RenderableAxisSettings,
	selectAllErrorBarSettings,
	selectAxisRange,
	selectHasBar,
	selectReferenceAreas,
	selectReferenceDots,
	selectReferenceLines,
	selectTooltipAxis,
	selectTooltipAxisDataKey,
	selectUnfilteredCartesianItems,
} from "./axisSelectors"
import { selectUnfilteredPolarItems } from "./polarSelectors"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { isCategoricalAxis, type StackId } from "../../util/ChartUtils"
import type {
	AxisDomain,
	CategoricalDomain,
	CategoricalDomainItem,
	Coordinate,
	D3ScaleType,
	DataKey,
	LayoutType,
	NumberDomain,
	TickItem,
	TooltipEventType,
} from "../../util/types"
import type { AppliedChartData, ChartData } from "../chartDataSlice"
import { selectChartDataWithIndexes } from "./dataSelectors"
import type {
	CartesianGraphicalItemSettings,
	GraphicalItemSettings,
	PolarGraphicalItemSettings,
} from "../graphicalItemsSlice"
import type {
	ReferenceAreaSettings,
	ReferenceDotSettings,
	ReferenceLineSettings,
} from "../referenceElementsSlice"
import {
	selectChartName,
	selectReverseStackOrder,
	selectStackOffsetType,
} from "./rootPropsSelectors"
import { isNotNil, mathSign } from "../../util/DataUtils"
import { combineAxisRangeWithReverse } from "./combiners/combineAxisRangeWithReverse"
import type {
	TooltipIndex,
	TooltipInteractionState,
	TooltipPayload,
	TooltipSettingsState,
} from "../tooltipSlice"

import {
	combineTooltipEventType,
	selectDefaultTooltipEventType,
	selectValidateTooltipEventTypes,
} from "./selectTooltipEventType"

import { combineActiveLabel } from "./combiners/combineActiveLabel"

import { selectTooltipSettings } from "./selectTooltipSettings"

import { combineTooltipInteractionState } from "./combiners/combineTooltipInteractionState"
import { combineActiveTooltipIndex } from "./combiners/combineActiveTooltipIndex"
import { combineCoordinateForDefaultIndex } from "./combiners/combineCoordinateForDefaultIndex"
import { selectChartHeight, selectChartWidth } from "./containerSelectors"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { combineTooltipPayloadConfigurations } from "./combiners/combineTooltipPayloadConfigurations"
import { selectTooltipPayloadSearcher } from "./selectTooltipPayloadSearcher"
import { selectTooltipState } from "./selectTooltipState"

import { combineTooltipPayload } from "./combiners/combineTooltipPayload"
import type { StackGroup } from "../../util/stacks/stackTypes"
import { selectTooltipAxisId } from "./selectTooltipAxisId"
import { type RenderableAxisType, selectTooltipAxisType } from "./selectTooltipAxisType"
import {
	combineDisplayedStackedData,
	type DisplayedStackedData,
} from "./combiners/combineDisplayedStackedData"
import { type DefinitelyStackedGraphicalItem, isStacked } from "../types/StackedGraphicalItem"
import { numericalDomainSpecifiedWithoutRequiringData } from "../../util/isDomainSpecifiedByUser"
import type { ActiveLabel } from "../../synchronisation/types"
import { type RechartsScale, rechartsScaleFactory } from "../../util/scale/RechartsScale"
import { isWellBehavedNumber } from "../../util/isWellBehavedNumber"
import { combineRealScaleType } from "./combiners/combineRealScaleType"
import { combineConfiguredScale } from "./combiners/combineConfiguredScale"
import type { CustomScaleDefinition } from "../../util/scale/CustomScaleDefinition"

export function selectTooltipAxisRealScaleType(state: ChartState): D3ScaleType | undefined {
	return combineRealScaleType(selectTooltipAxis(state), selectHasBar(state), selectChartName(state))
}

export function selectAllUnfilteredGraphicalItems(
	state: ChartState,
): ReadonlyArray<CartesianGraphicalItemSettings | PolarGraphicalItemSettings> {
	return [
		...selectUnfilteredCartesianItems(state),
		...selectUnfilteredPolarItems(state),
	]
}

function selectTooltipAxisPredicate(state: ChartState) {
	return itemAxisPredicate(selectTooltipAxisType(state), selectTooltipAxisId(state))
}

export function selectAllGraphicalItemsSettings(
	state: ChartState,
): ReadonlyArray<GraphicalItemSettings> {
	return combineGraphicalItemsSettings(
		selectAllUnfilteredGraphicalItems(state),
		selectTooltipAxis(state),
		selectTooltipAxisPredicate(state),
	)
}

function selectAllStackedGraphicalItemsSettings(
	state: ChartState,
): ReadonlyArray<DefinitelyStackedGraphicalItem> {
	return selectAllGraphicalItemsSettings(state).filter(isStacked)
}

export function selectTooltipGraphicalItemsData(state: ChartState): ChartData {
	return combineGraphicalItemsData(selectAllGraphicalItemsSettings(state))
}

/**
 * Data for tooltip always use the data with indexes set by a Brush,
 * and never accept the isPanorama flag:
 * because Tooltip never displays inside the panorama anyway
 * so we don't need to worry what would happen there.
 */
export function selectTooltipDisplayedData(state: ChartState): ChartData {
	return combineDisplayedData(
		selectTooltipGraphicalItemsData(state),
		selectChartDataWithIndexes(state),
	)
}

function selectTooltipStackedData(state: ChartState): DisplayedStackedData {
	return combineDisplayedStackedData(
		selectAllStackedGraphicalItemsSettings(state),
		selectChartDataWithIndexes(state),
		selectTooltipAxis(state),
	)
}

function selectAnyTooltipItemUsesChartData(state: ChartState): boolean {
	return selectAllGraphicalItemsSettings(state).some((item) => !(item as { data?: unknown }).data)
}

function selectAllTooltipAppliedValues(state: ChartState): AppliedChartData {
	return combineAllAppliedValues(
		selectTooltipDisplayedData(state),
		selectTooltipAxis(state),
		selectAllGraphicalItemsSettings(state),
		selectChartDataWithIndexes(state),
		selectAnyTooltipItemUsesChartData(state),
		selectTooltipGraphicalItemsData(state),
	)
}

function selectTooltipAxisDomainDefinition(state: ChartState): AxisDomain | undefined {
	return getDomainDefinition(selectTooltipAxis(state))
}

function selectTooltipDataOverflow(state: ChartState): boolean {
	return selectTooltipAxis(state).allowDataOverflow
}

function selectTooltipDomainFromUserPreferences(
	state: ChartState,
): NumberDomain | undefined {
	return numericalDomainSpecifiedWithoutRequiringData(
		selectTooltipAxisDomainDefinition(state),
		selectTooltipDataOverflow(state),
	)
}

function selectAllStackedGraphicalItems(
	state: ChartState,
): ReadonlyArray<DefinitelyStackedGraphicalItem> {
	return selectAllGraphicalItemsSettings(state).filter(isStacked)
}

function selectTooltipStackGroups(state: ChartState): Record<StackId, StackGroup> {
	return combineStackGroups(
		selectTooltipStackedData(state),
		selectAllStackedGraphicalItems(state),
		selectStackOffsetType(state),
		selectReverseStackOrder(state),
	)
}

function selectTooltipDomainOfStackGroups(state: ChartState): NumberDomain | undefined {
	return combineDomainOfStackGroups(
		selectTooltipStackGroups(state),
		selectChartDataWithIndexes(state),
		selectTooltipAxisType(state),
		selectTooltipDomainFromUserPreferences(state),
	)
}

function selectTooltipItemsSettingsExceptStacked(
	state: ChartState,
): ReadonlyArray<GraphicalItemSettings> {
	return filterGraphicalNotStackedItems(selectAllGraphicalItemsSettings(state))
}

function selectTooltipDomainOfAllAppliedNumericalValuesIncludingErrorValues(
	state: ChartState,
): NumberDomain | undefined {
	return combineDomainOfAllAppliedNumericalValuesIncludingErrorValues(
		selectTooltipDisplayedData(state),
		selectTooltipAxis(state),
		selectTooltipItemsSettingsExceptStacked(state),
		selectAllErrorBarSettings(state),
		selectTooltipAxisType(state),
		selectChartDataSliceWithIndexes(state),
	)
}

function selectReferenceDotsByTooltipAxis(
	state: ChartState,
): ReadonlyArray<ReferenceDotSettings> | undefined {
	return filterReferenceElements(
		selectReferenceDots(state),
		selectTooltipAxisType(state),
		selectTooltipAxisId(state),
	)
}

function selectTooltipReferenceDotsDomain(state: ChartState): NumberDomain | undefined {
	return combineDotsDomain(selectReferenceDotsByTooltipAxis(state), selectTooltipAxisType(state))
}

function selectReferenceAreasByTooltipAxis(
	state: ChartState,
): ReadonlyArray<ReferenceAreaSettings> | undefined {
	return filterReferenceElements(
		selectReferenceAreas(state),
		selectTooltipAxisType(state),
		selectTooltipAxisId(state),
	)
}

function selectTooltipReferenceAreasDomain(state: ChartState): NumberDomain | undefined {
	return combineAreasDomain(selectReferenceAreasByTooltipAxis(state), selectTooltipAxisType(state))
}

function selectReferenceLinesByTooltipAxis(
	state: ChartState,
): ReadonlyArray<ReferenceLineSettings> | undefined {
	return filterReferenceElements(
		selectReferenceLines(state),
		selectTooltipAxisType(state),
		selectTooltipAxisId(state),
	)
}

function selectTooltipReferenceLinesDomain(state: ChartState): NumberDomain | undefined {
	return combineLinesDomain(selectReferenceLinesByTooltipAxis(state), selectTooltipAxisType(state))
}

function selectTooltipReferenceElementsDomain(state: ChartState): NumberDomain | undefined {
	return mergeDomains(
		selectTooltipReferenceDotsDomain(state),
		selectTooltipReferenceLinesDomain(state),
		selectTooltipReferenceAreasDomain(state),
	)
}

function selectTooltipNumericalDomain(state: ChartState): NumberDomain | undefined {
	return combineNumericalDomain(
		selectTooltipAxis(state),
		selectTooltipAxisDomainDefinition(state),
		selectTooltipDomainFromUserPreferences(state),
		selectTooltipDomainOfStackGroups(state),
		selectTooltipDomainOfAllAppliedNumericalValuesIncludingErrorValues(state),
		selectTooltipReferenceElementsDomain(state),
		selectChartLayout(state),
		selectTooltipAxisType(state),
	)
}

export function selectTooltipAxisDomain(
	state: ChartState,
): NumberDomain | CategoricalDomain | undefined {
	return combineAxisDomain(
		selectTooltipAxis(state),
		selectChartLayout(state),
		selectTooltipDisplayedData(state),
		selectAllTooltipAppliedValues(state),
		selectStackOffsetType(state),
		selectTooltipAxisType(state),
		selectTooltipNumericalDomain(state),
	)
}

function selectTooltipNiceTicks(state: ChartState): ReadonlyArray<number> | undefined {
	return combineNiceTicks(
		selectTooltipAxisDomain(state),
		selectTooltipAxis(state),
		selectTooltipAxisRealScaleType(state),
	)
}

export function selectTooltipAxisDomainIncludingNiceTicks(
	state: ChartState,
): NumberDomain | CategoricalDomain | undefined {
	return combineAxisDomainWithNiceTicks(
		selectTooltipAxis(state),
		selectTooltipAxisDomain(state),
		selectTooltipNiceTicks(state),
		selectTooltipAxisType(state),
	)
}

const selectTooltipAxisRange = (state: ChartState): AxisRange | undefined => {
	const axisType = selectTooltipAxisType(state)
	const axisId = selectTooltipAxisId(state)
	const isPanorama = false
	return selectAxisRange(state, axisType, axisId, isPanorama)
}

export function selectTooltipAxisRangeWithReverse(state: ChartState): AxisRange | undefined {
	return combineAxisRangeWithReverse(selectTooltipAxis(state), selectTooltipAxisRange(state))
}

function selectTooltipConfiguredScale(state: ChartState): CustomScaleDefinition | undefined {
	return combineConfiguredScale(
		selectTooltipAxis(state),
		selectTooltipAxisRealScaleType(state),
		selectTooltipAxisDomainIncludingNiceTicks(state),
		selectTooltipAxisRangeWithReverse(state),
	)
}

export function selectTooltipAxisScale(state: ChartState): RechartsScale | undefined {
	return rechartsScaleFactory(selectTooltipConfiguredScale(state))
}

function selectTooltipDuplicateDomain(
	state: ChartState,
): ReadonlyArray<unknown> | undefined {
	return combineDuplicateDomain(
		selectChartLayout(state),
		selectAllTooltipAppliedValues(state),
		selectTooltipAxis(state),
		selectTooltipAxisType(state),
	)
}

export function selectTooltipCategoricalDomain(
	state: ChartState,
): ReadonlyArray<unknown> | undefined {
	return combineCategoricalDomain(
		selectChartLayout(state),
		selectAllTooltipAppliedValues(state),
		selectTooltipAxis(state),
		selectTooltipAxisType(state),
	)
}

const combineTicksOfTooltipAxis = (
	layout: LayoutType,
	axis: RenderableAxisSettings,
	realScaleType: string | undefined,
	scale: RechartsScale | undefined,
	axisRange: AxisRange | undefined,
	duplicateDomain: ReadonlyArray<unknown> | undefined,
	categoricalDomain: ReadonlyArray<unknown> | undefined,
	axisType: RenderableAxisType,
): ReadonlyArray<TickItem> | undefined => {
	if (!axis) {
		return undefined
	}
	const { type } = axis

	const isCategorical = isCategoricalAxis(layout, axisType)

	if (!scale) {
		return undefined
	}

	const offsetForBand = realScaleType === "scaleBand" && scale.bandwidth ? scale.bandwidth() / 2 : 2
	let offset = type === "category" && scale.bandwidth ? scale.bandwidth() / offsetForBand : 0

	offset =
		axisType === "angleAxis" && axisRange != null && axisRange?.length >= 2
			? mathSign(axisRange[0] - axisRange[1]) * 2 * offset
			: offset

	if (isCategorical && categoricalDomain) {
		return categoricalDomain
			.map((entry: unknown, index: number): TickItem | null => {
				const scaled = scale.map(entry)
				if (!isWellBehavedNumber(scaled)) {
					return null
				}
				return {
					coordinate: scaled + offset,
					index,
					offset,
					value: entry,
				}
			})
			.filter(isNotNil)
	}

	return scale
		.domain()
		.map((entry: CategoricalDomainItem, index: number): TickItem | null => {
			const scaled = scale.map(entry)
			if (!isWellBehavedNumber(scaled)) {
				return null
			}
			return {
				coordinate: scaled + offset,
				index,
				offset,
				value: duplicateDomain ? duplicateDomain[entry as unknown as number] : entry,
			}
		})
		.filter(isNotNil)
}

/**
 * Of on four almost identical implementations of tick generation.
 * The four horsemen of tick generation are:
 * - {@link selectTooltipAxisTicks}
 * - {@link combineAxisTicks}
 * - {@link getTicksOfAxis}.
 * - {@link combineGraphicalItemTicks}
 */
export function selectTooltipAxisTicks(
	state: ChartState,
): ReadonlyArray<TickItem> | undefined {
	return combineTicksOfTooltipAxis(
		selectChartLayout(state),
		selectTooltipAxis(state),
		selectTooltipAxisRealScaleType(state),
		selectTooltipAxisScale(state),
		selectTooltipAxisRange(state),
		selectTooltipDuplicateDomain(state),
		selectTooltipCategoricalDomain(state),
		selectTooltipAxisType(state),
	)
}

function selectTooltipEventType(state: ChartState): TooltipEventType | undefined {
	const defaultTooltipEventType = selectDefaultTooltipEventType(state)
	const validateTooltipEventType = selectValidateTooltipEventTypes(state)
	const settings: TooltipSettingsState = selectTooltipSettings(state)
	return combineTooltipEventType(settings.shared, defaultTooltipEventType, validateTooltipEventType)
}

const selectTooltipTrigger = (state: ChartState) => {
	return readChartState(state).tooltip.settings.trigger
}

const selectDefaultIndex = (state: ChartState): TooltipIndex | undefined => {
	const raw = readChartState(state).tooltip.settings.defaultIndex
	if (typeof raw === "number") return String(raw)
	return raw
}

function selectTooltipInteractionState(
	state: ChartState,
): TooltipInteractionState | undefined {
	return combineTooltipInteractionState(
		selectTooltipState(state),
		selectTooltipEventType(state),
		selectTooltipTrigger(state),
		selectDefaultIndex(state),
	)
}

export function selectActiveTooltipIndex(state: ChartState): TooltipIndex | null {
	return combineActiveTooltipIndex(
		selectTooltipInteractionState(state),
		selectTooltipDisplayedData(state),
		selectTooltipAxisDataKey(state),
		selectTooltipAxisDomain(state),
	)
}

export function selectActiveLabel(state: ChartState): ActiveLabel {
	return combineActiveLabel(selectTooltipAxisTicks(state), selectActiveTooltipIndex(state))
}

export function selectActiveTooltipDataKey(state: ChartState): DataKey<unknown> | undefined {
	const tooltipInteraction = selectTooltipInteractionState(state)
	if (!tooltipInteraction) {
		return undefined
	}
	return tooltipInteraction.dataKey
}

export function selectActiveTooltipGraphicalItemId(state: ChartState): string | undefined {
	const tooltipInteraction = selectTooltipInteractionState(state)
	if (!tooltipInteraction) {
		return undefined
	}
	return tooltipInteraction.graphicalItemId
}

function selectTooltipPayloadConfigurations(state: ChartState) {
	return combineTooltipPayloadConfigurations(
		selectTooltipState(state),
		selectTooltipEventType(state),
		selectTooltipTrigger(state),
		selectDefaultIndex(state),
	)
}

function selectTooltipCoordinateForDefaultIndex(state: ChartState): Coordinate | undefined {
	return combineCoordinateForDefaultIndex(
		selectChartWidth(state),
		selectChartHeight(state),
		selectChartLayout(state),
		selectChartOffsetInternal(state),
		selectTooltipAxisTicks(state),
		selectDefaultIndex(state),
		selectTooltipPayloadConfigurations(state),
	)
}

export function selectActiveTooltipCoordinate(state: ChartState): Coordinate | undefined {
	const tooltipInteractionState = selectTooltipInteractionState(state)
	const defaultIndexCoordinate = selectTooltipCoordinateForDefaultIndex(state)
	if (tooltipInteractionState?.coordinate) {
		return tooltipInteractionState.coordinate
	}
	return defaultIndexCoordinate
}

export function selectIsTooltipActive(state: ChartState): boolean {
	const tooltipInteractionState = selectTooltipInteractionState(state)
	return tooltipInteractionState?.active ?? false
}

export function selectActiveTooltipPayload(state: ChartState): TooltipPayload | undefined {
	return combineTooltipPayload(
		selectTooltipPayloadConfigurations(state),
		selectActiveTooltipIndex(state),
		selectChartDataWithIndexes(state),
		selectTooltipAxisDataKey(state),
		selectActiveLabel(state),
		selectTooltipPayloadSearcher(state),
		selectTooltipEventType(state),
	)
}

export function selectActiveTooltipDataPoints(state: ChartState) {
	const payload = selectActiveTooltipPayload(state)
	if (payload == null) {
		return undefined
	}
	const dataPoints = payload.map((p) => p.payload).filter((p) => p != null)
	return Array.from(new Set(dataPoints))
}
