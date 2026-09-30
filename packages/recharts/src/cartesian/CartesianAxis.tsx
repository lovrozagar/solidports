/* eslint-disable import/no-cycle, sort-keys */
/**
 * @fileOverview Cartesian Axis
 */
import type { JSX } from "solid-js"
import { createSignal, For, Show } from "solid-js"

import get from "es-toolkit/compat/get"
import { clsx } from "clsx"
import { Layer } from "../container/Layer"
import { Text, Props as TextProps, TextAnchor, TextVerticalAnchor } from "../component/Text"
import {
	CartesianLabelContextProvider,
	ImplicitLabelType,
	CartesianLabelFromLabelProp,
} from "../component/Label"
import { isNumber } from "../util/DataUtils"
import {
	CartesianViewBox,
	adaptEventsOfChild,
	PresentationAttributesAdaptChildEvent,
	CartesianTickItem,
	AxisInterval,
	Coordinate,
	RectangleCoordinate,
	TickProp,
	BaseTickContentProps,
	XAxisTickContentProps,
	YAxisTickContentProps,
} from "../util/types"
import { getTicks } from "./getTicks"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
} from "../util/svgPropertiesNoEvents"
import {
	XAxisOrientation,
	XAxisPadding,
	YAxisOrientation,
	YAxisPadding,
} from "../state/cartesianAxisSlice"
import { RequiresDefaultProps, resolveDefaultProps } from "../util/resolveDefaultProps"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { getClassNameFromUnknown } from "../util/getClassNameFromUnknown"
import { cloneJsxNodeWithProps, isJsxNode } from "../util/ReactUtils"

/** The orientation of the axis in correspondence to the chart */
export type Orientation = XAxisOrientation | YAxisOrientation
/** A unit to be appended to a value */
export type Unit = string | number
/** The formatter function of tick */
export type TickFormatter = (value: unknown, index: number) => string

export interface CartesianAxisProps extends ZIndexable {
	class?: string
	axisType?: "xAxis" | "yAxis"
	x?: number
	y?: number
	width?: number
	height?: number
	unit?: Unit
	orientation?: Orientation
	viewBox?: CartesianViewBox
	tick?: TickProp<unknown>
	/**
	 * Additional props to spread to each tick Text element.
	 * Optional, the CartesianAxis component will provide its own defaults calculated from other props.
	 */
	tickTextProps?: TextProps
	axisLine?: boolean | JSX.LineSVGAttributes<SVGLineElement>
	tickLine?: boolean | JSX.LineSVGAttributes<SVGLineElement>
	mirror?: boolean
	tickMargin?: number
	hide?: boolean
	label?: ImplicitLabelType
	/** Padding information passed to custom tick components */
	padding?: XAxisPadding | YAxisPadding

	minTickGap?: number
	/**
	 * Careful - this is the same name as XAxis + YAxis `ticks` but completely different object!
	 */
	ticks?: ReadonlyArray<CartesianTickItem>
	tickSize?: number
	tickFormatter?: TickFormatter
	interval?: AxisInterval
	/** Angle in which ticks will be rendered. */
	angle?: number
	/**
	 * CartesianAxis reads scale internally and this prop is ignored since 3.0
	 * @deprecated
	 */
	scale?: unknown
	labelRef?: SVGTextElement | null

	ref?: SVGElement | ((el: SVGElement) => void)
}

export interface CartesianAxisRef {
	getCalculatedWidth(): number
}

export const defaultCartesianAxisProps = {
	axisLine: true,
	height: 0,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: false,
	orientation: "bottom",
	stroke: "#666",

	tick: true,
	tickLine: true,
	tickMargin: 2,
	tickSize: 6,
	ticks: [] as CartesianAxisProps["ticks"],

	viewBox: { height: 0, width: 0, x: 0, y: 0 },
	width: 0,
	x: 0,
	y: 0,
	zIndex: DefaultZIndexes.axis,
} as const satisfies Partial<Props>

