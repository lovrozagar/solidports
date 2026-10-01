/* eslint-disable import/no-cycle */
import type { AxisId } from "./state/cartesianAxisSlice"
import { defaultAxisId } from "./state/cartesianAxisSlice"
import {
	type BaseAxisWithScale,
	selectAxisDomain,
	selectAxisInverseScale,
	selectAxisInverseDataSnapScale,
	selectAxisInverseTickSnapScale,
	selectAxisScale,
	selectAxisWithScale,
	selectTicksOfAxis,
} from "./state/selectors/axisSelectors"
import { useOptionalChartState } from "./state/useChartState"
import type { ChartState } from "./state/chartState"
import { useIsPanorama } from "./context/PanoramaContext"
import {
	selectActiveLabel,
	selectActiveTooltipCoordinate,
	selectActiveTooltipDataPoints,
} from "./state/selectors/tooltipSelectors"
import type { ChartOffset, PlotArea } from "./types"
import { selectChartOffset } from "./state/selectors/selectChartOffset"
import { selectPlotArea } from "./state/selectors/selectPlotArea"
import type { CategoricalDomain, Coordinate, NumberDomain, CartesianTickItem } from "./util/types"
import type { ActiveLabel } from "./synchronisation/types"
import type { BandPosition } from "./util/scale/RechartsScale"

function useSelectorState(): ChartState | undefined {
	const chart = useOptionalChartState()
	if (chart == null) return undefined
	return chart.state
}

export const useXAxis = (xAxisId: AxisId): BaseAxisWithScale | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisWithScale(state, "xAxis", xAxisId, isPanorama)
}

export const useYAxis = (yAxisId: AxisId): BaseAxisWithScale | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisWithScale(state, "yAxis", yAxisId, isPanorama)
}

/**
 * A function that converts data values to pixel coordinates.
 * @param value - The data value to convert (number, string, or category).
 * @param options - Optional configuration for banded scales.
 * @param options.position - Position within a band: 'start', 'middle', or 'end'.
 * @returns The pixel coordinate, or `undefined` if the value is not in the domain.
 */
export type ScaleFunction = (
	value: unknown,
	options?: { position?: BandPosition },
) => number | undefined

/**
 * A function that converts pixel coordinates back to data values.
 * @param pixelValue - The pixel coordinate to convert.
 * @returns The closest data value in the domain.
 */
export type InverseScaleFunction = (pixelValue: number) => unknown

/**
 * Returns a function to convert data values to pixel coordinates for an {@link XAxis}.
 *
 * This is useful for positioning annotations, custom shapes, or other elements
 * at specific data points on the chart.
 *
 * This hook must be used within a chart context (inside a {@link LineChart}, {@link BarChart}, etc.).
 * Returns `undefined` if used outside a chart context, or if the axes don't exist.
 *
 * Reactive when called inside a tracked scope (JSX, `createMemo`, `createEffect`).
 * See GOTCHA-011.
 *
 * @example
 * ```tsx
 * const xScale = useXAxisScale()
 * if (xScale) {
 *   const pixelX = xScale('Page A')
 * }
 * ```
 *
 * @param xAxisId The `xAxisId` of the XAxis. Defaults to `0` if not provided.
 * @returns A scale function that maps data values to pixel coordinates, or `undefined`.
 * @since 3.8
 */
export const useXAxisScale = (
	xAxisId: AxisId = defaultAxisId,
): ScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	const scale = selectAxisScale(state, "xAxis", xAxisId, isPanorama)
	return scale?.map
}

/**
 * Returns a function to convert data values to pixel coordinates for a {@link YAxis}.
 *
 * This is useful for positioning annotations, custom shapes, or other elements
 * at specific data points on the chart.
 *
 * This hook must be used within a chart context (inside a {@link LineChart}, {@link BarChart}, etc.).
 * Returns `undefined` if used outside a chart context, or if the axes don't exist.
 *
 * @example
 * ```tsx
 * const yScale = useYAxisScale()
 * if (yScale) {
 *   const pixelY = yScale(1500)
 * }
 * ```
 *
 * @param yAxisId The `yAxisId` of the YAxis. Defaults to `0` if not provided.
 * @returns A scale function that maps data values to pixel coordinates, or `undefined`.
 * @since 3.8
 */
