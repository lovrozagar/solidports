/* eslint-disable import/no-cycle */
/**
 * @fileOverview Render a group of error bar
 */
import { createMemo, For, Show } from 'solid-js';
import type { CamelCaseSVGAttrs } from "../util/CamelCaseSVGAttrs"
import type { WithoutRemoveFalse } from "../util/types"
import type { JSX } from '@solidjs/web';
import { Layer } from "../container/Layer"
import type { AnimationTiming, DataKey, RectangleCoordinate } from "../util/types"
import type { BarRectangleItem } from "./Bar"
import type { LinePointItem } from "./Line"
import type { ScatterPointItem } from "./Scatter"
import { ReportErrorBarSettings, useErrorBarContext } from "../context/ErrorBarContext"
import { useXAxis, useYAxis } from "../hooks"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { useChartLayout } from "../context/chartLayoutContext"
import { CSSTransitionAnimate, extractCssEasing } from "../animation/CSSTransitionAnimate"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

import { splitProps } from '../util/solid-1-compat';
export interface ErrorBarDataItem {
	x: number | undefined
	y: number | undefined
	value: number
	errorVal?: number[] | number
}

/**
 * So usually the direction is decided by the chart layout.
 * Horizontal layout means error bars are vertical means direction=y
 * Vertical layout means error bars are horizontal means direction=x
 *
 * Except! In Scatter chart, error bars can go both ways.
 *
 * So this property is only ever used in Scatter chart, and ignored elsewhere.
 */
export type ErrorBarDirection = "x" | "y"

export type ErrorBarDataPointFormatter<
	T extends BarRectangleItem | LinePointItem | ScatterPointItem,
> = (
	entry: T,
	dataKey: DataKey<T, number[] | number>,
	direction: ErrorBarDirection,
) => ErrorBarDataItem

/**
 * External ErrorBar props, visible for users of the library
 */
interface ErrorBarProps<DataPointType = unknown, DataValueType = unknown> extends ZIndexable {
	/**
	 * Decides how to extract the value of this ErrorBar from the data:
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the value of this ErrorBar.
	 *
	 * The error values can be a single value for symmetric error bars;
	 * or an array of a lower and upper error value for asymmetric error bars.
	 */
	dataKey: DataKey<DataPointType, DataValueType>
	/**
	 * Width of the error bar ends (the serifs) in pixels.
	 * This is not the total width of the error bar, but just the width of the little lines at the ends.
	 *
	 * The total width of the error bar is determined by the data value plus/minus the error value.
	 *
	 * @defaultValue 5
	 */
	width?: number
	/**
	 * Direction of the error bar. Usually determined by chart layout, except in Scatter chart.
	 * In Scatter chart, "x" means horizontal error bars, "y" means vertical error bars.
	 */
	direction?: ErrorBarDirection
	/**
	 * If set "auto", animation is disabled during SSR and when the user prefers reduced motion.
	 * @defaultValue true
	 */
	isAnimationActive?: boolean | "auto"
	/**
	 * @defaultValue 0
	 */
	animationBegin?: number
	/**
	 * @defaultValue 400
	 */
	animationDuration?: number
	/**
	 * @defaultValue ease-in-out
	 */
	animationEasing?: AnimationTiming
	/**
	 * The width of the stroke
	 */
	strokeWidth?: number | string
	/**
	 * The stroke color. If "none", no line will be drawn.
	 *
	 * @defaultValue black
	 */
	stroke?: string
	/**
	 * @defaultValue 400
	 */
	zIndex?: number
}

/* React's SVGProps carries the SVG `offset` attribute; Solid's line attributes do not. */
type OffsetAttr = { offset?: number | string }

export type Props = WithoutRemoveFalse<JSX.LineSVGAttributes<SVGLineElement>> &
	CamelCaseSVGAttrs &
	OffsetAttr &
	ErrorBarProps

/**
 * Props after defaults, and required props have been applied.
 */
