/* eslint-disable import/no-cycle */
import range from "es-toolkit/compat/range"
import { selectChartLayout } from "../../context/chartLayoutContext"
import {
	getDomainOfStackGroups,
	getStackedData,
	getValueByDataKey,
	isCategoricalAxis,
	type StackId,
} from "../../util/ChartUtils"
import type {
	AxisDomain,
	AxisTick,
	CartesianTickItem,
	CategoricalDomain,
	CategoricalDomainItem,
	ChartOffsetInternal,
	Coordinate,
	D3ScaleType,
	DataKey,
	LayoutType,
	NumberDomain,
	Size,
	StackOffsetType,
	TickItem,
} from "../../util/types"
import type {
	AxisId,
	BaseCartesianAxis,
	CartesianAxisSettings,
	XAxisOrientation,
	XAxisSettings,
	YAxisOrientation,
	YAxisSettings,
	ZAxisSettings,
} from "../cartesianAxisSlice"
import type { ChartState } from "../store"
import {
	selectChartDataWithIndexes,
	selectChartDataWithIndexesIfNotInPanoramaPosition4,
} from "./dataSelectors"
import {
	isWellFormedNumberDomain,
	numericalDomainSpecifiedWithoutRequiringData,
	parseNumericalUserDomain,
} from "../../util/isDomainSpecifiedByUser"
import type { AppliedChartData, ChartData, ChartDataState } from "../chartDataSlice"
import {
	getPercentValue,
	hasDuplicate,
	isNan,
	isNotNil,
	isNumOrStr,
	mathSign,
} from "../../util/DataUtils"
import type {
	BaseCartesianGraphicalItemSettings,
	BasePolarGraphicalItemSettings,
	CartesianGraphicalItemSettings,
	GraphicalItemSettings,
} from "../graphicalItemsSlice"
import type { CartesianItemState } from "../chartState"
import { readChartState } from "../chartState"
import { isWellBehavedNumber } from "../../util/isWellBehavedNumber"
import { getNiceTickValues, getTickValuesFixedDomain } from "../../util/scale"
import type {
	ReferenceAreaSettings,
	ReferenceDotSettings,
	ReferenceElementSettings,
	ReferenceLineSettings,
} from "../referenceElementsSlice"
import { selectChartHeight, selectChartWidth } from "./containerSelectors"
import { selectAllXAxes, selectAllYAxes } from "./selectAllAxes"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import type { AxisPropsForCartesianGridTicksGeneration } from "../../cartesian/CartesianGrid"
import { selectBrushDimensions, selectBrushSettings } from "./brushSelectors"
import {
	selectBarCategoryGap,
	selectChartName,
	selectReverseStackOrder,
	selectStackOffsetType,
} from "./rootPropsSelectors"
import {
	selectAngleAxis,
	selectAngleAxisRange,
	selectRadiusAxis,
	selectRadiusAxisRange,
} from "./polarAxisSelectors"
import type { AngleAxisSettings, RadiusAxisSettings } from "../polarAxisSlice"
import { combineAxisRangeWithReverse } from "./combiners/combineAxisRangeWithReverse"
import { DEFAULT_X_AXIS_HEIGHT, DEFAULT_Y_AXIS_WIDTH } from "../../util/Constants"
import { getStackSeriesIdentifier } from "../../util/stacks/getStackSeriesIdentifier"
import type { AllStackGroups, StackGroup } from "../../util/stacks/stackTypes"
import {
	combineDisplayedStackedData,
	type DisplayedStackedData,
} from "./combiners/combineDisplayedStackedData"
import { type DefinitelyStackedGraphicalItem, isStacked } from "../types/StackedGraphicalItem"
import type { ErrorBarsSettings, ErrorBarsState } from "../errorBarSlice"
import type { AllAxisTypes, RenderableAxisType } from "./selectTooltipAxisType"
import { selectTooltipAxisType } from "./selectTooltipAxisType"
import { selectTooltipAxisId } from "./selectTooltipAxisId"
import { type RechartsScale, rechartsScaleFactory } from "../../util/scale/RechartsScale"
import { combineCheckedDomain } from "./combiners/combineCheckedDomain"
import type { CustomScaleDefinition } from "../../util/scale/CustomScaleDefinition"
import { combineConfiguredScale } from "./combiners/combineConfiguredScale"
import { combineRealScaleType } from "./combiners/combineRealScaleType"
import type { InverseScaleFunction } from "../../hooks"
import { createCategoricalInverse } from "../../util/scale/createCategoricalInverse"
import { combineInverseScaleFunction } from "./combiners/combineInverseScaleFunction"

export const defaultNumericDomain: AxisDomain = [0, "auto"]

export type RenderableAxisSettings =
	| XAxisSettings
	| YAxisSettings
	| AngleAxisSettings
	| RadiusAxisSettings

export type AllAxisSettings =
	| XAxisSettings
	| YAxisSettings
	| ZAxisSettings
	| AngleAxisSettings
	| RadiusAxisSettings

/**
 * If an axis is not explicitly defined as an element,
 * we still need to render something in the chart and we need
 * some object to hold the domain and default settings.
 */
export const implicitXAxis: XAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: undefined,
	domain: undefined,
	height: 30,
	hide: true,
	id: 0,
	includeHidden: false,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: false,
	name: undefined,
	orientation: "bottom",
	padding: { left: 0, right: 0 },
	reversed: false,
	scale: "auto",
	tick: true,
	tickCount: 5,
	tickFormatter: undefined,
	ticks: undefined,
	type: "category",
	unit: undefined,
}

export const selectXAxisSettingsNoDefaults = (
	state: ChartState,
	axisId: AxisId,
	override?: XAxisSettings,
): XAxisSettings | undefined => {
	if (override !== undefined) return override
	return readChartState(state).cartesianAxes.xAxis?.[String(axisId)]?.settings
}

export const selectXAxisSettings = (
	state: ChartState,
	axisId: AxisId,
	override?: XAxisSettings,
): XAxisSettings => {
	const axis = selectXAxisSettingsNoDefaults(state, axisId, override)
	if (axis == null) {
		return implicitXAxis
	}
	return axis
}

/**
 * If an axis is not explicitly defined as an element,
 * we still need to render something in the chart and we need
 * some object to hold the domain and default settings.
 */
export const implicitYAxis: YAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: undefined,
	domain: defaultNumericDomain,
	hide: true,
	id: 0,
	includeHidden: false,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: false,
	name: undefined,
	orientation: "left",
	padding: { bottom: 0, top: 0 },
	reversed: false,
	scale: "auto",
	tick: true,
	tickCount: 5,
	tickFormatter: undefined,
	ticks: undefined,
	type: "number",
	unit: undefined,
	width: DEFAULT_Y_AXIS_WIDTH,
}

export const selectYAxisSettingsNoDefaults = (
	state: ChartState,
	axisId: AxisId,
	override?: YAxisSettings,
): YAxisSettings | undefined => {
	if (override !== undefined) return override
	return readChartState(state).cartesianAxes.yAxis?.[String(axisId)]?.settings
}

export const selectYAxisSettings = (
	state: ChartState,
	axisId: AxisId,
	override?: YAxisSettings,
): YAxisSettings => {
	const axis = selectYAxisSettingsNoDefaults(state, axisId, override)
	if (axis == null) {
		return implicitYAxis
	}
	return axis
}

export const implicitZAxis: ZAxisSettings = {
	allowDataOverflow: false,
	allowDuplicatedCategory: false,
	dataKey: undefined,
	domain: [0, "auto"],
	id: 0,
	includeHidden: false,
	name: "",
	range: [64, 64],
	reversed: false,
	scale: "auto",
	type: "number",
	unit: "",
}

export const selectZAxisSettings = (
	state: ChartState,
	axisId: AxisId,
	override?: ZAxisSettings,
): ZAxisSettings => {
	if (override !== undefined) return override
	const solidEntry = readChartState(state).cartesianAxes.zAxis?.[String(axisId)]?.settings
	if (solidEntry != null) return solidEntry
	return implicitZAxis
}

export const selectBaseAxis = (
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): AllAxisSettings => {
	switch (axisType) {
		case "xAxis": {
			return selectXAxisSettings(state, axisId)
		}
		case "yAxis": {
			return selectYAxisSettings(state, axisId)
		}
		case "zAxis": {
			return selectZAxisSettings(state, axisId)
		}
		case "angleAxis": {
			return selectAngleAxis(state, axisId)
		}
		case "radiusAxis": {
			return selectRadiusAxis(state, axisId)
		}
		default:
			throw new Error(`Unexpected axis type: ${axisType}`)
	}
}

