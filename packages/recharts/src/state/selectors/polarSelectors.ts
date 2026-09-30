/* eslint-disable import/no-cycle */
import type { AppliedChartData, ChartData } from "../chartDataSlice"
import type { RechartsRootState } from "../store"
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
import type { PolarItemState } from "../_solid/chartState"
import type { CategoricalDomain, NumberDomain } from "../../util/types"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { getValueByDataKey } from "../../util/ChartUtils"
import { selectStackOffsetType } from "./rootPropsSelectors"
import { combineCheckedDomain } from "./combiners/combineCheckedDomain"

export type PolarAxisType = "angleAxis" | "radiusAxis"

export const selectUnfilteredPolarItems = (
	state: RechartsRootState,
): ReadonlyArray<PolarGraphicalItemSettings> => {
	const solidItems = (state._solid as Partial<typeof state._solid>).graphicalItems
	if (solidItems != null) {
		return Object.values(solidItems)
			.filter(
				(item): item is PolarItemState =>
					item.type === "pie" || item.type === "radar" || item.type === "radialBar",
			)
			.filter((item) => item.settings !== null && typeof item.settings === "object")
			.map((item) => item.settings)
	}
	/* Legacy compat shim */
	return state.graphicalItems.polarItems
}

export function selectPolarItemsSettings(
	state: RechartsRootState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ReadonlyArray<PolarGraphicalItemSettings> {
	const graphicalItems = selectUnfilteredPolarItems(state)
	const axisSettings = selectBaseAxis(state, axisType, polarAxisId)
	const axisPredicate = itemAxisPredicate(axisType, polarAxisId)
	return combineGraphicalItemsSettings(graphicalItems, axisSettings, axisPredicate)
}

function selectPolarGraphicalItemsData(
	state: RechartsRootState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ChartData {
	return combineGraphicalItemsData(selectPolarItemsSettings(state, axisType, polarAxisId))
}

export function selectPolarDisplayedData(
	state: RechartsRootState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): ChartData {
	return combineDisplayedData(
		selectPolarGraphicalItemsData(state, axisType, polarAxisId),
		selectChartDataAndAlwaysIgnoreIndexes(state),
	)
}

export function selectPolarAppliedValues(
	state: RechartsRootState,
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
	state: RechartsRootState,
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
	state: RechartsRootState,
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
	state: RechartsRootState,
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
	state: RechartsRootState,
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
	state: RechartsRootState,
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
	state: RechartsRootState,
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
	state: RechartsRootState,
	axisType: PolarAxisType,
	polarAxisId: AxisId,
): NumberDomain | CategoricalDomain | undefined {
	return combineCheckedDomain(
		selectRealScaleType(state, axisType, polarAxisId),
		selectPolarAxisDomainIncludingNiceTicks(state, axisType, polarAxisId),
	)
}
