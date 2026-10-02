import type {
	AxisDomain,
	AxisInterval,
	AxisTick,
	DataKey,
	EvaluatedAxisDomainType,
	ScaleType,
	TickProp,
} from "../util/types"
import type { TickFormatter } from "../cartesian/CartesianAxis"
import type { AxisRange } from "./selectors/axisSelectors"
import type { CustomScaleDefinition } from "../util/scale/CustomScaleDefinition"

/**
 * @inline
 */
export type AxisId = string | number
export const defaultAxisId: AxisId = 0
export type XAxisPadding = { left?: number; right?: number } | "gap" | "no-gap"
export type YAxisPadding = { top?: number; bottom?: number } | "gap" | "no-gap"

export type XAxisOrientation = "top" | "bottom"
export type YAxisOrientation = "left" | "right"

/**
 * Controls how Recharts calculates "nice" tick values for an axis.
 * - `'auto'` (default): nice ticks for linear numeric axes, extending an `'auto'` domain.
 * - `'adaptive'`: always use the space-efficient algorithm.
 * - `'snap125'`: snap steps to 1, 2, 2.5, 5 at each order of magnitude.
 * - `'none'`: no nice ticks.
 *
 * @inline
 */
export type NiceTicksAlgorithm = "none" | "auto" | "adaptive" | "snap125"

/**
 * Properties shared in X, Y, and Z axes.
 * User defined axis settings, coming from props.
 */
export type BaseCartesianAxis = {
	id: AxisId
	scale:
		| ScaleType
		| CustomScaleDefinition
		| CustomScaleDefinition<string>
		| CustomScaleDefinition<number>
		| CustomScaleDefinition<Date>
	/**
	 * Before creating this object, evaluate the domain type based on the chart layout so that we have the 'auto' resolved.
	 */
	type: EvaluatedAxisDomainType
	/**
	 * The axis functionality is severely restricted without a dataKey
	 * - but there is still something left, and the prop is optional
	 * so this can also be undefined even in real charts.
	 * There are no defaults.
	 */
	dataKey: DataKey<unknown> | undefined
	unit: string | undefined
	name: string | undefined
	allowDuplicatedCategory: boolean
	allowDataOverflow: boolean
	reversed: boolean
	includeHidden: boolean
	domain: AxisDomain | undefined
}

export type TicksSettings = {
	allowDecimals: boolean
	/**
	 * We pass the suggested number of ticks to d3 https://d3js.org/d3-scale/linear#linear_ticks
	 * This number is a suggestion. d3 tries to accommodate it, but it might return more or less ticks than requested:
	 * > The specified count is only a hint; the scale may return more or fewer values depending on the domain.
	 *
	 * If undefined, then d3 decides the number of ticks on its own. The default in d3 is 10,
	 * but it can vary based on the domain size and other factors.
	 */
	tickCount: number | undefined
	/**
	 * Ticks can be any type when the axis is the type of category
	 * Ticks must be numbers when the axis is the type of number
	 */
	ticks: ReadonlyArray<AxisTick> | undefined
	tick: TickProp<unknown>
	/**
	 * Controls how Recharts calculates "nice" tick values for this axis.
	 * See {@link NiceTicksAlgorithm} for a full description of each option.
	 *
	 * @defaultValue 'auto'
	 */
	niceTicks: NiceTicksAlgorithm
}

/**
 * These are the external props, visible for users as they set them using our public API.
 * There is all sorts of internal computed things based on these, but they will come through selectors.
 *
 * Properties shared between X and Y axes
 */
export type CartesianAxisSettings = BaseCartesianAxis &
	TicksSettings & {
		interval: AxisInterval
		mirror: boolean
		minTickGap: number
		angle: number
		hide: boolean
		tickFormatter: TickFormatter | undefined
	}

export type XAxisHeight = number | "auto"

export type XAxisSettings = CartesianAxisSettings & {
	padding: XAxisPadding
	height: XAxisHeight
	orientation: XAxisOrientation
	heightHistory?: number[]
}

export type YAxisWidth = number | "auto"

export type YAxisSettings = CartesianAxisSettings & {
	padding: YAxisPadding
	width: YAxisWidth
	orientation: YAxisOrientation
	widthHistory?: number[]
}

/**
 * Z axis is special because it's never displayed. It controls the size of Scatter dots,
 * but it never displays ticks anywhere.
 */
export type ZAxisSettings = BaseCartesianAxis & {
	range: AxisRange
}

export type AxisMapState = {
	xAxis: Record<AxisId, XAxisSettings>
	yAxis: Record<AxisId, YAxisSettings>
	zAxis: Record<AxisId, ZAxisSettings>
}

