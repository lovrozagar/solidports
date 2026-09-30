/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import type { AngleAxisForRadar, RadarComposedData, RadiusAxisForRadar } from "../../polar/Radar"
import { computeRadarPoints } from "../../polar/Radar"
import type { BaseAxisWithScale } from "./axisSelectors"
import { selectHasBar } from "./axisSelectors"
import { selectPolarAxisScale, selectPolarAxisTicks } from "./polarScaleSelectors"
import { selectAngleAxis, selectAngleAxisRangeWithReversed, selectPolarViewBox, selectRadiusAxis } from "./polarAxisSelectors"
import type { AxisId } from "../cartesianAxisSlice"
import { selectChartDataAndAlwaysIgnoreIndexes } from "./dataSelectors"
import type { ChartDataState } from "../chartDataSlice"
import type { CategoricalDomain, DataKey, LayoutType, PolarViewBoxRequired, TickItem } from "../../util/types"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { getBandSizeOfAxis, isCategoricalAxis } from "../../util/ChartUtils"
import type { AngleAxisSettings } from "../polarAxisSlice"
import { selectUnfilteredPolarItems, selectPolarAxisCheckedDomain } from "./polarSelectors"
import type { GraphicalItemId } from "../graphicalItemsSlice"
import { type RechartsScale, rechartsScaleFactory } from "../../util/scale/RechartsScale"
import { combineConfiguredScale } from "./combiners/combineConfiguredScale"
import { combineRealScaleType } from "./combiners/combineRealScaleType"
import { selectChartName } from "./rootPropsSelectors"

const selectRadiusAxisScale = (
	state: RechartsRootState,
	radiusAxisId: AxisId,
): RechartsScale | undefined => selectPolarAxisScale(state, "radiusAxis", radiusAxisId)

function selectRadiusAxisForRadar(
	state: RechartsRootState,
	radiusAxisId: AxisId,
): RadiusAxisForRadar | undefined {
	const scale = selectRadiusAxisScale(state, radiusAxisId)
	if (scale == null) {
		return undefined
	}
	return { scale }
}

export function selectRadiusAxisForBandSize(
	state: RechartsRootState,
	radiusAxisId: AxisId,
): BaseAxisWithScale | undefined {
	const axisSettings = selectRadiusAxis(state, radiusAxisId)
	const scale = selectRadiusAxisScale(state, radiusAxisId)
	if (axisSettings == null || scale == null) {
		return undefined
	}
	return {
		...axisSettings,
		scale,
	}
}