const selectCartesianAxisSettings = (
	state: ChartState,
	axisType: "xAxis" | "yAxis",
	axisId: AxisId,
): XAxisSettings | YAxisSettings => {
	switch (axisType) {
		case "xAxis": {
			return selectXAxisSettings(state, axisId)
		}
		case "yAxis": {
			return selectYAxisSettings(state, axisId)
		}
		default:
			throw new Error(`Unexpected axis type: ${axisType}`)
	}
}

/**
 * Selects either an X or Y axis. Doesn't work with Z axis - for that, instead use selectBaseAxis.
 * @param state Root state
 * @param axisType xAxis | yAxis
 * @param axisId xAxisId | yAxisId
 * @returns axis settings object
 */
export const selectRenderableAxisSettings = (
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
): RenderableAxisSettings => {
	switch (axisType) {
		case "xAxis": {
			return selectXAxisSettings(state, axisId)
		}
		case "yAxis": {
			return selectYAxisSettings(state, axisId)
		}
		case "angleAxis": {
			return selectAngleAxis(state, axisId)
		}
		case "radiusAxis": {
			return selectRadiusAxis(state, axisId)
		}
		default:
			throw new Error(`Unexpected axis type: ${axisType}`)
	}
}

/**
 * @param state ChartState
 * @return boolean true if there is at least one Bar or RadialBar
 */
export const selectHasBar = (state: ChartState): boolean => {
	return Object.values(readChartState(state).graphicalItems).some(
		(item) =>
			item != null &&
			typeof item === "object" &&
			"type" in item &&
			(item.type === "bar" || item.type === "radialBar"),
	)
}

/**
 * Filters CartesianGraphicalItemSettings by the relevant axis ID
 * @param axisType 'xAxis' | 'yAxis' | 'zAxis' | 'radiusAxis' | 'angleAxis'
 * @param axisId from props, defaults to 0
 *
 * @returns Predicate function that return true for CartesianGraphicalItemSettings that are relevant to the specified axis
 */
export function itemAxisPredicate(axisType: AllAxisTypes, axisId: AxisId) {
	return (item: BaseCartesianGraphicalItemSettings | BasePolarGraphicalItemSettings) => {
		switch (axisType) {
			case "xAxis":
				return "xAxisId" in item && item.xAxisId === axisId
			case "yAxis":
				return "yAxisId" in item && item.yAxisId === axisId
			case "zAxis":
				return "zAxisId" in item && item.zAxisId === axisId
			case "angleAxis":
				return "angleAxisId" in item && item.angleAxisId === axisId
			case "radiusAxis":
				return "radiusAxisId" in item && item.radiusAxisId === axisId
			default:
				return false
		}
	}
}

export const selectUnfilteredCartesianItems = (
	state: ChartState,
): ReadonlyArray<CartesianGraphicalItemSettings> => {
	return Object.values(readChartState(state).graphicalItems)
		.filter(
			(item): item is CartesianItemState =>
				item != null &&
				typeof item === "object" &&
				"type" in item &&
				(item.type === "line" ||
					item.type === "area" ||
					item.type === "bar" ||
					item.type === "scatter"),
		)
		.map((item) => item.settings)
}

export const combineGraphicalItemsSettings = <T extends GraphicalItemSettings>(
	graphicalItems: ReadonlyArray<T>,
	axisSettings: BaseCartesianAxis,
	axisPredicate: (item: T) => boolean,
) =>
	graphicalItems.filter(axisPredicate).filter((item) => {
		if (axisSettings?.includeHidden === true) {
			return true
		}
		return !item.hide
	})

