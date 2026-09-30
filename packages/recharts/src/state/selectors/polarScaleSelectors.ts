/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import type { AxisId } from "../cartesianAxisSlice"
import {
	combineAxisTicks,
	combineCategoricalDomain,
	combineGraphicalItemTicks,
	selectDuplicateDomain,
	selectRealScaleType,
	selectRenderableAxisSettings,
} from "./axisSelectors"
import {
	selectAngleAxis,
	selectAngleAxisRangeWithReversed,
	selectRadiusAxis,
	selectRadiusAxisRangeWithReversed,
} from "./polarAxisSelectors"
import type { CartesianTickItem } from "../../util/types"
import { selectChartLayout } from "../../context/chartLayoutContext"
import {
	selectPolarAppliedValues,
	selectPolarAxisCheckedDomain,
	selectPolarNiceTicks,
} from "./polarSelectors"
import { type RechartsScale, rechartsScaleFactory } from "../../util/scale/RechartsScale"
import type { CustomScaleDefinition } from "../../util/scale/CustomScaleDefinition"
import { combineConfiguredScale } from "./combiners/combineConfiguredScale"

export const selectPolarAxis = (
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	axisId: AxisId,
) => {
	switch (axisType) {
		case "angleAxis": {
			return selectAngleAxis(state, axisId)
		}
		case "radiusAxis": {
			return selectRadiusAxis(state, axisId)
		}
		default: {
			throw new Error(`Unexpected axis type: ${axisType}`)
		}
	}
}

const selectPolarAxisRangeWithReversed = (
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	axisId: AxisId,
) => {
	switch (axisType) {
		case "angleAxis": {
			return selectAngleAxisRangeWithReversed(state, axisId)
		}
		case "radiusAxis": {
			return selectRadiusAxisRangeWithReversed(state, axisId)
		}
		default: {
			throw new Error(`Unexpected axis type: ${axisType}`)
		}
	}
}

function selectPolarConfiguredScale(
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	polarAxisId: AxisId,
): CustomScaleDefinition | undefined {
	return combineConfiguredScale(
		selectPolarAxis(state, axisType, polarAxisId),
		selectRealScaleType(state, axisType, polarAxisId),
		selectPolarAxisCheckedDomain(state, axisType, polarAxisId),
		selectPolarAxisRangeWithReversed(state, axisType, polarAxisId),
	)
}

export function selectPolarAxisScale(
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	polarAxisId: AxisId,
): RechartsScale | undefined {
	return rechartsScaleFactory(selectPolarConfiguredScale(state, axisType, polarAxisId))
}

export function selectPolarCategoricalDomain(
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	polarAxisId: AxisId,
): ReadonlyArray<unknown> | undefined {
	return combineCategoricalDomain(
		selectChartLayout(state),
		selectPolarAppliedValues(state, axisType, polarAxisId),
		selectRenderableAxisSettings(state, axisType, polarAxisId),
		axisType,
	)
}

export function selectPolarAxisTicks(
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	polarAxisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<CartesianTickItem> | undefined {
	return combineAxisTicks(
		selectChartLayout(state),
		selectPolarAxis(state, axisType, polarAxisId),
		selectRealScaleType(state, axisType, polarAxisId),
		selectPolarAxisScale(state, axisType, polarAxisId),
		selectPolarNiceTicks(state, axisType, polarAxisId),
		selectPolarAxisRangeWithReversed(state, axisType, polarAxisId),
		selectDuplicateDomain(state, axisType, polarAxisId, isPanorama),
		selectPolarCategoricalDomain(state, axisType, polarAxisId),
		axisType,
	)
}

export function selectPolarAngleAxisTicks(
	state: RechartsRootState,
	axisType: "angleAxis",
	polarAxisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<CartesianTickItem> | undefined {
	const ticks = selectPolarAxisTicks(state, axisType, polarAxisId, isPanorama)
	/*
	 * Angle axis is circular; so here we need to look for ticks that overlap (i.e., 0 and 360 degrees)
	 * and remove the duplicate tick to avoid rendering issues.
	 */
	if (!ticks) {
		return undefined
	}

	const uniqueTicksMap = new Map<number, CartesianTickItem>()
	ticks.forEach((tick) => {
		const normalizedCoordinate = (tick.coordinate + 360) % 360
		if (!uniqueTicksMap.has(normalizedCoordinate)) {
			uniqueTicksMap.set(normalizedCoordinate, tick)
		}
	})

	return Array.from(uniqueTicksMap.values())
}

export function selectPolarGraphicalItemAxisTicks(
	state: RechartsRootState,
	axisType: "angleAxis" | "radiusAxis",
	polarAxisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<CartesianTickItem> | undefined {
	return combineGraphicalItemTicks(
		selectChartLayout(state),
		selectPolarAxis(state, axisType, polarAxisId),
		selectPolarAxisScale(state, axisType, polarAxisId),
		selectPolarAxisRangeWithReversed(state, axisType, polarAxisId),
		selectDuplicateDomain(state, axisType, polarAxisId, isPanorama),
		selectPolarCategoricalDomain(state, axisType, polarAxisId),
		axisType,
	)
}