/*
 * `viewBox` and `scale` are SVG attributes.
 * Recharts however - unfortunately - has its own attributes named `viewBox` and `scale`
 * that are completely different data shape and different purpose.
 */
export type Props = Omit<
	PresentationAttributesAdaptChildEvent<unknown, SVGElement>,
	"viewBox" | "scale" | "ref"
> &
	CartesianAxisProps

type InternalProps = RequiresDefaultProps<Props, typeof defaultCartesianAxisProps>

function AxisLine(axisLineProps: {
	x: number
	y: number
	width: number
	height: number
	orientation: Orientation
	mirror: boolean
	axisLine: boolean | JSX.LineSVGAttributes<SVGLineElement>
	otherSvgProps: JSX.LineSVGAttributes<SVGLineElement> | null
}) {
	/* eslint-disable-next-line solid/reactivity -- axisLine presence is structural (stable at mount) */
	if (!axisLineProps.axisLine) {
		return null
	}

	/* GOTCHA: do NOT spread coordinate values into a plain object here. AxisLine's
	   function body executes once at mount; reads of `axisLineProps.x/y/width/height`
	   inside that body freeze at the initial pass. JSX expression slots with `{}`
	   stay reactive — coords must be passed as accessors so the line re-renders when
	   chart-offset reflows (e.g. legend size dispatch arrives post-mount). */
	const isHorizontal = () =>
		axisLineProps.orientation === "top" || axisLineProps.orientation === "bottom"
	const needHeight = () =>
		Number(
			(axisLineProps.orientation === "top" && !axisLineProps.mirror) ||
				(axisLineProps.orientation === "bottom" && axisLineProps.mirror),
		)
	const needWidth = () =>
		Number(
			(axisLineProps.orientation === "left" && !axisLineProps.mirror) ||
				(axisLineProps.orientation === "right" && axisLineProps.mirror),
		)
	const x1 = () =>
		isHorizontal() ? axisLineProps.x : axisLineProps.x + needWidth() * axisLineProps.width
	const x2 = () =>
		isHorizontal()
			? axisLineProps.x + axisLineProps.width
			: axisLineProps.x + needWidth() * axisLineProps.width
	const y1 = () =>
		isHorizontal()
			? axisLineProps.y + needHeight() * axisLineProps.height
			: axisLineProps.y
	const y2 = () =>
		isHorizontal()
			? axisLineProps.y + needHeight() * axisLineProps.height
			: axisLineProps.y + axisLineProps.height

	const styleProps = (): JSX.LineSVGAttributes<SVGLineElement> => ({
		...axisLineProps.otherSvgProps,
		...svgPropertiesNoEvents(axisLineProps.axisLine),
		fill: "none",
	})

	return (
		<line
			{...styleProps()}
			x1={x1()}
			x2={x2()}
			y1={y1()}
			y2={y2()}
			class={clsx("recharts-cartesian-axis-line", get(axisLineProps.axisLine, "className"))}
		/>
	)
}

/**
 * Calculate the coordinates of endpoints in ticks.
 * @param data The data of a simple tick.
 * @param x The x-coordinate of the axis.
 * @param y The y-coordinate of the axis.
 * @param width The width of the axis.
 * @param height The height of the axis.
 * @param orientation The orientation of the axis.
 * @param tickSize The length of the tick line.
 * @param mirror If true, the ticks are mirrored.
 * @param tickMargin The margin between the tick line and the tick text.
 * @returns An object with `line` and `tick` coordinates.
 * `line` is the coordinates for the tick line, and `tick` is the coordinate for the tick text.
 */