export const useYAxisScale = (
	yAxisId: AxisId = defaultAxisId,
): ScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	const scale = selectAxisScale(state, "yAxis", yAxisId, isPanorama)
	return scale?.map
}

/**
 * Returns a function to convert pixel coordinates back to data values for an {@link XAxis}.
 *
 * For continuous (numerical) scales, returns an interpolated value.
 * For categorical scales, returns the closest category in the domain - which is the same behaviour as {@link useXAxisInverseDataSnapScale}.
 *
 * This hook must be used within a chart context (inside a {@link LineChart}, {@link BarChart}, etc.).
 * Returns `undefined` if used outside a chart context, or if the axes don't exist.
 *
 * @param xAxisId The `xAxisId` of the XAxis. Defaults to `0` if not provided.
 * @returns An inverse scale function that maps pixel coordinates to data values, or `undefined`.
 * @since 3.8
 */
export const useXAxisInverseScale = (
	xAxisId: AxisId = defaultAxisId,
): InverseScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisInverseScale(state, "xAxis", xAxisId, isPanorama)
}

/**
 * Returns a function to convert pixel coordinates back to data values for an {@link XAxis},
 * but snapping to the closest data point.
 *
 * @param xAxisId The `xAxisId` of the XAxis. Defaults to `0` if not provided.
 * @returns An inverse scale function that maps pixel coordinates to the closest data value, or `undefined`.
 * @since 3.8
 */
export const useXAxisInverseDataSnapScale = (
	xAxisId: AxisId = defaultAxisId,
): InverseScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisInverseDataSnapScale(state, "xAxis", xAxisId, isPanorama)
}

/**
 * Returns a function to convert pixel coordinates back to data values for an {@link XAxis},
 * but snapping to the closest axis tick.
 *
 * @param xAxisId The `xAxisId` of the XAxis. Defaults to `0` if not provided.
 * @returns An inverse scale function that maps pixel coordinates to the closest tick value, or `undefined`.
 * @since 3.8
 */
export const useXAxisInverseTickSnapScale = (
	xAxisId: AxisId = defaultAxisId,
): InverseScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisInverseTickSnapScale(state, "xAxis", xAxisId, isPanorama)
}

/**
 * Returns a function to convert pixel coordinates back to data values for a {@link YAxis}.
 *
 * @param yAxisId The `yAxisId` of the YAxis. Defaults to `0` if not provided.
 * @returns An inverse scale function that maps pixel coordinates to data values, or `undefined`.
 * @since 3.8
 */
export const useYAxisInverseScale = (
	yAxisId: AxisId = defaultAxisId,
): InverseScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisInverseScale(state, "yAxis", yAxisId, isPanorama)
}

/**
 * Returns a function to convert pixel coordinates back to data values for a {@link YAxis},
 * but snapping to the closest data point.
 *
 * @param yAxisId The `yAxisId` of the YAxis. Defaults to `0` if not provided.
 * @returns An inverse scale function that maps pixel coordinates to the closest data value, or `undefined`.
 * @since 3.8
 */
export const useYAxisInverseDataSnapScale = (
	yAxisId: AxisId = defaultAxisId,
): InverseScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisInverseDataSnapScale(state, "yAxis", yAxisId, isPanorama)
}

/**
 * Returns a function to convert pixel coordinates back to data values for a {@link YAxis},
 * but snapping to the closest axis tick.
 *
 * @param yAxisId The `yAxisId` of the YAxis. Defaults to `0` if not provided.
 * @returns An inverse scale function that maps pixel coordinates to the closest tick value, or `undefined`.
 * @since 3.8
 */
export const useYAxisInverseTickSnapScale = (
	yAxisId: AxisId = defaultAxisId,
): InverseScaleFunction | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisInverseTickSnapScale(state, "yAxis", yAxisId, isPanorama)
}

