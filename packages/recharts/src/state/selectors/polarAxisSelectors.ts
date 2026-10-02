/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { AxisId } from "../cartesianAxisSlice"
import type { AngleAxisSettings, RadiusAxisSettings } from "../polarAxisSlice"
import type { PolarChartOptions } from "../polarOptionsSlice"
import { selectChartHeight, selectChartWidth } from "./containerSelectors"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { getMaxRadius } from "../../util/PolarUtils"
import { getPercentValue } from "../../util/DataUtils"
import type { AxisDomainTypeInput, LayoutType, PolarViewBoxRequired } from "../../util/types"
import { defaultPolarAngleAxisProps } from "../../polar/defaultPolarAngleAxisProps"
import { defaultPolarRadiusAxisProps } from "../../polar/defaultPolarRadiusAxisProps"
import type { AxisRange } from "./axisSelectors"
import { combineAxisRangeWithReverse } from "./combiners/combineAxisRangeWithReverse"
import { selectChartLayout, selectPolarChartLayout } from "../../context/chartLayoutContext"
import { getAxisTypeBasedOnLayout } from "../../util/getAxisTypeBasedOnLayout"
import { readChartState } from "../chartState"

export const implicitAngleAxis: Omit<AngleAxisSettings, "type"> & { type: AxisDomainTypeInput } = {
	allowDataOverflow: defaultPolarAngleAxisProps.allowDataOverflow,
	allowDecimals: defaultPolarAngleAxisProps.allowDecimals,
	allowDuplicatedCategory: false,
	dataKey: undefined,
	domain: undefined,
	id: defaultPolarAngleAxisProps.angleAxisId,
	includeHidden: false,
	name: undefined,
	niceTicks: defaultPolarAngleAxisProps.niceTicks,
	reversed: defaultPolarAngleAxisProps.reversed,
	scale: defaultPolarAngleAxisProps.scale,
	tick: defaultPolarAngleAxisProps.tick,
	tickCount: undefined,
	ticks: undefined,
	type: defaultPolarAngleAxisProps.type,
	unit: undefined,
}

export const implicitRadiusAxis: Omit<RadiusAxisSettings, "type"> & { type: AxisDomainTypeInput } =
	{
		allowDataOverflow: defaultPolarRadiusAxisProps.allowDataOverflow,
		allowDecimals: defaultPolarRadiusAxisProps.allowDecimals,
		allowDuplicatedCategory: defaultPolarRadiusAxisProps.allowDuplicatedCategory,
		dataKey: undefined,
		domain: undefined,
		id: defaultPolarRadiusAxisProps.radiusAxisId,
		includeHidden: defaultPolarRadiusAxisProps.includeHidden,
		name: undefined,
		niceTicks: defaultPolarRadiusAxisProps.niceTicks,
		reversed: defaultPolarRadiusAxisProps.reversed,
		scale: defaultPolarRadiusAxisProps.scale,
		tick: defaultPolarRadiusAxisProps.tick,
		tickCount: defaultPolarRadiusAxisProps.tickCount,
		ticks: undefined,
		type: defaultPolarRadiusAxisProps.type,
		unit: undefined,
	}

const selectAngleAxisNoDefaults = (
	state: ChartState,
	angleAxisId: AxisId | undefined,
): AngleAxisSettings | undefined => {
	if (angleAxisId == null) {
		return undefined
	}
	return readChartState(state).polarAxes.angleAxis?.[String(angleAxisId)]?.settings
}

export function selectAngleAxis(
	state: ChartState,
	angleAxisId: AxisId | undefined,
	override?: AngleAxisSettings,
): AngleAxisSettings {
	if (override != null) {
		return override
	}
	const angleAxisSettings = selectAngleAxisNoDefaults(state, angleAxisId)
	const layout = selectPolarChartLayout(state)
	if (angleAxisSettings != null) {
		return angleAxisSettings
	}
	const evaluatedType =
		getAxisTypeBasedOnLayout(layout, "angleAxis", implicitAngleAxis.type) ?? "category"
	return {
		...implicitAngleAxis,
		type: evaluatedType,
	}
}