type ErrorBarInternalProps = WithoutRemoveFalse<JSX.LineSVGAttributes<SVGLineElement>> & OffsetAttr & {
	dataKey: DataKey<unknown>
	/** the width of the error bar ends */
	width: number
	/**
	 * Only used for ScatterChart with error bars in two directions.
	 * Only accepts a value of "x" or "y" and makes the error bars lie in that direction.
	 */
	direction: ErrorBarDirection
	isAnimationActive: boolean | "auto"
	animationBegin: number
	animationDuration: number
	animationEasing: AnimationTiming
}

function ErrorBarImpl(props: ErrorBarInternalProps) {
	const svgProps = () => {
		/* eslint-disable solid/reactivity -- reactive accessor called from JSX; multi-line destructure is inside tracked scope */
		const {
			direction: _direction,
			width: _width,
			dataKey: _dataKey,
			isAnimationActive: _isAnimationActive,
			animationBegin: _animationBegin,
			animationDuration: _animationDuration,
			animationEasing: _animationEasing,
			...others
		} = props
		/* eslint-enable solid/reactivity */
		const { ref: _ref, ...noRef } = svgPropertiesNoEvents(others)
		return noRef
	}

	/* ctx is now an Accessor (GOTCHA-005-A). Each `ctx()` re-reads through the
	   reactive Provider value so data/formatter/offset stay live as parent
	   computes rectangles/points. */
	const ctx = useErrorBarContext()
	const xAxis = createMemo(() => useXAxis(ctx().xAxisId))
	const yAxis = createMemo(() => useYAxis(ctx().yAxisId))

	return (
		<Show when={xAxis()?.scale != null && yAxis()?.scale != null && ctx().data != null}>
			<Show when={props.direction !== "x" || xAxis()?.type === "number"}>
				<Layer class="recharts-errorBars">
					<For each={ctx().data as ReadonlyArray<unknown>}>
						{(entry: unknown, _dataIndex) => {
							const formatted = () =>
								ctx().dataPointFormatter(
									entry as BarRectangleItem | LinePointItem | ScatterPointItem,
									props.dataKey as DataKey<
										BarRectangleItem | LinePointItem | ScatterPointItem,
										number[] | number
									>,
									props.direction,
								)
							const errorVal = () => formatted().errorVal
							const x = () => formatted().x
							const y = () => formatted().y
							const value = () => formatted().value

							const lineCoordinates = (): Array<RectangleCoordinate> => {
								if (errorVal() == null || x() == null || y() == null) {
									return []
								}

								const ev = errorVal()
								let lowBound: number
								let highBound: number

								if (Array.isArray(ev)) {
									const [low, high] = ev
									if (low == null || high == null) {
										return []
									}
									lowBound = low
									highBound = high
								} else {
									lowBound = ev as number
									highBound = ev as number
								}

								const coords: Array<RectangleCoordinate> = []
								const offset = ctx().errorBarOffset

								if (props.direction === "x") {
									const scale = xAxis()?.scale
									const yMid = (y() as number) + offset
									const yMin = yMid + props.width
									const yMax = yMid - props.width
									const xMin = scale?.map(value() - lowBound)
									const xMax = scale?.map(value() + highBound)

									if (xMin != null && xMax != null) {
										coords.push({ x1: xMax, x2: xMax, y1: yMin, y2: yMax })
										coords.push({ x1: xMin, x2: xMax, y1: yMid, y2: yMid })
										coords.push({ x1: xMin, x2: xMin, y1: yMin, y2: yMax })
									}
								} else if (props.direction === "y") {
									const scale = yAxis()?.scale
									const xMid = (x() as number) + offset
									const xMin = xMid - props.width
									const xMax = xMid + props.width
									const yMin = scale?.map(value() - lowBound)
									const yMax = scale?.map(value() + highBound)

									if (yMin != null && yMax != null) {
										coords.push({ x1: xMin, x2: xMax, y1: yMax, y2: yMax })
										coords.push({ x1: xMid, x2: xMid, y1: yMin, y2: yMax })
										coords.push({ x1: xMin, x2: xMax, y1: yMin, y2: yMin })
									}
								}

								return coords
							}

							const scaleDirection = () => (props.direction === "x" ? "scaleX" : "scaleY")
							const transformOrigin = () =>
								`${(x() as number) + ctx().errorBarOffset}px ${(y() as number) + ctx().errorBarOffset}px`

							return (
								<Show when={lineCoordinates().length > 0}>
									<Layer class="recharts-errorBar" {...svgProps()}>
										<For each={lineCoordinates()}>
											{(c, _lineIndex) => {
												const lineStyle = () =>
													props.isAnimationActive
														? { "transform-origin": transformOrigin() }
														: undefined
												return (
													<CSSTransitionAnimate
														animationId={`error-bar-${props.direction}_${c.x1}-${c.x2}-${c.y1}-${c.y2}`}
														from={`${scaleDirection()}(0)`}
														to={`${scaleDirection()}(1)`}
														attributeName="transform"
														begin={props.animationBegin}
														easing={extractCssEasing(props.animationEasing)}
														isActive={props.isAnimationActive}
														duration={props.animationDuration}
													>
														{(style: Record<string, string | number> | undefined) => (
															<line
																{...c}
																style={{ ...lineStyle(), ...style }}
															/>
														)}
													</CSSTransitionAnimate>
												)
											}}
										</For>
									</Layer>
								</Show>
							)
						}}
					</For>
				</Layer>
			</Show>
		</Show>
	)
}