export function selectCartesianItemsSettings(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<CartesianGraphicalItemSettings> {
	const graphicalItems = selectUnfilteredCartesianItems(state)
	const axisSettings = selectBaseAxis(state, axisType, axisId)
	const axisPredicate = itemAxisPredicate(axisType, axisId)
	return combineGraphicalItemsSettings(graphicalItems, axisSettings, axisPredicate)
}

export function selectStackedCartesianItemsSettings(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<DefinitelyStackedGraphicalItem> {
	const cartesianItems = selectCartesianItemsSettings(state, axisType, axisId)
	return cartesianItems
		.filter((item) => item.type === "area" || item.type === "bar")
		.filter(isStacked)
}

export const filterGraphicalNotStackedItems = (
	cartesianItems: ReadonlyArray<GraphicalItemSettings>,
): ReadonlyArray<GraphicalItemSettings> =>
	cartesianItems.filter((item) => !("stackId" in item) || item.stackId === undefined)

function selectCartesianItemsSettingsExceptStacked(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<GraphicalItemSettings> {
	return filterGraphicalNotStackedItems(selectCartesianItemsSettings(state, axisType, axisId))
}

export const combineGraphicalItemsData = (cartesianItems: ReadonlyArray<GraphicalItemSettings>) =>
	cartesianItems
		.map((item) => item.data)
		.filter(Boolean)
		.flat(1)

/**
 * This is a "cheap" selector - it returns the data but doesn't iterate them, so it is not sensitive on the array length.
 * Also does not apply dataKey yet.
 * @param state ChartState
 * @returns data defined on the chart graphical items, such as Line or Scatter or Pie, and filtered with appropriate dataKey
 */
export function selectCartesianGraphicalItemsData(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ChartData {
	return combineGraphicalItemsData(selectCartesianItemsSettings(state, axisType, axisId))
}

export const combineDisplayedData = (
	graphicalItemsData: ChartData,
	{ chartData = [], dataStartIndex, dataEndIndex }: ChartDataState,
): ChartData => {
	if (graphicalItemsData.length > 0) {
		return graphicalItemsData
	}
	return chartData.slice(dataStartIndex, dataEndIndex + 1)
}

/**
 * This selector will return all data there is in the chart: graphical items, chart root, all together.
 * Useful for figuring out an axis domain (because that needs to know of everything),
 * not useful for rendering individual graphical elements (because they need to know which data is theirs and which is not).
 *
 * This function will discard the original indexes, so it is also not useful for anything that depends on ordering.
 */
export function selectDisplayedData(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): ChartData {
	return combineDisplayedData(
		selectCartesianGraphicalItemsData(state, axisType, axisId),
		selectChartDataWithIndexesIfNotInPanoramaPosition4(state, undefined, undefined, isPanorama),
	)
}

export const combineAppliedValues = (
	data: ChartData,
	axisSettings: BaseCartesianAxis,
	items: ReadonlyArray<GraphicalItemSettings>,
): AppliedChartData => {
	if (axisSettings?.dataKey != null) {
		return data.map((item) => ({ value: getValueByDataKey(item, axisSettings.dataKey) }))
	}
	if (items.length > 0) {
		return items
			.map((item) => item.dataKey)
			.flatMap((dataKey) => data.map((entry) => ({ value: getValueByDataKey(entry, dataKey) })))
	}
	return data.map((entry) => ({ value: entry }))
}

/**
 * This selector will return all values with the appropriate dataKey applied on them.
 * Which dataKey is appropriate depends on where it is defined.
 *
 * This is an expensive selector - it will iterate all data and compute their value using the provided dataKey.
 */
export function selectAllAppliedValues(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): AppliedChartData {
	return combineAppliedValues(
		selectDisplayedData(state, axisType, axisId, isPanorama),
		selectBaseAxis(state, axisType, axisId),
		selectCartesianItemsSettings(state, axisType, axisId),
	)
}

function makeNumber(val: unknown): number | undefined {
	if (isNumOrStr(val) || val instanceof Date) {
		const n = Number(val)
		if (isWellBehavedNumber(n)) {
			return n
		}
	}
	return undefined
}

function makeDomain(val: unknown): NumberDomain | undefined {
	if (Array.isArray(val)) {
		const attempt = [makeNumber(val[0]), makeNumber(val[1])]
		if (isWellFormedNumberDomain(attempt)) {
			return attempt
		}
		return undefined
	}
	const n = makeNumber(val)
	if (n == null) {
		return undefined
	}
	return [n, n]
}

function onlyAllowNumbers(data: ReadonlyArray<unknown>): ReadonlyArray<number> {
	return data.map(makeNumber).filter(isNotNil)
}

function sortBy(a: unknown, b: unknown): number {
	const aNum = makeNumber(a)
	const bNum = makeNumber(b)
	if (aNum == null && bNum == null) {
		return 0
	}
	if (aNum == null) {
		return -1
	}
	if (bNum == null) {
		return 1
	}
	return aNum - bNum
}

export function selectSortedDataPoints(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<unknown> | undefined {
	const appliedData = selectAllAppliedValues(state, axisType, axisId, isPanorama)
	return appliedData?.map((item) => item.value).sort(sortBy)
}

export function isErrorBarRelevantForAxisType(
	axisType: AllAxisTypes,
	errorBar: ErrorBarsSettings,
): boolean {
	switch (axisType) {
		case "xAxis":
			return errorBar.direction === "x"
		case "yAxis":
			return errorBar.direction === "y"
		default:
			return false
	}
}

export type AppliedChartDataWithErrorDomain = {
	/**
	 * This is the value after the dataKey has been applied. Presumably a number? But no guarantees.
	 */
	value: unknown
	/**
	 * This is the error domain, if any, for the current value.
	 * This may be either x or y direction, whatever is applicable.
	 * Assumption is that we're looking at this data from the point of view of a single axis,
	 * and that axis dictates the relevant direction.
	 */
	errorDomain: ReadonlyArray<number> | undefined
}

/**
 * @param entry One item in the 'data' array. Could be anything really - this is defined externally. This is the raw, before dataKey application
 * @param appliedValue This is the result of applying the 'main' dataKey on the `entry`.
 * @param relevantErrorBars Error bars that are relevant for the current axis and layout and all that.
 * @return either undefined or an array of ErrorValue
 */
export function getErrorDomainByDataKey(
	entry: unknown,
	appliedValue: unknown,
	relevantErrorBars: ReadonlyArray<ErrorBarsSettings> | undefined,
): ReadonlyArray<number> {
	if (!relevantErrorBars || typeof appliedValue !== "number" || isNan(appliedValue)) {
		return []
	}

	if (!relevantErrorBars.length) {
		return []
	}

	return onlyAllowNumbers(
		relevantErrorBars.flatMap((eb) => {
			const errorValue = getValueByDataKey(entry, eb.dataKey)
			let lowBound: unknown
			let highBound: unknown

			if (Array.isArray(errorValue)) {
				;[lowBound, highBound] = errorValue
			} else {
				lowBound = errorValue
				highBound = errorValue
			}
			if (!isWellBehavedNumber(lowBound) || !isWellBehavedNumber(highBound)) {
				return undefined
			}
			return [appliedValue - lowBound, appliedValue + highBound]
		}),
	)
}

export const selectTooltipAxis = (state: ChartState): RenderableAxisSettings => {
	const axisType = selectTooltipAxisType(state)
	const axisId = selectTooltipAxisId(state)
	return selectRenderableAxisSettings(state, axisType, axisId)
}

export function selectTooltipAxisDataKey(state: ChartState): DataKey<unknown> | undefined {
	const axis = selectTooltipAxis(state)
	return axis?.dataKey
}

export function selectDisplayedStackedData(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): DisplayedStackedData {
	return combineDisplayedStackedData(
		selectStackedCartesianItemsSettings(state, axisType, axisId),
		selectChartDataWithIndexesIfNotInPanoramaPosition4(state, undefined, undefined, isPanorama),
		selectTooltipAxis(state),
	)
}

export const combineStackGroups = (
	displayedData: DisplayedStackedData,
	items: ReadonlyArray<DefinitelyStackedGraphicalItem>,
	stackOffsetType: StackOffsetType,
	reverseStackOrder: boolean,
): AllStackGroups => {
	const initialItemsGroups: Record<StackId, Array<DefinitelyStackedGraphicalItem>> = {}
	const itemsGroup: Record<StackId, ReadonlyArray<DefinitelyStackedGraphicalItem>> = items.reduce(
		(
			acc: Record<StackId, Array<DefinitelyStackedGraphicalItem>>,
			item: DefinitelyStackedGraphicalItem,
		) => {
			if (item.stackId == null) {
				return acc
			}
			let stack = acc[item.stackId]
			if (stack == null) {
				stack = []
			}
			stack.push(item)
			acc[item.stackId] = stack
			return acc
		},
		initialItemsGroups,
	)

	return Object.fromEntries(
		Object.entries(itemsGroup).map(([stackId, graphicalItems]): [StackId, StackGroup] => {
			const orderedGraphicalItems = reverseStackOrder
				? [...graphicalItems].reverse()
				: graphicalItems
			const dataKeys = orderedGraphicalItems
				.map((item) => getStackSeriesIdentifier(item))
				.filter((k): k is string => k != null)
			return [
				stackId,
				{
					graphicalItems: orderedGraphicalItems,
					stackedData: getStackedData(
						displayedData as unknown as Array<Record<string, unknown>>,
						dataKeys,
						stackOffsetType,
					),
				},
			]
		}),
	)
}

/**
 * Stack groups are groups of graphical items that stack on each other.
 * Stack is a function of axis type (X, Y), axis ID, and stack ID.
 * Graphical items that do not have a stack ID are not going to be present in stack groups.
 */
export function selectStackGroups(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): AllStackGroups | undefined {
	return combineStackGroups(
		selectDisplayedStackedData(state, axisType, axisId, isPanorama),
		selectStackedCartesianItemsSettings(state, axisType, axisId),
		selectStackOffsetType(state),
		selectReverseStackOrder(state),
	)
}

export const combineDomainOfStackGroups = (
	stackGroups: AllStackGroups | undefined,
	{ dataStartIndex, dataEndIndex }: ChartDataState,
	axisType: AllAxisTypes,
	domainFromUserPreference: NumberDomain | undefined,
): NumberDomain | undefined => {
	if (domainFromUserPreference != null) {
		return undefined
	}
	if (axisType === "zAxis") {
		return undefined
	}
	const domainOfStackGroups = getDomainOfStackGroups(stackGroups, dataStartIndex, dataEndIndex)
	if (domainOfStackGroups != null && domainOfStackGroups[0] === 0 && domainOfStackGroups[1] === 0) {
		return undefined
	}
	return domainOfStackGroups
}

function selectAllowsDataOverflow(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): boolean {
	return selectBaseAxis(state, axisType, axisId).allowDataOverflow
}

export const getDomainDefinition = (axisSettings: AllAxisSettings): AxisDomain => {
	if (axisSettings == null || !("domain" in axisSettings)) {
		return defaultNumericDomain
	}

	if (axisSettings.domain != null) {
		return axisSettings.domain
	}
	if ("ticks" in axisSettings && axisSettings.ticks != null) {
		if (axisSettings.type === "number") {
			const allValues = onlyAllowNumbers(axisSettings.ticks)
			return [Math.min(...allValues), Math.max(...allValues)]
		}
		if (axisSettings.type === "category") {
			return axisSettings.ticks.map(String)
		}
	}
	return axisSettings?.domain ?? defaultNumericDomain
}

export function selectDomainDefinition(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): AxisDomain {
	return getDomainDefinition(selectBaseAxis(state, axisType, axisId))
}

/**
 * Under certain circumstances, we can determine the domain without looking at the data at all.
 * This is the case when the domain is explicitly specified as numbers, or when it is specified
 * as 'auto' or 'dataMin'/'dataMax' and data overflow is not allowed.
 *
 * In that case, this function will return the domain, otherwise it returns undefined.
 *
 * This is an optimization to avoid unnecessary data processing.
 */
export function selectDomainFromUserPreference(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): NumberDomain | undefined {
	return numericalDomainSpecifiedWithoutRequiringData(
		selectDomainDefinition(state, axisType, axisId),
		selectAllowsDataOverflow(state, axisType, axisId),
	)
}

export function selectDomainOfStackGroups(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): NumberDomain | undefined {
	return combineDomainOfStackGroups(
		selectStackGroups(state, axisType, axisId, isPanorama),
		selectChartDataWithIndexes(state),
		axisType,
		selectDomainFromUserPreference(state, axisType, axisId),
	)
}

export const selectAllErrorBarSettings = (state: ChartState): ErrorBarsState =>
	state.errorBars

const combineRelevantErrorBarSettings = (
	cartesianItemsSettings: ReadonlyArray<CartesianGraphicalItemSettings>,
	allErrorBarSettings: ErrorBarsState,
	axisType: RenderableAxisType,
): ReadonlyArray<ErrorBarsSettings> => {
	return cartesianItemsSettings
		.flatMap((item) => {
			return allErrorBarSettings[item.id]
		})
		.filter((e): e is ErrorBarsSettings => e != null)
		.filter((e) => {
			return isErrorBarRelevantForAxisType(axisType, e)
		})
}

export const mergeDomains = (
	...domains: ReadonlyArray<ReadonlyArray<number> | undefined>
): NumberDomain | undefined => {
	const allDomains = domains.filter((d): d is ReadonlyArray<number> => d != null)
	if (allDomains.length === 0) {
		return undefined
	}
	const allValues = allDomains.flat()
	const min = Math.min(...allValues)
	const max = Math.max(...allValues)
	return [min, max]
}

export const combineDomainOfAllAppliedNumericalValuesIncludingErrorValues = (
	data: ChartData,
	axisSettings: BaseCartesianAxis,
	items: ReadonlyArray<GraphicalItemSettings>,
	errorBars: ErrorBarsState,
	axisType: AllAxisTypes,
): NumberDomain | undefined => {
	let lowerEnd: number | undefined
	let upperEnd: number | undefined
	if (items.length > 0) {
		data.forEach((entry) => {
			items.forEach((item) => {
				const relevantErrorBars = errorBars[item.id]?.filter((errorBar) =>
					isErrorBarRelevantForAxisType(axisType, errorBar),
				)
				const valueByDataKey = getValueByDataKey(entry, axisSettings.dataKey ?? item.dataKey)
				const errorDomain = getErrorDomainByDataKey(entry, valueByDataKey, relevantErrorBars)
				if (errorDomain.length >= 2) {
					const localLower = Math.min(...errorDomain)
					const localUpper = Math.max(...errorDomain)
					if (lowerEnd == null || localLower < lowerEnd) {
						lowerEnd = localLower
					}
					if (upperEnd == null || localUpper > upperEnd) {
						upperEnd = localUpper
					}
				}
				const dataValueDomain: NumberDomain | undefined = makeDomain(valueByDataKey)
				if (dataValueDomain != null) {
					lowerEnd = lowerEnd == null ? dataValueDomain[0] : Math.min(lowerEnd, dataValueDomain[0])
					upperEnd = upperEnd == null ? dataValueDomain[1] : Math.max(upperEnd, dataValueDomain[1])
				}
			})
		})
	}
	if (axisSettings?.dataKey != null) {
		data.forEach((item) => {
			const dataValueDomain: NumberDomain | undefined = makeDomain(
				getValueByDataKey(item, axisSettings.dataKey),
			)
			if (dataValueDomain != null) {
				lowerEnd = lowerEnd == null ? dataValueDomain[0] : Math.min(lowerEnd, dataValueDomain[0])
				upperEnd = upperEnd == null ? dataValueDomain[1] : Math.max(upperEnd, dataValueDomain[1])
			}
		})
	}

	if (isWellBehavedNumber(lowerEnd) && isWellBehavedNumber(upperEnd)) {
		return [lowerEnd, upperEnd]
	}
	return undefined
}

function selectDomainOfAllAppliedNumericalValuesIncludingErrorValues(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): NumberDomain | undefined {
	return combineDomainOfAllAppliedNumericalValuesIncludingErrorValues(
		selectDisplayedData(state, axisType, axisId, isPanorama),
		selectBaseAxis(state, axisType, axisId),
		selectCartesianItemsSettingsExceptStacked(state, axisType, axisId),
		selectAllErrorBarSettings(state),
		axisType,
	)
}

function onlyAllowNumbersAndStringsAndDates(item: {
	value: unknown
}): string | number | Date | undefined {
	const { value } = item
	if (isNumOrStr(value) || value instanceof Date) {
		return value
	}
	return undefined
}

const computeDomainOfTypeCategory = (
	allDataSquished: AppliedChartData,
	axisSettings: BaseCartesianAxis,
	isCategorical: boolean,
): CategoricalDomain => {
	const categoricalDomain = allDataSquished
		.map(onlyAllowNumbersAndStringsAndDates)
		.filter((v) => v != null)
	if (
		isCategorical &&
		(axisSettings.dataKey == null ||
			(axisSettings.allowDuplicatedCategory && hasDuplicate(categoricalDomain)))
	) {
		return range(0, allDataSquished.length)
	}
	if (axisSettings.allowDuplicatedCategory) {
		return categoricalDomain
	}
	return Array.from(new Set(categoricalDomain))
}

export const selectReferenceDots = (
	state: ChartState,
): ReadonlyArray<ReferenceDotSettings> => state.referenceElements.dots

export const filterReferenceElements = <T extends ReferenceElementSettings>(
	elements: ReadonlyArray<T>,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<T> => {
	return elements
		.filter((el) => el.ifOverflow === "extendDomain")
		.filter((el) => {
			if (axisType === "xAxis") {
				return el.xAxisId === axisId
			}
			return el.yAxisId === axisId
		})
}

export function selectReferenceDotsByAxis(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<ReferenceDotSettings> {
	return filterReferenceElements(selectReferenceDots(state), axisType, axisId)
}

export const selectReferenceAreas = (
	state: ChartState,
): ReadonlyArray<ReferenceAreaSettings> => state.referenceElements.areas

export function selectReferenceAreasByAxis(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<ReferenceAreaSettings> {
	return filterReferenceElements(selectReferenceAreas(state), axisType, axisId)
}

export const selectReferenceLines = (
	state: ChartState,
): ReadonlyArray<ReferenceLineSettings> => state.referenceElements.lines

export function selectReferenceLinesByAxis(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<ReferenceLineSettings> {
	return filterReferenceElements(selectReferenceLines(state), axisType, axisId)
}

export const combineDotsDomain = (
	dots: ReadonlyArray<ReferenceDotSettings> | undefined,
	axisType: RenderableAxisType,
): NumberDomain | undefined => {
	if (dots == null) {
		return undefined
	}
	const allCoords = onlyAllowNumbers(dots.map((dot) => (axisType === "xAxis" ? dot.x : dot.y)))
	if (allCoords.length === 0) {
		return undefined
	}
	return [Math.min(...allCoords), Math.max(...allCoords)]
}

function selectReferenceDotsDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): NumberDomain | undefined {
	return combineDotsDomain(
		selectReferenceDotsByAxis(state, axisType, axisId),
		axisType as RenderableAxisType,
	)
}

export const combineAreasDomain = (
	areas: ReadonlyArray<ReferenceAreaSettings> | undefined,
	axisType: RenderableAxisType,
): NumberDomain | undefined => {
	if (areas == null) {
		return undefined
	}
	const allCoords = onlyAllowNumbers(
		areas.flatMap((area) => [
			axisType === "xAxis" ? area.x1 : area.y1,
			axisType === "xAxis" ? area.x2 : area.y2,
		]),
	)
	if (allCoords.length === 0) {
		return undefined
	}
	return [Math.min(...allCoords), Math.max(...allCoords)]
}

function selectReferenceAreasDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): NumberDomain | undefined {
	return combineAreasDomain(
		selectReferenceAreasByAxis(state, axisType, axisId),
		axisType as RenderableAxisType,
	)
}

function extractXCoordinates(line: ReferenceLineSettings): ReadonlyArray<number> {
	if (line.x != null) {
		return onlyAllowNumbers([line.x])
	}
	const segmentCoordinates: ReadonlyArray<string | number | undefined> | undefined =
		line.segment?.map((s) => s.x)
	if (segmentCoordinates == null || segmentCoordinates.length === 0) {
		return []
	}
	return onlyAllowNumbers(segmentCoordinates)
}

function extractYCoordinates(line: ReferenceLineSettings): ReadonlyArray<number> {
	if (line.y != null) {
		return onlyAllowNumbers([line.y])
	}
	const segmentCoordinates: ReadonlyArray<string | number | undefined> | undefined =
		line.segment?.map((s) => s.y)
	if (segmentCoordinates == null || segmentCoordinates.length === 0) {
		return []
	}
	return onlyAllowNumbers(segmentCoordinates)
}

export const combineLinesDomain = (
	lines: ReadonlyArray<ReferenceLineSettings> | undefined,
	axisType: RenderableAxisType,
): NumberDomain | undefined => {
	if (lines == null) {
		return undefined
	}
	const allCoords: ReadonlyArray<number> = lines.flatMap((line) =>
		axisType === "xAxis" ? extractXCoordinates(line) : extractYCoordinates(line),
	)
	if (allCoords.length === 0) {
		return undefined
	}
	return [Math.min(...allCoords), Math.max(...allCoords)]
}

function selectReferenceLinesDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): NumberDomain | undefined {
	return combineLinesDomain(
		selectReferenceLinesByAxis(state, axisType, axisId),
		axisType as RenderableAxisType,
	)
}

function selectReferenceElementsDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): NumberDomain | undefined {
	const dotsDomain = selectReferenceDotsDomain(state, axisType, axisId)
	const linesDomain = selectReferenceLinesDomain(state, axisType, axisId)
	const areasDomain = selectReferenceAreasDomain(state, axisType, axisId)
	return mergeDomains(dotsDomain, areasDomain, linesDomain)
}

export const combineNumericalDomain = (
	axisSettings: BaseCartesianAxis,
	domainDefinition: AxisDomain | undefined,
	domainFromUserPreference: NumberDomain | undefined,
	domainOfStackGroups: NumberDomain | undefined,
	dataAndErrorBarsDomain: NumberDomain | undefined,
	referenceElementsDomain: NumberDomain | undefined,
	layout: LayoutType,
	axisType: AllAxisTypes,
): NumberDomain | undefined => {
	if (domainFromUserPreference != null) {
		return domainFromUserPreference
	}

	const shouldIncludeDomainOfStackGroups =
		(layout === "vertical" && axisType === "xAxis") ||
		(layout === "horizontal" && axisType === "yAxis")

	const mergedDomains = shouldIncludeDomainOfStackGroups
		? mergeDomains(domainOfStackGroups, referenceElementsDomain, dataAndErrorBarsDomain)
		: mergeDomains(referenceElementsDomain, dataAndErrorBarsDomain)

	return parseNumericalUserDomain(domainDefinition, mergedDomains, axisSettings.allowDataOverflow)
}

export function selectNumericalDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): NumberDomain | undefined {
	return combineNumericalDomain(
		selectBaseAxis(state, axisType, axisId),
		selectDomainDefinition(state, axisType, axisId),
		selectDomainFromUserPreference(state, axisType, axisId),
		selectDomainOfStackGroups(state, axisType, axisId, isPanorama),
		selectDomainOfAllAppliedNumericalValuesIncludingErrorValues(
			state,
			axisType,
			axisId,
			isPanorama,
		),
		selectReferenceElementsDomain(state, axisType, axisId),
		selectChartLayout(state),
		axisType,
	)
}

/**
 * Expand by design maps everything between 0 and 1,
 * there is nothing to compute.
 * See https://d3js.org/d3-shape/stack#stack-offsets
 */
const expandDomain: NumberDomain = [0, 1]

export const combineAxisDomain = (
	axisSettings: BaseCartesianAxis,
	layout: LayoutType,
	displayedData: ChartData | undefined,
	allAppliedValues: AppliedChartData,
	stackOffsetType: StackOffsetType,
	axisType: AllAxisTypes,
	numericalDomain: NumberDomain | undefined,
): NumberDomain | CategoricalDomain | undefined => {
	if (
		(axisSettings == null || displayedData == null || displayedData.length === 0) &&
		numericalDomain === undefined
	) {
		return undefined
	}
	const { dataKey, type } = axisSettings
	const isCategorical = isCategoricalAxis(layout, axisType)

	if (isCategorical && dataKey == null) {
		return range(0, displayedData?.length ?? 0)
	}

	if (type === "category") {
		return computeDomainOfTypeCategory(allAppliedValues, axisSettings, isCategorical)
	}

	if (stackOffsetType === "expand") {
		return expandDomain
	}
	return numericalDomain
}

export function selectAxisDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): NumberDomain | CategoricalDomain | undefined {
	return combineAxisDomain(
		selectBaseAxis(state, axisType, axisId),
		selectChartLayout(state),
		selectDisplayedData(state, axisType, axisId, isPanorama),
		selectAllAppliedValues(state, axisType, axisId, isPanorama),
		selectStackOffsetType(state),
		axisType,
		selectNumericalDomain(state, axisType, axisId, isPanorama),
	)
}

export function selectRealScaleType(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): D3ScaleType | undefined {
	return combineRealScaleType(
		selectBaseAxis(state, axisType, axisId),
		selectHasBar(state),
		selectChartName(state),
	)
}

export const combineNiceTicks = (
	axisDomain: NumberDomain | CategoricalDomain | undefined,
	axisSettings: RenderableAxisSettings,
	realScaleType: string | undefined,
): ReadonlyArray<number> | undefined => {
	const domainDefinition: AxisDomain = getDomainDefinition(axisSettings)

	if (realScaleType !== "auto" && realScaleType !== "linear") {
		return undefined
	}

	if (
		axisSettings != null &&
		axisSettings.tickCount &&
		Array.isArray(domainDefinition) &&
		(domainDefinition[0] === "auto" || domainDefinition[1] === "auto") &&
		isWellFormedNumberDomain(axisDomain)
	) {
		return getNiceTickValues(axisDomain, axisSettings.tickCount, axisSettings.allowDecimals)
	}

	if (
		axisSettings != null &&
		axisSettings.tickCount &&
		axisSettings.type === "number" &&
		isWellFormedNumberDomain(axisDomain)
	) {
		return getTickValuesFixedDomain(
			axisDomain as NumberDomain,
			axisSettings.tickCount,
			axisSettings.allowDecimals,
		)
	}

	return undefined
}

export function selectNiceTicks(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<number> | undefined {
	return combineNiceTicks(
		selectAxisDomain(state, axisType, axisId, isPanorama),
		selectRenderableAxisSettings(state, axisType, axisId),
		selectRealScaleType(state, axisType, axisId),
	)
}

export const combineAxisDomainWithNiceTicks = (
	axisSettings: BaseCartesianAxis,
	domain: NumberDomain | CategoricalDomain | undefined,
	niceTicks: ReadonlyArray<number> | undefined,
	axisType: RenderableAxisType,
): NumberDomain | CategoricalDomain | undefined => {
	if (
		axisType !== "angleAxis" &&
		axisSettings?.type === "number" &&
		isWellFormedNumberDomain(domain) &&
		Array.isArray(niceTicks) &&
		niceTicks.length > 0
	) {
		const minFromDomain = domain[0]
		const minFromTicks = niceTicks[0] ?? 0
		const maxFromDomain = domain[1]
		const maxFromTicks = niceTicks[niceTicks.length - 1] ?? 0
		return [Math.min(minFromDomain, minFromTicks), Math.max(maxFromDomain, maxFromTicks)]
	}
	return domain
}

export function selectAxisDomainIncludingNiceTicks(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): NumberDomain | CategoricalDomain | undefined {
	return combineAxisDomainWithNiceTicks(
		selectBaseAxis(state, axisType, axisId),
		selectAxisDomain(state, axisType, axisId, isPanorama),
		selectNiceTicks(state, axisType, axisId, isPanorama),
		axisType,
	)
}

/**
 * Returns the smallest gap, between two numbers in the data, as a ratio of the whole range (max - min).
 * Ignores domain provided by user and only considers domain from data.
 *
 * The result is a number between 0 and 1.
 */
export function selectSmallestDistanceBetweenValues(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): number | undefined {
	const allDataSquished = selectAllAppliedValues(state, axisType, axisId, isPanorama)
	const axisSettings = selectBaseAxis(state, axisType, axisId)
	if (!axisSettings || axisSettings.type !== "number") {
		return undefined
	}
	let smallestDistanceBetweenValues = Infinity
	const sortedValues = Array.from(onlyAllowNumbers(allDataSquished.map((d) => d.value))).sort(
		(a, b) => a - b,
	)
	const first = sortedValues[0]
	const last = sortedValues[sortedValues.length - 1]
	if (first == null || last == null) {
		return Infinity
	}
	const diff = last - first
	if (diff === 0) {
		return Infinity
	}
	for (let i = 0; i < sortedValues.length - 1; i++) {
		const curr = sortedValues[i]
		const next = sortedValues[i + 1]
		if (curr == null || next == null) {
			continue
		}
		const distance = next - curr
		smallestDistanceBetweenValues = Math.min(smallestDistanceBetweenValues, distance)
	}
	return smallestDistanceBetweenValues / diff
}

function selectCalculatedPadding(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
	padding: string,
): number {
	const smallestDistanceInPercent = selectSmallestDistanceBetweenValues(
		state,
		axisType,
		axisId,
		isPanorama,
	)
	const layout = selectChartLayout(state)
	const barCategoryGap = selectBarCategoryGap(state)
	const offset = selectChartOffsetInternal(state)

	if (!isWellBehavedNumber(smallestDistanceInPercent)) {
		return 0
	}
	const rangeWidth = layout === "vertical" ? offset.height : offset.width

	if (padding === "gap") {
		return (smallestDistanceInPercent * rangeWidth) / 2
	}

	if (padding === "no-gap") {
		const gap = getPercentValue(barCategoryGap, smallestDistanceInPercent * rangeWidth)
		const halfBand = (smallestDistanceInPercent * rangeWidth) / 2
		return halfBand - gap - ((halfBand - gap) / rangeWidth) * gap
	}

	return 0
}

export const selectCalculatedXAxisPadding = (
	state: ChartState,
	axisId: AxisId,
	isPanorama: boolean,
): number => {
	const xAxisSettings = selectXAxisSettings(state, axisId)
	if (xAxisSettings == null || typeof xAxisSettings.padding !== "string") {
		return 0
	}
	return selectCalculatedPadding(state, "xAxis", axisId, isPanorama, xAxisSettings.padding)
}

export const selectCalculatedYAxisPadding = (
	state: ChartState,
	axisId: AxisId,
	isPanorama: boolean,
): number => {
	const yAxisSettings = selectYAxisSettings(state, axisId)
	if (yAxisSettings == null || typeof yAxisSettings.padding !== "string") {
		return 0
	}
	return selectCalculatedPadding(state, "yAxis", axisId, isPanorama, yAxisSettings.padding)
}

function selectXAxisPadding(
	state: ChartState,
	axisId: AxisId,
	isPanorama: boolean,
): { left: number; right: number } {
	const xAxisSettings = selectXAxisSettings(state, axisId)
	const calculated = selectCalculatedXAxisPadding(state, axisId, isPanorama)
	if (xAxisSettings == null) {
		return { left: 0, right: 0 }
	}
	const { padding } = xAxisSettings
	if (typeof padding === "string") {
		return { left: calculated, right: calculated }
	}
	return {
		left: (padding.left ?? 0) + calculated,
		right: (padding.right ?? 0) + calculated,
	}
}

function selectYAxisPadding(
	state: ChartState,
	axisId: AxisId,
	isPanorama: boolean,
): { top: number; bottom: number } {
	const yAxisSettings = selectYAxisSettings(state, axisId)
	const calculated = selectCalculatedYAxisPadding(state, axisId, isPanorama)
	if (yAxisSettings == null) {
		return { bottom: 0, top: 0 }
	}
	const { padding } = yAxisSettings
	if (typeof padding === "string") {
		return { bottom: calculated, top: calculated }
	}
	return {
		bottom: (padding.bottom ?? 0) + calculated,
		top: (padding.top ?? 0) + calculated,
	}
}

export type AxisRange = readonly [number, number]

export function selectXAxisRange(
	state: ChartState,
	axisId: AxisId,
	isPanorama: boolean,
): AxisRange | undefined {
	const offset = selectChartOffsetInternal(state)
	const padding = selectXAxisPadding(state, axisId, isPanorama)
	const brushDimensions = selectBrushDimensions(state)
	const { padding: brushPadding } = selectBrushSettings(state)
	if (isPanorama) {
		return [brushPadding.left, brushDimensions.width - brushPadding.right]
	}
	return [offset.left + padding.left, offset.left + offset.width - padding.right]
}

export function selectYAxisRange(
	state: ChartState,
	axisId: AxisId,
	isPanorama: boolean,
): AxisRange | undefined {
	const offset = selectChartOffsetInternal(state)
	const layout = selectChartLayout(state)
	const padding = selectYAxisPadding(state, axisId, isPanorama)
	const brushDimensions = selectBrushDimensions(state)
	const { padding: brushPadding } = selectBrushSettings(state)
	if (isPanorama) {
		return [brushDimensions.height - brushPadding.bottom, brushPadding.top]
	}
	if (layout === "horizontal") {
		return [offset.top + offset.height - padding.bottom, offset.top + padding.top]
	}
	return [offset.top + padding.top, offset.top + offset.height - padding.bottom]
}

export const selectAxisRange = (
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): AxisRange | undefined => {
	switch (axisType) {
		case "xAxis":
			return selectXAxisRange(state, axisId, isPanorama)
		case "yAxis":
			return selectYAxisRange(state, axisId, isPanorama)
		case "zAxis":
			return selectZAxisSettings(state, axisId)?.range
		case "angleAxis":
			return selectAngleAxisRange(state)
		case "radiusAxis":
			return selectRadiusAxisRange(state, axisId)
		default:
			return undefined
	}
}

export function selectAxisRangeWithReverse(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): AxisRange | undefined {
	return combineAxisRangeWithReverse(
		selectBaseAxis(state, axisType, axisId),
		selectAxisRange(state, axisType, axisId, isPanorama),
	)
}

export function selectCheckedAxisDomain(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): NumberDomain | CategoricalDomain | undefined {
	return combineCheckedDomain(
		selectRealScaleType(state, axisType, axisId),
		selectAxisDomainIncludingNiceTicks(state, axisType, axisId, isPanorama),
	)
}

function selectConfiguredScale(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): CustomScaleDefinition | undefined {
	return combineConfiguredScale(
		selectBaseAxis(state, axisType, axisId),
		selectRealScaleType(state, axisType, axisId),
		selectCheckedAxisDomain(state, axisType, axisId, isPanorama),
		selectAxisRangeWithReverse(state, axisType, axisId, isPanorama),
	)
}

export const combineCategoricalDomain = (
	layout: LayoutType,
	appliedValues: AppliedChartData,
	axis: RenderableAxisSettings,
	axisType: RenderableAxisType,
): ReadonlyArray<unknown> | undefined => {
	if (axis == null || axis.dataKey == null) {
		return undefined
	}
	const { type, scale } = axis
	const isCategorical = isCategoricalAxis(layout, axisType)
	if (isCategorical && (type === "number" || scale !== "auto")) {
		return appliedValues.map((d) => d.value)
	}
	return undefined
}

export function selectCategoricalDomain(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<unknown> | undefined {
	return combineCategoricalDomain(
		selectChartLayout(state),
		selectAllAppliedValues(state, axisType, axisId, isPanorama),
		selectRenderableAxisSettings(state, axisType, axisId),
		axisType,
	)
}

export function selectAxisScale(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): RechartsScale | undefined {
	return rechartsScaleFactory(selectConfiguredScale(state, axisType, axisId, isPanorama))
}

export function selectAxisInverseScale(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): InverseScaleFunction | undefined {
	return combineInverseScaleFunction(selectConfiguredScale(state, axisType, axisId, isPanorama))
}

export function selectAxisInverseDataSnapScale(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): InverseScaleFunction | undefined {
	return createCategoricalInverse(
		selectConfiguredScale(state, axisType, axisId, isPanorama),
		selectSortedDataPoints(state, axisType, axisId, isPanorama),
	)
}

export function selectErrorBarsSettings(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
): ReadonlyArray<ErrorBarsSettings> {
	return combineRelevantErrorBarSettings(
		selectCartesianItemsSettings(state, axisType, axisId),
		selectAllErrorBarSettings(state),
		axisType as RenderableAxisType,
	)
}

function compareIds(a: CartesianAxisSettings, b: CartesianAxisSettings) {
	if (a.id < b.id) {
		return -1
	}
	if (a.id > b.id) {
		return 1
	}
	return 0
}

function selectAllXAxesWithOffsetType(
	state: ChartState,
	orientation: XAxisOrientation,
	mirror: boolean,
): ReadonlyArray<XAxisSettings> {
	return selectAllXAxes(state)
		.filter((axis) => axis.orientation === orientation)
		.filter((axis) => axis.mirror === mirror)
		.sort(compareIds)
}

function selectAllYAxesWithOffsetType(
	state: ChartState,
	orientation: YAxisOrientation,
	mirror: boolean,
): ReadonlyArray<YAxisSettings> {
	return selectAllYAxes(state)
		.filter((axis) => axis.orientation === orientation)
		.filter((axis) => axis.mirror === mirror)
		.sort(compareIds)
}

const getXAxisSize = (offset: ChartOffsetInternal, axisSettings: XAxisSettings): Size => {
	const height = typeof axisSettings.height === "number" ? axisSettings.height : DEFAULT_X_AXIS_HEIGHT
	return {
		height,
		width: offset.width,
	}
}

const getYAxisSize = (offset: ChartOffsetInternal, axisSettings: YAxisSettings): Size => {
	const width = typeof axisSettings.width === "number" ? axisSettings.width : DEFAULT_Y_AXIS_WIDTH
	return {
		height: offset.height,
		width,
	}
}

export function selectXAxisSize(state: ChartState, xAxisId: AxisId): Size {
	return getXAxisSize(selectChartOffsetInternal(state), selectXAxisSettings(state, xAxisId))
}

type AxisOffsetSteps = Record<AxisId, number>

const combineXAxisPositionStartingPoint = (
	offset: ChartOffsetInternal,
	orientation: XAxisOrientation,
	chartHeight: number,
) => {
	switch (orientation) {
		case "top":
			return offset.top
		case "bottom":
			return chartHeight - offset.bottom
		default:
			return 0
	}
}

const combineYAxisPositionStartingPoint = (
	offset: ChartOffsetInternal,
	orientation: YAxisOrientation,
	chartWidth: number,
) => {
	switch (orientation) {
		case "left":
			return offset.left
		case "right":
			return chartWidth - offset.right
		default:
			return 0
	}
}

export function selectAllXAxesOffsetSteps(
	state: ChartState,
	orientation: XAxisOrientation,
	mirror: boolean,
): AxisOffsetSteps {
	const chartHeight = selectChartHeight(state)
	const offset = selectChartOffsetInternal(state)
	const allAxesWithSameOffsetType = selectAllXAxesWithOffsetType(state, orientation, mirror)

	const steps: AxisOffsetSteps = {}
	let position: number | undefined
	allAxesWithSameOffsetType.forEach((axis) => {
		const axisSize = getXAxisSize(offset, axis)
		if (position == null) {
			position = combineXAxisPositionStartingPoint(offset, orientation, chartHeight)
		}
		const needSpace = (orientation === "top" && !mirror) || (orientation === "bottom" && mirror)
		steps[axis.id] = position - Number(needSpace) * axisSize.height
		position += (needSpace ? -1 : 1) * axisSize.height
	})
	return steps
}

export function selectAllYAxesOffsetSteps(
	state: ChartState,
	orientation: YAxisOrientation,
	mirror: boolean,
): AxisOffsetSteps {
	const chartWidth = selectChartWidth(state)
	const offset = selectChartOffsetInternal(state)
	const allAxesWithSameOffsetType = selectAllYAxesWithOffsetType(state, orientation, mirror)

	const steps: AxisOffsetSteps = {}
	let position: number | undefined
	allAxesWithSameOffsetType.forEach((axis) => {
		const axisSize = getYAxisSize(offset, axis)
		if (position == null) {
			position = combineYAxisPositionStartingPoint(offset, orientation, chartWidth)
		}
		const needSpace = (orientation === "left" && !mirror) || (orientation === "right" && mirror)
		steps[axis.id] = position - Number(needSpace) * axisSize.width
		position += (needSpace ? -1 : 1) * axisSize.width
	})
	return steps
}

const selectXAxisOffsetSteps = (state: ChartState, axisId: AxisId) => {
	const axisSettings = selectXAxisSettings(state, axisId)
	if (axisSettings == null) {
		return undefined
	}
	return selectAllXAxesOffsetSteps(state, axisSettings.orientation, axisSettings.mirror)
}

export function selectXAxisPosition(
	state: ChartState,
	axisId: AxisId,
): Coordinate | undefined {
	const offset = selectChartOffsetInternal(state)
	const axisSettings = selectXAxisSettings(state, axisId)
	const allSteps = selectXAxisOffsetSteps(state, axisId)
	if (axisSettings == null) {
		return undefined
	}
	const stepOfThisAxis = allSteps?.[axisId]
	if (stepOfThisAxis == null) {
		return { x: offset.left, y: 0 }
	}
	return { x: offset.left, y: stepOfThisAxis }
}

const selectYAxisOffsetSteps = (state: ChartState, axisId: AxisId) => {
	const axisSettings = selectYAxisSettings(state, axisId)
	if (axisSettings == null) {
		return undefined
	}
	return selectAllYAxesOffsetSteps(state, axisSettings.orientation, axisSettings.mirror)
}

export function selectYAxisPosition(
	state: ChartState,
	axisId: AxisId,
): Coordinate | undefined {
	const offset = selectChartOffsetInternal(state)
	const axisSettings = selectYAxisSettings(state, axisId)
	const allSteps = selectYAxisOffsetSteps(state, axisId)
	if (axisSettings == null) {
		return undefined
	}
	const stepOfThisAxis = allSteps?.[axisId]
	if (stepOfThisAxis == null) {
		return { x: 0, y: offset.top }
	}
	return { x: stepOfThisAxis, y: offset.top }
}

export function selectYAxisSize(state: ChartState, yAxisId: AxisId): Size {
	const offset = selectChartOffsetInternal(state)
	const axisSettings = selectYAxisSettings(state, yAxisId)
	const width = typeof axisSettings.width === "number" ? axisSettings.width : DEFAULT_Y_AXIS_WIDTH
	return {
		height: offset.height,
		width,
	}
}

export const selectCartesianAxisSize = (
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
): number | undefined => {
	switch (axisType) {
		case "xAxis": {
			return selectXAxisSize(state, axisId).width
		}
		case "yAxis": {
			return selectYAxisSize(state, axisId).height
		}
		default: {
			return undefined
		}
	}
}

export const combineDuplicateDomain = (
	chartLayout: LayoutType,
	appliedValues: AppliedChartData,
	axis: BaseCartesianAxis,
	axisType: AllAxisTypes,
): ReadonlyArray<unknown> | undefined => {
	if (axis == null) {
		return undefined
	}
	const { allowDuplicatedCategory, type, dataKey } = axis
	const isCategorical = isCategoricalAxis(chartLayout, axisType)
	const allData = appliedValues.map((av) => av.value)
	if (
		dataKey &&
		isCategorical &&
		type === "category" &&
		allowDuplicatedCategory &&
		hasDuplicate(allData)
	) {
		return allData
	}
	return undefined
}

export function selectDuplicateDomain(
	state: ChartState,
	axisType: AllAxisTypes,
	axisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<unknown> | undefined {
	return combineDuplicateDomain(
		selectChartLayout(state),
		selectAllAppliedValues(state, axisType, axisId, isPanorama),
		selectBaseAxis(state, axisType, axisId),
		axisType,
	)
}

export function selectAxisPropsNeededForCartesianGridTicksGenerator(
	state: ChartState,
	axisType: "xAxis" | "yAxis",
	axisId: AxisId,
	isPanorama: boolean,
): AxisPropsForCartesianGridTicksGeneration | undefined {
	const layout = selectChartLayout(state)
	const axis = selectCartesianAxisSettings(state, axisType, axisId)
	const realScaleType = selectRealScaleType(state, axisType, axisId)
	const scale = selectAxisScale(state, axisType, axisId, isPanorama)
	const duplicateDomain = selectDuplicateDomain(state, axisType, axisId, isPanorama)
	const categoricalDomain = selectCategoricalDomain(state, axisType, axisId, isPanorama)
	const axisRange = selectAxisRange(state, axisType, axisId, isPanorama)
	const niceTicks = selectNiceTicks(state, axisType, axisId, isPanorama)

	if (axis == null) {
		return undefined
	}
	const isCategorical = isCategoricalAxis(layout, axisType)
	return {
		angle: axis.angle,
		axisType,
		categoricalDomain,
		duplicateDomain,
		interval: axis.interval,
		isCategorical,
		minTickGap: axis.minTickGap,
		niceTicks,
		orientation: axis.orientation,
		range: axisRange,
		realScaleType,
		scale,
		tick: axis.tick,
		tickCount: axis.tickCount,
		tickFormatter: axis.tickFormatter,
		ticks: axis.ticks,
		type: axis.type,
		unit: axis.unit,
	}
}

/**
 * Of on four almost identical implementations of tick generation.
 * The four horsemen of tick generation are:
 * - {@link selectTooltipAxisTicks}
 * - {@link combineAxisTicks}
 * - {@link getTicksOfAxis}.
 * - {@link combineGraphicalItemTicks}
 */
export const combineAxisTicks = (
	layout: LayoutType,
	axis: RenderableAxisSettings,
	realScaleType: D3ScaleType | undefined,
	scale: RechartsScale | undefined,
	niceTicks: ReadonlyArray<number> | undefined,
	axisRange: AxisRange | undefined,
	duplicateDomain: ReadonlyArray<unknown> | undefined,
	categoricalDomain: ReadonlyArray<unknown> | undefined,
	axisType: RenderableAxisType,
): ReadonlyArray<TickItem> | undefined => {
	if (axis == null || scale == null) {
		return undefined
	}

	const isCategorical = isCategoricalAxis(layout, axisType)

	const { type, ticks, tickCount } = axis

	/* mirror upstream dead-code: comparison against "scaleBand" never matches
	   (combineRealScaleType returns "band" instead). Branch is intentionally
	   always-false, so offsetForBand resolves to 2 and the final offset becomes
	   bandwidth/2 — the centered-tick coordinate. Do not "fix" the literal to
	   "band" — that inverts the offset and breaks every band axis. */
	const offsetForBand =
		// @ts-expect-error see comment above — intentional always-false comparison
		realScaleType === "scaleBand" && typeof scale.bandwidth === "function"
			? scale.bandwidth() / 2
			: 2

	let offset = type === "category" && scale.bandwidth ? scale.bandwidth() / offsetForBand : 0

	offset =
		axisType === "angleAxis" && axisRange != null && axisRange.length >= 2
			? mathSign(axisRange[0] - axisRange[1]) * 2 * offset
			: offset

	const ticksOrNiceTicks = ticks || niceTicks
	if (ticksOrNiceTicks) {
		return ticksOrNiceTicks
			.map((entry: AxisTick, index: number): TickItem | null => {
				const scaleContent = duplicateDomain ? duplicateDomain.indexOf(entry) : entry

				const scaled = scale.map(scaleContent)
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

	if (scale.ticks) {
		return scale
			.ticks(tickCount)
			.map((entry: number, index: number): TickItem | null => {
				const scaled = scale.map(entry)
				if (!isWellBehavedNumber(scaled)) {
					return null
				}
				return { coordinate: scaled + offset, index, offset, value: entry }
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

export function selectTicksOfAxis(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): ReadonlyArray<CartesianTickItem> | undefined {
	return combineAxisTicks(
		selectChartLayout(state),
		selectRenderableAxisSettings(state, axisType, axisId),
		selectRealScaleType(state, axisType, axisId),
		selectAxisScale(state, axisType, axisId, isPanorama),
		selectNiceTicks(state, axisType, axisId, isPanorama),
		selectAxisRange(state, axisType, axisId, isPanorama),
		selectDuplicateDomain(state, axisType, axisId, isPanorama),
		selectCategoricalDomain(state, axisType, axisId, isPanorama),
		axisType,
	)
}

/**
 * Of on four almost identical implementations of tick generation.
 * The four horsemen of tick generation are:
 * - {@link selectTooltipAxisTicks}
 * - {@link combineAxisTicks}
 * - {@link getTicksOfAxis}.
 * - {@link combineGraphicalItemTicks}
 */
export const combineGraphicalItemTicks = (
	layout: LayoutType,
	axis: RenderableAxisSettings,
	scale: RechartsScale | undefined,
	axisRange: AxisRange | undefined,
	duplicateDomain: ReadonlyArray<unknown> | undefined,
	categoricalDomain: ReadonlyArray<unknown> | undefined,
	axisType: RenderableAxisType,
): TickItem[] | undefined => {
	if (axis == null || scale == null || axisRange == null || axisRange[0] === axisRange[1]) {
		return undefined
	}
	const isCategorical = isCategoricalAxis(layout, axisType)

	const { tickCount } = axis

	let offset = 0

	offset =
		axisType === "angleAxis" && axisRange?.length >= 2
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

	if (scale.ticks) {
		return scale
			.ticks(tickCount)
			.map((entry: number, index: number): TickItem | null => {
				const scaled = scale.map(entry)
				if (!isWellBehavedNumber(scaled)) {
					return null
				}
				return { coordinate: scaled + offset, index, offset, value: entry }
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

export function selectTicksOfGraphicalItem(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): TickItem[] | undefined {
	return combineGraphicalItemTicks(
		selectChartLayout(state),
		selectRenderableAxisSettings(state, axisType, axisId),
		selectAxisScale(state, axisType, axisId, isPanorama),
		selectAxisRange(state, axisType, axisId, isPanorama),
		selectDuplicateDomain(state, axisType, axisId, isPanorama),
		selectCategoricalDomain(state, axisType, axisId, isPanorama),
		axisType,
	)
}

/**
 * This is the internal representation of an axis along with its scale function.
 * Here we have already computed the scale function for the axis,
 * and replaced the union type of scale (string | function) with just the function type.
 */
export type BaseAxisWithScale = Omit<BaseCartesianAxis, "scale"> & { scale: RechartsScale }

export function selectAxisWithScale(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
	override?: XAxisSettings | YAxisSettings,
): BaseAxisWithScale | undefined {
	const axis = override !== undefined ? override : selectBaseAxis(state, axisType, axisId)
	const scale = selectAxisScale(state, axisType, axisId, isPanorama)
	if (axis == null || scale == null) {
		return undefined
	}
	return {
		...axis,
		scale,
	}
}

function selectZAxisConfiguredScale(
	state: ChartState,
	axisType: "zAxis",
	axisId: AxisId,
	isPanorama: false,
): CustomScaleDefinition | undefined {
	return combineConfiguredScale(
		selectBaseAxis(state, axisType, axisId),
		selectRealScaleType(state, axisType, axisId),
		selectAxisDomain(state, axisType, axisId, isPanorama),
		selectAxisRangeWithReverse(state, axisType, axisId, isPanorama),
	)
}

function selectZAxisScale(
	state: ChartState,
	axisType: "zAxis",
	axisId: AxisId,
	isPanorama: false,
): RechartsScale | undefined {
	return rechartsScaleFactory(selectZAxisConfiguredScale(state, axisType, axisId, isPanorama))
}

export type ZAxisWithScale = Omit<ZAxisSettings, "scale"> & { scale: RechartsScale }

export function selectZAxisWithScale(
	state: ChartState,
	_axisType: "zAxis",
	axisId: AxisId,
	isPanorama: false,
): ZAxisWithScale | undefined {
	const axis = selectZAxisSettings(state, axisId)
	const scale = selectZAxisScale(state, "zAxis", axisId, isPanorama)
	if (axis == null || scale == null) {
		return undefined
	}
	return {
		...axis,
		scale,
	}
}

/**
 * We are also going to need to implement polar chart directions if we want to support keyboard controls for those.
 */
export type AxisDirection = "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top"

export function selectChartDirection(state: ChartState): AxisDirection | undefined {
	const layout = selectChartLayout(state)
	const allXAxes = selectAllXAxes(state)
	const allYAxes = selectAllYAxes(state)

	switch (layout) {
		case "horizontal": {
			return allXAxes.some((axis) => axis.reversed) ? "right-to-left" : "left-to-right"
		}
		case "vertical": {
			return allYAxes.some((axis) => axis.reversed) ? "bottom-to-top" : "top-to-bottom"
		}
		case "centric":
		case "radial": {
			return "left-to-right"
		}
		default: {
			return undefined
		}
	}
}

export function selectAxisInverseTickSnapScale(
	state: ChartState,
	axisType: RenderableAxisType,
	axisId: AxisId,
	isPanorama: boolean,
): InverseScaleFunction | undefined {
	const ticks = selectTicksOfAxis(state, axisType, axisId, isPanorama)
	if (!ticks || ticks.length === 0) {
		return undefined
	}

	return (pixelValue: number) => {
		let minDistance = Infinity
		let closestTick = ticks[0]

		for (const tick of ticks) {
			const distance = Math.abs(tick.coordinate - pixelValue)
			if (distance < minDistance) {
				minDistance = distance
				closestTick = tick
			}
		}
		return closestTick?.value
	}
}