const selectRadiusAxisNoDefaults = (
	state: ChartState,
	radiusAxisId: AxisId,
): RadiusAxisSettings | undefined => {
	return readChartState(state).polarAxes.radiusAxis?.[String(radiusAxisId)]?.settings
}

export function selectRadiusAxis(
	state: ChartState,
	radiusAxisId: AxisId,
	override?: RadiusAxisSettings,
): RadiusAxisSettings {
	if (override != null) {
		return override
	}
	const radiusAxisSettings = selectRadiusAxisNoDefaults(state, radiusAxisId)
	const layout = selectPolarChartLayout(state)
	if (radiusAxisSettings != null) {
		return radiusAxisSettings
	}
	const evaluatedType =
		getAxisTypeBasedOnLayout(layout, "radiusAxis", implicitRadiusAxis.type) ?? "category"
	return {
		...implicitRadiusAxis,
		type: evaluatedType,
	}
}

export const selectPolarOptions = (state: ChartState): PolarChartOptions | null =>
	state.polarOptions

export function selectMaxRadius(state: ChartState): number {
	return getMaxRadius(
		selectChartWidth(state),
		selectChartHeight(state),
		selectChartOffsetInternal(state),
	)
}

function selectInnerRadius(state: ChartState): number | undefined {
	const polarChartOptions = selectPolarOptions(state)
	const maxRadius = selectMaxRadius(state)
	if (polarChartOptions == null) {
		return undefined
	}
	return getPercentValue(polarChartOptions.innerRadius, maxRadius, 0)
}

export function selectOuterRadius(state: ChartState): number | undefined {
	const polarChartOptions = selectPolarOptions(state)
	const maxRadius = selectMaxRadius(state)
	if (polarChartOptions == null) {
		return undefined
	}
	return getPercentValue(polarChartOptions.outerRadius, maxRadius, maxRadius * 0.8)
}

const combineAngleAxisRange = (polarOptions: PolarChartOptions | null): AxisRange => {
	if (polarOptions == null) {
		return [0, 0]
	}
	const { startAngle, endAngle } = polarOptions
	return [startAngle, endAngle]
}

export function selectAngleAxisRange(state: ChartState): AxisRange {
	return combineAngleAxisRange(selectPolarOptions(state))
}

export function selectAngleAxisRangeWithReversed(
	state: ChartState,
	angleAxisId: AxisId,
): AxisRange | undefined {
	return combineAxisRangeWithReverse(
		selectAngleAxis(state, angleAxisId),
		selectAngleAxisRange(state),
	)
}

export function selectRadiusAxisRange(
	state: ChartState,
	_radiusAxisId: AxisId,
): AxisRange | undefined {
	const maxRadius = selectMaxRadius(state)
	const innerRadius = selectInnerRadius(state)
	const outerRadius = selectOuterRadius(state)
	if (maxRadius == null || innerRadius == null || outerRadius == null) {
		return undefined
	}
	return [innerRadius, outerRadius]
}

export function selectRadiusAxisRangeWithReversed(
	state: ChartState,
	radiusAxisId: AxisId,
): AxisRange | undefined {
	return combineAxisRangeWithReverse(
		selectRadiusAxis(state, radiusAxisId),
		selectRadiusAxisRange(state, radiusAxisId),
	)
}

export function selectPolarViewBox(state: ChartState): PolarViewBoxRequired | undefined {
	const layout: LayoutType = selectChartLayout(state)
	const polarOptions = selectPolarOptions(state)
	const innerRadius = selectInnerRadius(state)
	const outerRadius = selectOuterRadius(state)
	const width = selectChartWidth(state)
	const height = selectChartHeight(state)

	if (
		(layout !== "centric" && layout !== "radial") ||
		polarOptions == null ||
		innerRadius == null ||
		outerRadius == null
	) {
		return undefined
	}
	const { cx, cy, startAngle, endAngle } = polarOptions
	return {
		clockWise: false,
		cx: getPercentValue(cx, width, width / 2),
		cy: getPercentValue(cy, height, height / 2),
		endAngle,
		innerRadius,
		outerRadius,
		startAngle,
	}
}
