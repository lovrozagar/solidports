/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { computeRadialBarDataItems, type RadialBarDataItem } from "../../polar/RadialBar"
import { selectChartDataAndAlwaysIgnoreIndexes, selectChartDataWithIndexes } from "./dataSelectors"
import type { ChartState } from "../store"
import type { ChartDataState } from "../chartDataSlice"
import type { AxisId } from "../cartesianAxisSlice"
import type { CategoricalDomain, LayoutType, LegendType, TickItem } from "../../util/types"
import {
	selectPolarAxisScale,
	selectPolarAxisTicks,
	selectPolarGraphicalItemAxisTicks,
} from "./polarScaleSelectors"
import { type BaseAxisWithScale, combineStackGroups, selectHasBar, selectTooltipAxis } from "./axisSelectors"
import {
	selectAngleAxis,
	selectAngleAxisRangeWithReversed,
	selectPolarViewBox,
	selectRadiusAxis,
	selectRadiusAxisRangeWithReversed,
} from "./polarAxisSelectors"
import { selectPolarAxisCheckedDomain } from "./polarSelectors"
import { rechartsScaleFactory } from "../../util/scale/RechartsScale"
import { combineConfiguredScale } from "./combiners/combineConfiguredScale"
import { combineRealScaleType } from "./combiners/combineRealScaleType"
import { selectChartName } from "./rootPropsSelectors"
import { selectChartLayout } from "../../context/chartLayoutContext"
import {
	type BarPositionPosition,
	getBandSizeOfAxis,
	getBaseValueOfBar,
	isCategoricalAxis,
} from "../../util/ChartUtils"
import type { BarWithPosition, SizeList } from "./barSelectors"
import {
	selectBarCategoryGap,
	selectBarGap,
	selectReverseStackOrder,
	selectRootBarSize,
	selectRootMaxBarSize,
	selectStackOffsetType,
} from "./rootPropsSelectors"
import type { PolarGraphicalItemSettings } from "../graphicalItemsSlice"
import {
	type PolarAxisType,
	selectPolarItemsSettings,
	selectUnfilteredPolarItems,
} from "./polarSelectors"
import type { AngleAxisSettings, RadiusAxisSettings } from "../polarAxisSlice"
import type { LegendPayload } from "../../component/DefaultLegendContent"
import { isNullish } from "../../util/DataUtils"

import type { AllStackGroups, StackSeries } from "../../util/stacks/stackTypes"
import {
	combineDisplayedStackedData,
	type DisplayedStackedData,
} from "./combiners/combineDisplayedStackedData"
import type { RadialBarSettings } from "../types/RadialBarSettings"
import { type DefinitelyStackedGraphicalItem, isStacked } from "../types/StackedGraphicalItem"
import { combineBarSizeList } from "./combiners/combineBarSizeList"
import { combineAllBarPositions } from "./combiners/combineAllBarPositions"
import { combineStackedData } from "./combiners/combineStackedData"
import type { RechartsScale } from "../../util/scale/RechartsScale"
import { chartSelector } from "./chartSelector"
import { combineBarPosition } from "./combiners/combineBarPosition"

const selectRadiusAxisForRadialBar = (
	state: ChartState,
	radiusAxisId: AxisId,
): RadiusAxisSettings => selectRadiusAxis(state, radiusAxisId)

const selectRadiusAxisScaleForRadar = chartSelector((
	state: ChartState,
	radiusAxisId: AxisId,
): RechartsScale | undefined => selectPolarAxisScale(state, "radiusAxis", radiusAxisId))

export const selectRadiusAxisWithScale = chartSelector(function selectRadiusAxisWithScale(state: ChartState, radiusAxisId: AxisId): BaseAxisWithScale | undefined {
	const axis = selectRadiusAxisForRadialBar(state, radiusAxisId)
	const scale = selectRadiusAxisScaleForRadar(state, radiusAxisId)
	if (axis == null || scale == null) {
		return undefined
	}
	return { ...axis, scale }
})