const selectRadiusAxisTicks = (
	state: RechartsRootState,
	radiusAxisId: AxisId,
	_angleAxisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<TickItem> | undefined => {
	return selectPolarAxisTicks(state, "radiusAxis", radiusAxisId, isPanorama)
}

const selectAngleAxisForRadar = (
	state: RechartsRootState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): AngleAxisSettings => selectAngleAxis(state, angleAxisId)

const selectPolarAxisScaleForRadar = (
	state: RechartsRootState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): RechartsScale | undefined => selectPolarAxisScale(state, "angleAxis", angleAxisId)

export function selectAngleAxisForBandSize(
	state: RechartsRootState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): BaseAxisWithScale | undefined {
	const axisSettings = selectAngleAxisForRadar(state, _radiusAxisId, angleAxisId)
	const scale = selectPolarAxisScaleForRadar(state, _radiusAxisId, angleAxisId)
	if (axisSettings == null || scale == null) {
		return undefined
	}
	return {
		...axisSettings,
		scale,
	}
}

const selectAngleAxisTicks = (
	state: RechartsRootState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<TickItem> | undefined => {
	return selectPolarAxisTicks(state, "angleAxis", angleAxisId, isPanorama)
}

export function selectAngleAxisWithScaleAndViewport(
	state: RechartsRootState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): AngleAxisForRadar | undefined {
	const axisOptions = selectAngleAxisForRadar(state, _radiusAxisId, angleAxisId)
	const scale = selectPolarAxisScaleForRadar(state, _radiusAxisId, angleAxisId)
	const polarViewBox: PolarViewBoxRequired | undefined = selectPolarViewBox(state)

	if (polarViewBox == null || scale == null) {
		return undefined
	}
	return {
		cx: polarViewBox.cx,
		cy: polarViewBox.cy,
		dataKey: axisOptions.dataKey,
		scale,
		type: axisOptions.type,
	}
}

function selectAngleAxisWithScaleAndViewportWithOverride(
	state: RechartsRootState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
	override: AngleAxisSettings,
): AngleAxisForRadar | undefined {
	const polarViewBox: PolarViewBoxRequired | undefined = selectPolarViewBox(state)
	if (polarViewBox == null) {
		return undefined
	}
	const axisRange = selectAngleAxisRangeWithReversed(state, angleAxisId)
	if (axisRange == null) {
		return undefined
	}
	/* When override has an explicit domain use it directly so mutations that set a
	   numerical domain on a categorical axis actually change the scale — bypassing
	   the data-derived categorical domain that would otherwise override it. */
	const axisDomain = override.domain != null
		? (override.domain as unknown as CategoricalDomain)
		: selectPolarAxisCheckedDomain(state, "angleAxis", angleAxisId)
	if (axisDomain == null) {
		return undefined
	}
	const realScaleType = combineRealScaleType(override, selectHasBar(state), selectChartName(state))
	const scale: RechartsScale | undefined = rechartsScaleFactory(
		combineConfiguredScale(override, realScaleType, axisDomain, axisRange),
	)
	if (scale == null) {
		return undefined
	}
	return {
		cx: polarViewBox.cx,
		cy: polarViewBox.cy,
		dataKey: override.dataKey,
		scale,
		type: override.type,
	}
}

function selectBandSizeOfAxis(
	state: RechartsRootState,
	radiusAxisId: AxisId,
	angleAxisId: AxisId,
	isPanorama: boolean,
): number | undefined {
	const layout: LayoutType = selectChartLayout(state)
	const radiusAxis = selectRadiusAxisForBandSize(state, radiusAxisId)
	const radiusAxisTicks = selectRadiusAxisTicks(state, radiusAxisId, angleAxisId, isPanorama)
	const angleAxis = selectAngleAxisForBandSize(state, radiusAxisId, angleAxisId)
	const angleAxisTicks = selectAngleAxisTicks(state, radiusAxisId, angleAxisId, isPanorama)

	if (isCategoricalAxis(layout, "radiusAxis")) {
		return getBandSizeOfAxis(radiusAxis, radiusAxisTicks, false)
	}
	return getBandSizeOfAxis(angleAxis, angleAxisTicks, false)
}

function selectSynchronisedRadarDataKey(
	state: RechartsRootState,
	radarId: GraphicalItemId,
): DataKey<unknown> | undefined {
	const graphicalItems = selectUnfilteredPolarItems(state)
	if (graphicalItems == null) {
		return undefined
	}
	const pgis = graphicalItems.find((item) => item.type === "radar" && radarId === item.id)
	return pgis?.dataKey
}

export function selectRadarPoints(
	state: RechartsRootState,
	radiusAxisId: AxisId,
	angleAxisId: AxisId,
	isPanorama: boolean,
	radarId: GraphicalItemId,
	angleAxisOverride?: AngleAxisSettings,
): RadarComposedData | undefined {
	const radiusAxis = selectRadiusAxisForRadar(state, radiusAxisId)
	const angleAxis = angleAxisOverride != null
		? selectAngleAxisWithScaleAndViewportWithOverride(state, radiusAxisId, angleAxisId, angleAxisOverride)
		: selectAngleAxisWithScaleAndViewport(state, radiusAxisId, angleAxisId)
	const { chartData, dataStartIndex, dataEndIndex }: ChartDataState =
		selectChartDataAndAlwaysIgnoreIndexes(state)
	const dataKey = selectSynchronisedRadarDataKey(state, radarId)
	const bandSize = selectBandSizeOfAxis(state, radiusAxisId, angleAxisId, isPanorama)

	if (
		radiusAxis == null ||
		angleAxis == null ||
		chartData == null ||
		bandSize == null ||
		dataKey == null
	) {
		return undefined
	}
	const displayedData = chartData.slice(dataStartIndex, dataEndIndex + 1)
	return computeRadarPoints({
		angleAxis,
		bandSize,
		dataKey,
		displayedData,
		radiusAxis,
	})
}