/**
 * Returns the ticks of an {@link XAxis}.
 *
 * @param xAxisId The `xAxisId` of the XAxis. Defaults to `0` if not provided.
 * @returns An array of ticks, or `undefined` if the axis doesn't exist or hasn't been calculated yet.
 * @since 3.8
 */
export const useXAxisTicks = (
	xAxisId: AxisId = defaultAxisId,
): ReadonlyArray<CartesianTickItem> | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectTicksOfAxis(state, "xAxis", xAxisId, isPanorama)
}

/**
 * Returns the ticks of a {@link YAxis}.
 *
 * @param yAxisId The `yAxisId` of the YAxis. Defaults to `0` if not provided.
 * @returns An array of ticks, or `undefined` if the axis doesn't exist or hasn't been calculated yet.
 * @since 3.8
 */
export const useYAxisTicks = (
	yAxisId: AxisId = defaultAxisId,
): ReadonlyArray<CartesianTickItem> | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectTicksOfAxis(state, "yAxis", yAxisId, isPanorama)
}

/**
 * Data point with x and y values that can be converted to pixel coordinates.
 * The x and y values should be in the same format as your chart data.
 */
export type CartesianDataPoint = {
	x: number | string
	y: number | string
}

/**
 * Converts a data point (in data coordinates) to pixel coordinates.
 *
 * This is a convenience hook that combines {@link useXAxisScale} and {@link useYAxisScale} together in a single call.
 *
 * @example
 * ```tsx
 * const coords = useCartesianScale({ x: 'Page C', y: 2500 })
 * if (coords) {
 *   return <circle cx={coords.x} cy={coords.y} r={5} fill="red" />
 * }
 * ```
 *
 * @param dataPoint The data point with x and y values in data coordinates.
 * @param xAxisId The `xAxisId` of the X-axis. Defaults to `0` if not provided.
 * @param yAxisId The `yAxisId` of the Y-axis. Defaults to `0` if not provided.
 * @returns The pixel x,y coordinates, or `undefined` if conversion is not possible.
 * @since 3.8
 */
export const useCartesianScale = (
	dataPoint: CartesianDataPoint,
	xAxisId: AxisId = defaultAxisId,
	yAxisId: AxisId = defaultAxisId,
): Coordinate | undefined => {
	const xFn = useXAxisScale(xAxisId)
	const yFn = useYAxisScale(yAxisId)

	if (xFn == null || yFn == null) {
		return undefined
	}

	const pixelX = xFn(dataPoint.x)
	const pixelY = yFn(dataPoint.y)

	if (pixelX == null || pixelY == null) {
		return undefined
	}

	return { x: pixelX, y: pixelY }
}

/**
 * Returns the active tooltip label. The label is one of the values from the chart data,
 * and is used to display in the tooltip content.
 *
 * Returns undefined if there is no active user interaction or if used outside a chart context.
 *
 * @returns ActiveLabel
 * @since 3.0
 */
export const useActiveTooltipLabel = (): ActiveLabel => {
	const state = useSelectorState()
	if (state == null) return undefined
	return selectActiveLabel(state)
}

/**
 * Returns the offset of the chart in pixels.
 *
 * Offset defines the blank space between the chart and the plot area.
 * This blank space is occupied by supporting elements like axes, legends, and brushes.
 *
 * The offset includes:
 *
 * - Margins
 * - Width and height of the axes
 * - Width and height of the legend
 * - Brush height
 *
 * If you are interested in the margin alone, use {@link useMargin} instead.
 *
 * The offset is independent of charts position on the page, meaning it does not change as the chart is scrolled or resized.
 *
 * It is also independent of the scale and zoom, meaning that as the user zooms in and out,
 * the numbers will not change as the chart gets visually larger or smaller.
 *
 * This hook must be used within a chart context (inside a `<LineChart>`, `<BarChart>`, etc.).
 * This hook returns `undefined` if used outside a chart context.
 *
 * @returns The chart offset in pixels, or undefined if used outside a chart context.
 * @since 3.1
 */
export const useOffset = (): ChartOffset | undefined => {
	const state = useSelectorState()
	if (state == null) return undefined
	return selectChartOffset(state)
}