export const selectRadiusAxisTicks = chartSelector((
	state: ChartState,
	radiusAxisId: AxisId,
): ReadonlyArray<TickItem> | undefined => {
	return selectPolarGraphicalItemAxisTicks(state, "radiusAxis", radiusAxisId, false)
})

const selectAngleAxisForRadialBar = (
	state: ChartState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): AngleAxisSettings => selectAngleAxis(state, angleAxisId)

const selectAngleAxisScaleForRadialBar = chartSelector((
	state: ChartState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): RechartsScale | undefined => selectPolarAxisScale(state, "angleAxis", angleAxisId))

export const selectAngleAxisWithScale = chartSelector(function selectAngleAxisWithScale(state: ChartState, _radiusAxisId: AxisId, angleAxisId: AxisId): BaseAxisWithScale | undefined {
	const axis = selectAngleAxisForRadialBar(state, _radiusAxisId, angleAxisId)
	const scale = selectAngleAxisScaleForRadialBar(state, _radiusAxisId, angleAxisId)
	if (axis == null || scale == null) {
		return undefined
	}
	return { ...axis, scale }
})

const selectAngleAxisTicks = chartSelector((
	state: ChartState,
	_radiusAxisId: AxisId,
	angleAxisId: AxisId,
): ReadonlyArray<TickItem> | undefined => {
	return selectPolarAxisTicks(state, "angleAxis", angleAxisId, false)
})

const selectSynchronisedRadialBarSettings = chartSelector(function selectSynchronisedRadialBarSettings(state: ChartState, radialBarSettings: RadialBarSettings): RadialBarSettings | undefined {
	const graphicalItems = selectUnfilteredPolarItems(state)
	if (
		graphicalItems.some(
			(pgis) =>
				pgis.type === "radialBar" &&
				radialBarSettings.dataKey === pgis.dataKey &&
				radialBarSettings.stackId === pgis.stackId,
		)
	) {
		return radialBarSettings
	}
	return undefined
})

export const selectBandSizeOfPolarAxis = chartSelector(function selectBandSizeOfPolarAxis(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId): number | undefined {
	const layout: LayoutType = selectChartLayout(state)
	const radiusAxis = selectRadiusAxisWithScale(state, radiusAxisId)
	const radiusAxisTicks = selectRadiusAxisTicks(state, radiusAxisId)
	const angleAxis = selectAngleAxisWithScale(state, radiusAxisId, angleAxisId)
	const angleAxisTicks = selectAngleAxisTicks(state, radiusAxisId, angleAxisId)

	if (isCategoricalAxis(layout, "radiusAxis")) {
		return getBandSizeOfAxis(radiusAxis, radiusAxisTicks, false)
	}
	return getBandSizeOfAxis(angleAxis, angleAxisTicks, false)
})

export const selectBaseValue = chartSelector(function selectBaseValue(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId): number | unknown {
	const angleAxis = selectAngleAxisWithScale(state, radiusAxisId, angleAxisId)
	const radiusAxis = selectRadiusAxisWithScale(state, radiusAxisId)
	const layout = selectChartLayout(state)
	const numericAxis = layout === "radial" ? angleAxis : radiusAxis
	if (numericAxis == null || numericAxis.scale == null) {
		return undefined
	}
	return getBaseValueOfBar({ numericAxis })
})

const isRadialBar = (item: PolarGraphicalItemSettings): item is RadialBarSettings =>
	item.type === "radialBar"

const selectAllVisibleRadialBars = chartSelector(function selectAllVisibleRadialBars(state: ChartState, layout: LayoutType, angleAxisId: AxisId, radiusAxisId: AxisId): ReadonlyArray<RadialBarSettings> {
	const allItems = selectUnfilteredPolarItems(state)
	return allItems
		.filter((i) => {
			if (layout === "centric") {
				return i.angleAxisId === angleAxisId
			}
			return i.radiusAxisId === radiusAxisId
		})
		.filter((i) => i.hide === false)
		.filter(isRadialBar)
})