function getTickLineCoord(
	data: CartesianTickItem,
	x: number,
	y: number,
	width: number,
	height: number,
	orientation: Orientation,
	tickSize: number,
	mirror: boolean,
	tickMargin: number,
): {
	line: RectangleCoordinate
	tick: Coordinate
} {
	let x1: number
	let x2: number
	let y1: number
	let y2: number
	let tx: number
	let ty: number

	const sign = mirror ? -1 : 1
	const finalTickSize = data.tickSize || tickSize
	const tickCoord = isNumber(data.tickCoord) ? data.tickCoord : data.coordinate

	switch (orientation) {
		case "top":
			x1 = x2 = data.coordinate
			y2 = y + +!mirror * height
			y1 = y2 - sign * finalTickSize
			ty = y1 - sign * tickMargin
			tx = tickCoord
			break
		case "left":
			y1 = y2 = data.coordinate
			x2 = x + +!mirror * width
			x1 = x2 - sign * finalTickSize
			tx = x1 - sign * tickMargin
			ty = tickCoord
			break
		case "right":
			y1 = y2 = data.coordinate
			x2 = x + +mirror * width
			x1 = x2 + sign * finalTickSize
			tx = x1 + sign * tickMargin
			ty = tickCoord
			break
		default:
			x1 = x2 = data.coordinate
			y2 = y + +mirror * height
			y1 = y2 + sign * finalTickSize
			ty = y1 + sign * tickMargin
			tx = tickCoord
			break
	}

	return { line: { x1, x2, y1, y2 }, tick: { x: tx, y: ty } }
}

/**
 * @param orientation The orientation of the axis.
 * @param mirror If true, the ticks are mirrored.
 * @returns The text anchor of the tick.
 */
function getTickTextAnchor(orientation: Orientation, mirror: boolean): TextAnchor {
	switch (orientation) {
		case "left":
			return mirror ? "start" : "end"
		case "right":
			return mirror ? "end" : "start"
		default:
			return "middle"
	}
}

/**
 * @param orientation The orientation of the axis.
 * @param mirror If true, the ticks are mirrored.
 * @returns The vertical text anchor of the tick.
 */
function getTickVerticalAnchor(orientation: Orientation, mirror: boolean): TextVerticalAnchor {
	switch (orientation) {
		case "left":
		case "right":
			return "middle"
		case "top":
			return mirror ? "start" : "end"
		default:
			return mirror ? "end" : "start"
	}
}

function TickItem(props: { option: Props["tick"]; tickProps: TextProps; value: string }) {
	/* eslint-disable solid/reactivity -- option type is structural (stable at mount); tickProps reads are in JSX spreads below */
	if (typeof props.option === "function") {
		/* tickProps may carry the axis class via Solid `class` alias — accept both. */
		const baseClassName =
			props.tickProps.className ?? (props.tickProps as { class?: string }).class
		const combinedClassName = clsx(baseClassName, "recharts-cartesian-axis-tick-value")
		return <>{props.option({ ...props.tickProps, className: combinedClassName })}</>
	}

	if (isJsxNode(props.option)) {
		return <>{cloneJsxNodeWithProps(props.option, props.tickProps as unknown as Record<string, unknown>) as unknown as JSX.Element}</>
	}

	if (typeof props.option !== "boolean") {
		const className = clsx(
			"recharts-cartesian-axis-tick-value",
			getClassNameFromUnknown(props.option),
		)
		return (
			<Text {...props.tickProps} className={className}>
				{props.value}
			</Text>
		)
	}

	return (
		<Text {...props.tickProps} className="recharts-cartesian-axis-tick-value">
			{props.value}
		</Text>
	)
	/* eslint-enable solid/reactivity */
}