/**
 * Plot area is the area where the actual chart data is rendered.
 * This means: bars, lines, scatter points, etc.
 *
 * The plot area is calculated based on the chart dimensions and the offset.
 *
 * Plot area `width` and `height` are the dimensions in pixels;
 * `x` and `y` are the coordinates of the top-left corner of the plot area relative to the chart container.
 *
 * They are also independent of the scale and zoom, meaning that as the user zooms in and out,
 * the plot area dimensions will not change as the chart gets visually larger or smaller.
 *
 * This hook must be used within a chart context (inside a `<LineChart>`, `<BarChart>`, etc.).
 * This hook returns `undefined` if used outside a chart context.
 *
 * @returns The plot area of the chart in pixels, or undefined if used outside a chart context.
 * @since 3.1
 */
export const usePlotArea = (): PlotArea | undefined => {
	const state = useSelectorState()
	if (state == null) return undefined
	return selectPlotArea(state)
}

/**
 * Returns the currently active data points being displayed in the Tooltip.
 * Active means that it is currently visible; this hook will return `undefined` if there is no current interaction.
 *
 * This follows the `<Tooltip />` props, if the Tooltip element is present in the chart.
 * If there is no `<Tooltip />` then this hook will follow the default Tooltip props.
 *
 * Data point is whatever you pass as an input to the chart using the `data={}` prop.
 *
 * This returns an array because a chart can have multiple graphical items in it (multiple Lines for example)
 * and tooltip with `shared={true}` will display all items at the same time.
 *
 * Returns undefined when used outside a chart context.
 *
 * @returns Data points that are currently visible in a Tooltip
 */
export const useActiveTooltipDataPoints = <T = unknown>(): ReadonlyArray<T> | undefined => {
	const state = useSelectorState()
	if (state == null) return undefined
	return selectActiveTooltipDataPoints(state) as ReadonlyArray<T> | undefined
}

/**
 * Returns the calculated domain of an X-axis.
 *
 * The domain can be numerical: `[min, max]`, or categorical: `['a', 'b', 'c']`.
 *
 * @param xAxisId The `xAxisId` of the X-axis. Defaults to `0` if not provided.
 * @returns The domain of the X-axis, or `undefined` if it cannot be calculated or if used outside a chart context.
 * @since 3.2
 */
export const useXAxisDomain = (
	xAxisId: AxisId = defaultAxisId,
): NumberDomain | CategoricalDomain | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisDomain(state, "xAxis", xAxisId, isPanorama)
}

/**
 * Returns the calculated domain of a Y-axis.
 *
 * @param yAxisId The `yAxisId` of the Y-axis. Defaults to `0` if not provided.
 * @returns The domain of the Y-axis, or `undefined` if it cannot be calculated or if used outside a chart context.
 * @since 3.2
 */
export const useYAxisDomain = (
	yAxisId: AxisId = defaultAxisId,
): NumberDomain | CategoricalDomain | undefined => {
	const state = useSelectorState()
	const isPanorama = useIsPanorama()
	if (state == null) return undefined
	return selectAxisDomain(state, "yAxis", yAxisId, isPanorama)
}

/**
 * Returns true if the {@link Tooltip} is currently active (visible).
 *
 * Returns false if the Tooltip is not active or if used outside a chart context.
 *
 * @returns True if the Tooltip is active, false otherwise.
 * @since 3.7
 */
export const useIsTooltipActive = (): boolean => {
	const chart = useOptionalChartState()
	if (chart == null) return false
	return chart.state.tooltip.settings.active === true
}

/**
 * Returns the Cartesian `x` + `y` coordinates of the active {@link Tooltip}.
 *
 * Returns undefined if there is no active user interaction or if used outside a chart context.
 *
 * @returns The coordinate of the active Tooltip, or undefined.
 * @since 3.7
 */
export const useActiveTooltipCoordinate = (): Coordinate | undefined => {
	const chart = useOptionalChartState()
	if (chart == null) return undefined
	if (chart.state.tooltip.settings.active !== true) return undefined
	const coordinate = selectActiveTooltipCoordinate(chart.state)
	return coordinate != null ? { x: coordinate.x, y: coordinate.y } : { x: 0, y: 0 }
}