export const selectPolarBarSizeList = chartSelector(function selectPolarBarSizeList(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId, _radialBarSettings: RadialBarSettings): SizeList {
	const layout = selectChartLayout(state)
	return combineBarSizeList(
		selectAllVisibleRadialBars(state, layout, angleAxisId, radiusAxisId),
		selectRootBarSize(state),
		undefined,
	)
})

export const selectPolarBarBandSize = chartSelector(function selectPolarBarBandSize(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId, childMaxBarSize: number | undefined): number {
	const layout: LayoutType = selectChartLayout(state)
	const globalMaxBarSize = selectRootMaxBarSize(state)
	const angleAxis = selectAngleAxisWithScale(state, radiusAxisId, angleAxisId)
	const angleAxisTicks = selectAngleAxisTicks(state, radiusAxisId, angleAxisId)
	const radiusAxis = selectRadiusAxisWithScale(state, radiusAxisId)
	const radiusAxisTicks = selectRadiusAxisTicks(state, radiusAxisId)

	const maxBarSize: number | undefined = isNullish(childMaxBarSize)
		? globalMaxBarSize
		: childMaxBarSize
	if (layout === "centric") {
		return getBandSizeOfAxis(angleAxis, angleAxisTicks, true) ?? maxBarSize ?? 0
	}
	return getBandSizeOfAxis(radiusAxis, radiusAxisTicks, true) ?? maxBarSize ?? 0
})

export const selectAllPolarBarPositions = chartSelector(function selectAllPolarBarPositions(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId, radialBarSettings: RadialBarSettings): ReadonlyArray<BarWithPosition> | undefined {
	return combineAllBarPositions(
		selectPolarBarSizeList(state, radiusAxisId, angleAxisId, radialBarSettings),
		selectRootMaxBarSize(state),
		selectBarGap(state),
		selectBarCategoryGap(state),
		selectPolarBarBandSize(state, radiusAxisId, angleAxisId, radialBarSettings.maxBarSize),
		selectBandSizeOfPolarAxis(state, radiusAxisId, angleAxisId),
		radialBarSettings.maxBarSize,
	)
})

export const selectPolarBarPosition = chartSelector(function selectPolarBarPosition(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId, radialBarSettings: RadialBarSettings): BarPositionPosition | undefined {
	return combineBarPosition(
		selectAllPolarBarPositions(state, radiusAxisId, angleAxisId, radialBarSettings),
		selectSynchronisedRadialBarSettings(state, radialBarSettings),
	)
})

const selectStackedRadialBars = chartSelector(function selectStackedRadialBars(state: ChartState, axisType: PolarAxisType, polarAxisId: AxisId): ReadonlyArray<DefinitelyStackedGraphicalItem> {
	return selectPolarItemsSettings(state, axisType, polarAxisId)
		.filter(isRadialBar)
		.filter(isStacked)
})

const selectPolarCombinedStackedData = chartSelector(function selectPolarCombinedStackedData(state: ChartState, axisType: PolarAxisType, polarAxisId: AxisId): DisplayedStackedData {
	return combineDisplayedStackedData(
		selectStackedRadialBars(state, axisType, polarAxisId),
		selectChartDataAndAlwaysIgnoreIndexes(state),
		selectTooltipAxis(state),
	)
})

const selectRadialBarStackGroups = chartSelector(function selectRadialBarStackGroups(state: ChartState, axisType: PolarAxisType, polarAxisId: AxisId): AllStackGroups | undefined {
	return combineStackGroups(
		selectPolarCombinedStackedData(state, axisType, polarAxisId),
		selectStackedRadialBars(state, axisType, polarAxisId),
		selectStackOffsetType(state),
		selectReverseStackOrder(state),
	)
})

const selectRadialBarStackGroupsByLayout = chartSelector(function selectRadialBarStackGroupsByLayout(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId): AllStackGroups | undefined {
	const layout = selectChartLayout(state)
	if (layout === "centric") {
		return selectRadialBarStackGroups(state, "radiusAxis", radiusAxisId)
	}
	return selectRadialBarStackGroups(state, "angleAxis", angleAxisId)
})