type TicksProps = {
	axisType: "xAxis" | "yAxis" | undefined
	events: Omit<PresentationAttributesAdaptChildEvent<unknown, SVGElement>, "scale" | "viewBox">
	fontSize: string
	getTicksConfig: Omit<Props, "ticks" | "ref">
	height: number
	letterSpacing: string
	mirror: boolean
	orientation: Orientation
	padding?: Props["padding"]
	ref?: SVGGElement | ((el: SVGGElement) => void)
	stroke?: Props["stroke"]
	tick?: Props["tick"]
	tickFormatter?: Props["tickFormatter"]
	tickLine?: Props["tickLine"]
	tickMargin: number
	tickSize: number
	tickTextProps?: Props["tickTextProps"]
	ticks?: ReadonlyArray<CartesianTickItem>
	unit?: Props["unit"]
	width: number
	x: number
	y: number
}

function Ticks(props: TicksProps) {
	const ticks = () => props.ticks ?? []
	const finalTicks = () =>
		getTicks(
			{ ...props.getTicksConfig, ticks: ticks() } as Parameters<typeof getTicks>[0],
			props.fontSize,
			props.letterSpacing,
		)
	const textAnchor = (): TextAnchor => getTickTextAnchor(props.orientation, props.mirror)
	const verticalAnchor = (): TextVerticalAnchor =>
		getTickVerticalAnchor(props.orientation, props.mirror)
	const axisProps = () => svgPropertiesNoEvents(props.getTicksConfig)
	const customTickProps = () => svgPropertiesNoEventsFromUnknown(props.tick)

	const tickLineProps = (): JSX.LineSVGAttributes<SVGLineElement> => {
		let tickLinePropsObject: JSX.LineSVGAttributes<SVGLineElement> = {}
		if (typeof props.tickLine === "object") {
			tickLinePropsObject = props.tickLine
		}
		return {
			...axisProps(),
			fill: "none",
			...tickLinePropsObject,
		}
	}

	const tickLineCoords = () =>
		finalTicks().map((entry: CartesianTickItem) =>
			Object.assign(
				{ entry },
				getTickLineCoord(
					entry,
					props.x,
					props.y,
					props.width,
					props.height,
					props.orientation,
					props.tickSize,
					props.mirror,
					props.tickMargin,
				),
			),
		)

	return (
		<g class={`recharts-cartesian-axis-ticks recharts-${props.axisType}-ticks`}>
			<Show when={tickLineCoords().length > 0}>
				<ZIndexLayer zIndex={DefaultZIndexes.label}>
					<g
						class={`recharts-cartesian-axis-tick-labels recharts-${props.axisType}-tick-labels`}
						ref={props.ref}
					>
						<For each={tickLineCoords()}>
							{({ entry, tick: tickCoord }, i) => {
								const tickProps = (): XAxisTickContentProps | YAxisTickContentProps => {
									/* svgPropertiesNoEvents strips Solid `class` (not an SVG key);
									   bridge to React-style `className` so custom tick fns receive it. */
									const axisClass = (props.getTicksConfig as { class?: string }).class
									return {
										verticalAnchor: verticalAnchor(),
										...axisProps(),
										...(axisClass != null ? { className: axisClass } : {}),
										textAnchor: textAnchor(),
										stroke: "none",
										fill: props.stroke,
										...tickCoord,
										index: i(),
										payload: entry,
										visibleTicksCount: finalTicks().length,
										tickFormatter: props.tickFormatter,
										padding: props.padding,
										...props.tickTextProps,
										angle:
											props.tickTextProps?.angle ??
											(axisProps() as Record<string, unknown>).angle ??
											0,
									} as XAxisTickContentProps | YAxisTickContentProps
								}

								const finalTickProps = (): BaseTickContentProps =>
									({
										...tickProps(),
										...customTickProps(),
									}) as BaseTickContentProps

								return (
									<Layer
										class="recharts-cartesian-axis-tick-label"
										{...adaptEventsOfChild(props.events, entry, i())}
									>
										<Show when={props.tick}>
											<TickItem
												option={props.tick}
												tickProps={finalTickProps()}
												value={`${typeof props.tickFormatter === "function" ? props.tickFormatter(entry.value, i()) : entry.value}${props.unit || ""}`}
											/>
										</Show>
									</Layer>
								)
							}}
						</For>
					</g>
				</ZIndexLayer>
			</Show>
			<Show when={tickLineCoords().length > 0}>
				<g class={`recharts-cartesian-axis-tick-lines recharts-${props.axisType}-tick-lines`}>
					<For each={tickLineCoords()}>
						{({ entry: _entry, line: lineCoord }) => (
							<Layer class="recharts-cartesian-axis-tick">
								<Show when={props.tickLine}>
									<line
										{...tickLineProps()}
										{...lineCoord}
										class={clsx(
											"recharts-cartesian-axis-tick-line",
											get(props.tickLine, "className"),
										)}
									/>
								</Show>
							</Layer>
						)}
					</For>
				</g>
			</Show>
		</g>
	)
}

