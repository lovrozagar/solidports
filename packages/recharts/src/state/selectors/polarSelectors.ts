/* eslint-disable import/no-cycle */
import type { AppliedChartData, ChartData } from "../chartDataSlice"
import type { ChartState } from "../store"
import type { AxisId, BaseCartesianAxis } from "../cartesianAxisSlice"
import { selectChartDataAndAlwaysIgnoreIndexes } from "./dataSelectors"
import {
	type AppliedChartDataWithErrorDomain,
	combineAppliedValues,
	combineAxisDomain,
	combineAxisDomainWithNiceTicks,
	combineDisplayedData,
	combineDomainOfAllAppliedNumericalValuesIncludingErrorValues,
	combineGraphicalItemsData,
	combineGraphicalItemsSettings,
	combineNiceTicks,
	combineNumericalDomain,
	itemAxisPredicate,
	selectAllErrorBarSettings,
	selectBaseAxis,
	selectDomainDefinition,
	selectDomainFromUserPreference,
	selectRealScaleType,
	selectRenderableAxisSettings,
} from "./axisSelectors"
import type { PolarGraphicalItemSettings } from "../graphicalItemsSlice"
import type { PolarItemState } from "../chartState"
import { readChartState } from "../chartState"
import type { CategoricalDomain, NumberDomain } from "../../util/types"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { getValueByDataKey } from "../../util/ChartUtils"
import { selectStackOffsetType } from "./rootPropsSelectors"
import { combineCheckedDomain } from "./combiners/combineCheckedDomain"

export type PolarAxisType = "angleAxis" | "radiusAxis"

export const selectUnfilteredPolarItems = (
	state: ChartState,
): ReadonlyArray<PolarGraphicalItemSettings> => {
	return Object.values(readChartState(state).graphicalItems)
		.filter(
			(item): item is PolarItemState =>
				item != null &&
				typeof item === "object" &&
				"type" in item &&
				(item.type === "pie" || item.type === "radar" || item.type === "radialBar"),
		)
		.filter((item) => item.settings !== null && typeof item.settings === "object")
		.map((item) => item.settings)
}

export function selectPolarItemsSettings(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ReadonlyArray<PolarGraphicalItemSettings> {
	const graphicalItems = selectUnfilteredPolarItems(state)
	const axisSettings = selectBaseAxis(state, axisType, polarAxisId)
	const axisPredicate = itemAxisPredicate(axisType, polarAxisId)
	return combineGraphicalItemsSettings(graphicalItems, axisSettings, axisPredicate)
}

function selectPolarGraphicalItemsData(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ChartData {
	return combineGraphicalItemsData(selectPolarItemsSettings(state, axisType, polarAxisId))
}

export function selectPolarDisplayedData(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ChartData {
	return combineDisplayedData(
		selectPolarGraphicalItemsData(state, axisType, polarAxisId),
		selectChartDataAndAlwaysIgnoreIndexes(state),
	)
}

export function selectPolarAppliedValues(
	state: ChartState,
	axisType: PolarAxisType,
	axisId: AxisId,
): AppliedChartData {
	return combineAppliedValues(
		selectPolarDisplayedData(state, axisType, axisId),
		selectBaseAxis(state, axisType, axisId),
		selectPolarItemsSettings(state, axisType, axisId),
	)
}

export function selectAllPolarAppliedNumericalValues(
	state: ChartState,
	axisType: PolarAxisType,
	axisId: AxisId,
): ReadonlyArray<AppliedChartDataWithErrorDomain> {
	const data = selectPolarDisplayedData(state, axisType, axisId)
	const axisSettings: BaseCartesianAxis = selectBaseAxis(state, axisType, axisId)
	const items = selectPolarItemsSettings(state, axisType, axisId)

	if (items.length > 0) {
		return data
			.flatMap((entry) => {
				return items.flatMap((item): AppliedChartDataWithErrorDomain | undefined => {
					const valueByDataKey: unknown = getValueByDataKey(
						entry,
						axisSettings.dataKey ?? item.dataKey,
					)
					return {
						errorDomain: [],
						value: valueByDataKey,
					}
				})
			})
			.filter(Boolean) as ReadonlyArray<AppliedChartDataWithErrorDomain>
	}
	if (axisSettings?.dataKey != null) {
		return data.map(
			(item): AppliedChartDataWithErrorDomain => ({
				errorDomain: [],
				value: getValueByDataKey(item, axisSettings.dataKey),
			}),
		)
	}
	return data.map((entry): AppliedChartDataWithErrorDomain => ({ errorDomain: [], value: entry }))
}

const unsupportedInPolarChart = (): undefined => undefined

function selectDomainOfAllPolarAppliedNumericalValues(
	state: ChartState,
	axisType: PolarAxisType,
	axisId: AxisId,
): NumberDomain | undefined {
	return combineDomainOfAllAppliedNumericalValuesIncludingErrorValues(
		selectPolarDisplayedData(state, axisType, axisId),
		selectBaseAxis(state, axisType, axisId),
		selectPolarItemsSettings(state, axisType, axisId),
		selectAllErrorBarSettings(state),
		axisType,
	)
}

function selectPolarNumericalDomain(
	state: ChartState,
	axisType: PolarAxisType,
	axisId: AxisId,
): NumberDomain | undefined {
	return combineNumericalDomain(
		selectBaseAxis(state, axisType, axisId),
		selectDomainDefinition(state, axisType, axisId),
		selectDomainFromUserPreference(state, axisType, axisId),
		unsupportedInPolarChart(),
		selectDomainOfAllPolarAppliedNumericalValues(state, axisType, axisId),
		unsupportedInPolarChart(),
		selectChartLayout(state),
		axisType,
	)
}

export function selectPolarAxisDomain(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): NumberDomain | CategoricalDomain | undefined {
	return combineAxisDomain(
		selectBaseAxis(state, axisType, polarAxisId),
		selectChartLayout(state),
		selectPolarDisplayedData(state, axisType, polarAxisId),
		selectPolarAppliedValues(state, axisType, polarAxisId),
		selectStackOffsetType(state),
		axisType,
		selectPolarNumericalDomain(state, axisType, polarAxisId),
	)
}

export function selectPolarNiceTicks(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ReadonlyArray<number> | undefined {
	return combineNiceTicks(
		selectPolarAxisDomain(state, axisType, polarAxisId),
		selectRenderableAxisSettings(state, axisType, polarAxisId),
		selectRealScaleType(state, axisType, polarAxisId),
	)
}

export function selectPolarAxisDomainIncludingNiceTicks(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): NumberDomain | CategoricalDomain | undefined {
	return combineAxisDomainWithNiceTicks(
		selectBaseAxis(state, axisType, polarAxisId),
		selectPolarAxisDomain(state, axisType, polarAxisId),
		selectPolarNiceTicks(state, axisType, polarAxisId),
		axisType,
	)
}

export function selectPolarAxisCheckedDomain(
	state: ChartState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): NumberDomain | CategoricalDomain | undefined {
	return combineCheckedDomain(
		selectRealScaleType(state, axisType, polarAxisId),
		selectPolarAxisDomainIncludingNiceTicks(state, axisType, polarAxisId),
	)
}