const selectPolarStackedData = chartSelector(function selectPolarStackedData(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId, radialBarSettings: RadialBarSettings): StackSeries | undefined {
	return combineStackedData(
		selectRadialBarStackGroupsByLayout(state, radiusAxisId, angleAxisId),
		selectSynchronisedRadialBarSettings(state, radialBarSettings),
	)
})

const selectRadiusAxisWithScaleWithOverride = chartSelector(function selectRadiusAxisWithScaleWithOverride(state: ChartState, radiusAxisId: AxisId, override: RadiusAxisSettings): BaseAxisWithScale | undefined {
	const axisRange = selectRadiusAxisRangeWithReversed(state, radiusAxisId)
	if (axisRange == null) {
		return undefined
	}
	/* Use override domain directly when set — bypasses the data-derived categorical
	   domain that would otherwise swallow a user-specified numerical domain. */
	const axisDomain = override.domain != null
		? (override.domain as unknown as CategoricalDomain)
		: selectPolarAxisCheckedDomain(state, "radiusAxis", radiusAxisId)
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
	return { ...override, scale }
})

const selectAngleAxisWithScaleWithOverride = chartSelector(function selectAngleAxisWithScaleWithOverride(state: ChartState, _radiusAxisId: AxisId, angleAxisId: AxisId, override: AngleAxisSettings): BaseAxisWithScale | undefined {
	const axisRange = selectAngleAxisRangeWithReversed(state, angleAxisId)
	if (axisRange == null) {
		return undefined
	}
	/* Use override domain directly when set — same rationale as selectRadiusAxisWithScaleWithOverride. */
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
	return { ...override, scale }
})

export const pickMaxBarSize = (
	_state: ChartState,
	_radiusAxisId: AxisId,
	_angleAxisId: AxisId,
	radialBarSettings: RadialBarSettings,
	_cells: ReadonlyArray<Record<string, unknown>> | undefined,
): number | undefined => radialBarSettings.maxBarSize