function CartesianAxisComponent(props: InternalProps) {
	const [fontSize, setFontSize] = createSignal("")
	const [letterSpacing, setLetterSpacing] = createSignal("")
	let _tickRefs: HTMLCollectionOf<Element> | null = null

	const layerRef = (el: SVGGElement) => {
		if (el) {
			const tickNodes = el.getElementsByClassName("recharts-cartesian-axis-tick-value")
			_tickRefs = tickNodes
			const tick: Element | undefined = tickNodes[0]

			if (tick) {
				const computedStyle = window.getComputedStyle(tick)
				const calculatedFontSize = computedStyle.fontSize
				const calculatedLetterSpacing = computedStyle.letterSpacing
				if (calculatedFontSize !== fontSize() || calculatedLetterSpacing !== letterSpacing()) {
					setFontSize(calculatedFontSize)
					setLetterSpacing(calculatedLetterSpacing)
				}
			}
		}
	}

	return (
		<Show
			when={
				!props.hide &&
				!((props.width != null && props.width <= 0) || (props.height != null && props.height <= 0))
			}
		>
			<ZIndexLayer zIndex={props.zIndex}>
				<Layer class={clsx("recharts-cartesian-axis", props.class)}>
					<AxisLine
						x={props.x}
						y={props.y}
						width={props.width}
						height={props.height}
						orientation={props.orientation}
						mirror={props.mirror}
						axisLine={props.axisLine}
						otherSvgProps={(() => {
							const { ref: _ref, ...rest } = svgPropertiesNoEvents(props)
							return rest
						})()}
					/>
					<Ticks
						ref={layerRef}
						axisType={props.axisType}
						events={props}
						fontSize={fontSize()}
						getTicksConfig={props}
						height={props.height}
						letterSpacing={letterSpacing()}
						mirror={props.mirror}
						orientation={props.orientation}
						padding={props.padding}
						stroke={props.stroke}
						tick={props.tick}
						tickFormatter={props.tickFormatter}
						tickLine={props.tickLine}
						tickMargin={props.tickMargin}
						tickSize={props.tickSize}
						tickTextProps={props.tickTextProps}
						ticks={props.ticks}
						unit={props.unit}
						width={props.width}
						x={props.x}
						y={props.y}
					/>
					<CartesianLabelContextProvider
						x={props.x}
						y={props.y}
						width={props.width}
						height={props.height}
						lowerWidth={props.width}
						upperWidth={props.width}
					>
						<CartesianLabelFromLabelProp
							label={props.label}
							labelRef={props.labelRef ?? undefined}
						/>
						{props.children}
					</CartesianLabelContextProvider>
				</Layer>
			</ZIndexLayer>
		</Show>
	)
}

/**
 * @deprecated
 *
 * This component is not meant to be used directly in app code.
 * Use XAxis or YAxis instead.
 *
 * Starting from Recharts v4.0 we will make this component internal only.
 */
export function CartesianAxis(outsideProps: Props) {
	const props = resolveDefaultProps(outsideProps, defaultCartesianAxisProps)
	return <CartesianAxisComponent {...props} />
}

CartesianAxis.displayName = "CartesianAxis"