function useErrorBarDirection(
	directionFromProps: ErrorBarDirection | undefined,
): ErrorBarDirection {
	const layout = useChartLayout()
	if (directionFromProps != null) {
		return directionFromProps
	}
	if (layout != null) {
		return layout === "horizontal" ? "y" : "x"
	}
	return "x"
}

/* Upstream key order: defaults spread into the layer, so the order sets DOM attribute order. */
/* eslint-disable sort-keys */
export const errorBarDefaultProps = {
	stroke: "black",
	strokeWidth: 1.5,
	width: 5,
	offset: 0,
	isAnimationActive: true,
	animationBegin: 0,
	animationDuration: 400,
	animationEasing: "ease-in-out",
	zIndex: DefaultZIndexes.line,
} as const satisfies Partial<Props>
/* eslint-enable sort-keys */

/**
 * ErrorBar renders whiskers to represent error margins on a chart.
 *
 * It must be a child of a graphical element.
 *
 * ErrorBar expects data in one of the following forms:
 * - Symmetric error bars: a single error value representing both lower and upper bounds.
 * - Asymmetric error bars: an array of two values representing lower and upper bounds separately. First value is the lower bound, second value is the upper bound.
 *
 * The values provided are relative to the main data value.
 * For example, if the main data value is 10 and the error value is 2,
 * the error bar will extend from 8 to 12 for symmetric error bars.
 *
 * In other words, what ErrorBar will render is:
 * - For symmetric error bars: [value - errorVal, value + errorVal]
 * - For asymmetric error bars: [value - errorVal[0], value + errorVal[1]]
 *
 * In stacked or ranged Bar charts, ErrorBar will use the higher data value
 * as the reference point for calculating the error bar positions.
 *
 * @consumes ErrorBarContext
 */
export function ErrorBar(outsideProps: Props) {
	const realDirection = createMemo(() => useErrorBarDirection(outsideProps.direction))
	/* GOTCHA-013: split children before resolveDefaultProps. resolveDefaultProps
	   does `{...realProps}` which enumerates own keys of the Solid props proxy —
	   children are not part of ErrorBar's public API, but extra spread keys are
	   still resolved through proxy getters at setup. Strip first to keep the
	   resolved props plain and stable. */
	const [, restProps] = splitProps(outsideProps, ["children"])
	const props = resolveDefaultProps(restProps, errorBarDefaultProps)

	return (
		<>
			<ReportErrorBarSettings dataKey={props.dataKey} direction={realDirection()} />
			<ZIndexLayer zIndex={props.zIndex}>
				<ErrorBarImpl
					{...props}
					direction={realDirection()}
					width={props.width}
					isAnimationActive={props.isAnimationActive}
					animationBegin={props.animationBegin}
					animationDuration={props.animationDuration}
					animationEasing={props.animationEasing}
				/>
			</ZIndexLayer>
		</>
	)
}

ErrorBar.displayName = "ErrorBar"