export const selectRadialBarSectors = chartSelector(function selectRadialBarSectors(state: ChartState, radiusAxisId: AxisId, angleAxisId: AxisId, radialBarSettings: RadialBarSettings, cells: ReadonlyArray<Record<string, unknown>> | undefined, radiusAxisOverride?: RadiusAxisSettings, angleAxisOverride?: AngleAxisSettings): ReadonlyArray<RadialBarDataItem> {
	const angleAxis = angleAxisOverride != null
		? selectAngleAxisWithScaleWithOverride(state, radiusAxisId, angleAxisId, angleAxisOverride)
		: selectAngleAxisWithScale(state, radiusAxisId, angleAxisId)
	const angleAxisTicks = selectAngleAxisTicks(state, radiusAxisId, angleAxisId)
	const radiusAxis = radiusAxisOverride != null
		? selectRadiusAxisWithScaleWithOverride(state, radiusAxisId, radiusAxisOverride)
		: selectRadiusAxisWithScale(state, radiusAxisId)
	const radiusAxisTicks = selectRadiusAxisTicks(state, radiusAxisId)
	const { chartData, dataStartIndex, dataEndIndex }: ChartDataState =
		selectChartDataWithIndexes(state)
	const syncedSettings = selectSynchronisedRadialBarSettings(state, radialBarSettings)
	const layout: LayoutType = selectChartLayout(state)
	/* When an override is active, derive bandSize from the override scale so
	   override domain mutations change bar widths (bandwidth differs per domain size). */
	const bandSize = (() => {
		const legacyBandSize = selectBandSizeOfPolarAxis(state, radiusAxisId, angleAxisId)
		if (radiusAxisOverride == null || radiusAxis == null) {
			return legacyBandSize
		}
		if (isCategoricalAxis(layout, "radiusAxis")) {
			return getBandSizeOfAxis(radiusAxis, radiusAxisTicks, false) ?? legacyBandSize
		}
		const overrideAngleAxis = angleAxis ?? selectAngleAxisWithScale(state, radiusAxisId, angleAxisId)
		return getBandSizeOfAxis(overrideAngleAxis, angleAxisTicks, false) ?? legacyBandSize
	})()
	const baseValue = selectBaseValue(state, radiusAxisId, angleAxisId)
	const polarViewBox = selectPolarViewBox(state)
	/* Recompute bar positions using override band size so pos.size reflects new axis scale. */
	const pos = (() => {
		if (radiusAxisOverride == null) {
			return selectPolarBarPosition(state, radiusAxisId, angleAxisId, radialBarSettings)
		}
		const sizeList = selectPolarBarSizeList(state, radiusAxisId, angleAxisId, radialBarSettings)
		const globalMaxBarSize = selectRootMaxBarSize(state)
		const childMaxBarSize = pickMaxBarSize(state, radiusAxisId, angleAxisId, radialBarSettings, cells)
		const maxBarSize: number | undefined = isNullish(childMaxBarSize) ? globalMaxBarSize : childMaxBarSize
		const overrideBandSize: number = (() => {
			if (radiusAxis == null) return 0
			if (isCategoricalAxis(layout, "radiusAxis")) {
				return getBandSizeOfAxis(radiusAxis, radiusAxisTicks, true) ?? maxBarSize ?? 0
			}
			const oa = angleAxis ?? selectAngleAxisWithScale(state, radiusAxisId, angleAxisId)
			return getBandSizeOfAxis(oa, angleAxisTicks, true) ?? maxBarSize ?? 0
		})()
		const allPositions = combineAllBarPositions(
			sizeList,
			globalMaxBarSize,
			selectBarGap(state),
			selectBarCategoryGap(state),
			overrideBandSize,
			bandSize,
			radialBarSettings.maxBarSize,
		)
		return combineBarPosition(allPositions, syncedSettings)
	})()
	const stackedData = selectPolarStackedData(state, radiusAxisId, angleAxisId, radialBarSettings)

	if (
		syncedSettings == null ||
		radiusAxis == null ||
		angleAxis == null ||
		chartData == null ||
		bandSize == null ||
		pos == null ||
		(layout !== "centric" && layout !== "radial") ||
		radiusAxisTicks == null ||
		polarViewBox == null
	) {
		return []
	}
	const { dataKey, minPointSize } = syncedSettings
	const { cx, cy, startAngle, endAngle } = polarViewBox
	const displayedData = chartData.slice(dataStartIndex, dataEndIndex + 1)
	const numericAxis = layout === "centric" ? radiusAxis : angleAxis
	const stackedDomain: ReadonlyArray<unknown> | null = stackedData
		? numericAxis.scale.domain()
		: null
	return computeRadialBarDataItems({
		angleAxis,
		angleAxisTicks,
		bandSize,
		baseValue,
		cells: cells as ReadonlyArray<JSX.Element> | undefined,
		cx,
		cy,
		dataKey,
		dataStartIndex,
		displayedData,
		endAngle,
		layout,
		minPointSize,
		pos,
		radiusAxis,
		radiusAxisTicks,
		stackedData,
		stackedDomain,
		startAngle,
	})
})

export const selectRadialBarLegendPayload = chartSelector(function selectRadialBarLegendPayload(state: ChartState, legendType: LegendType | undefined): ReadonlyArray<LegendPayload> {
	const { chartData, dataStartIndex, dataEndIndex }: ChartDataState =
		selectChartDataAndAlwaysIgnoreIndexes(state)

	if (chartData == null) {
		return []
	}
	const displayedData = chartData.slice(dataStartIndex, dataEndIndex + 1)

	if (displayedData.length === 0) {
		return []
	}

	return displayedData.map((entry): LegendPayload => {
		return {
			color: (entry as Record<string, unknown>).fill as string,
			payload: entry as Record<string, unknown>,
			type: legendType,
			value: (entry as Record<string, unknown>).name as string,
		}
	})
})
