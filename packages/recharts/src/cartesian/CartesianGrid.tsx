/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import type { CamelCaseSVGAttrs } from "../util/CamelCaseSVGAttrs"
import type { WithoutRemoveFalse } from "../util/types"
import { createMemo, For, Show } from 'solid-js';
import { warn } from "../util/LogUtils"
import { isNumber } from "../util/DataUtils"
import { ChartOffsetInternal } from "../util/types"

import {
	AxisPropsNeededForTicksGenerator,
	getCoordinatesOfGrid,
	getTicksOfAxis,
} from "../util/ChartUtils"
import { getTicks, GetTicksInput } from "./getTicks"
import { defaultCartesianAxisProps } from "./CartesianAxis"
import { useChartHeight, useChartWidth, useOffsetInternal } from "../context/chartLayoutContext"
import { AxisId } from "../state/cartesianAxisSlice"
import { selectAxisPropsNeededForCartesianGridTicksGenerator } from "../state/selectors/axisSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { useIsPanorama } from "../context/PanoramaContext"
import { RequiresDefaultProps, resolveDefaultProps } from "../util/resolveDefaultProps"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { isPositiveNumber } from "../util/isWellBehavedNumber"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

import { splitProps } from '../util/solid-1-compat';
import { useRechartsTheme } from "../theme/RechartsThemeContext"
/**
 * The <CartesianGrid horizontal
 */
export type GridLineTypeFunctionProps = Omit<LineItemProps, "key"> & {
	key: LineItemProps["key"] | undefined
	offset: ChartOffsetInternal
}

export type AxisPropsForCartesianGridTicksGeneration = AxisPropsNeededForTicksGenerator &
	Omit<GetTicksInput, "ticks" | "viewBox">

type GridLineType =
	| JSX.LineSVGAttributes<SVGLineElement>
	| JSX.Element
	| ((props: GridLineTypeFunctionProps) => JSX.Element)
	| boolean

export type HorizontalCoordinatesGenerator = (
	props: {
		yAxis: AxisPropsForCartesianGridTicksGeneration | undefined
		width: number
		height: number
		offset: ChartOffsetInternal
	},
	syncWithTicks: boolean,
) => number[]

export type VerticalCoordinatesGenerator = (
	props: {
		xAxis: AxisPropsForCartesianGridTicksGeneration | undefined
		width: number
		height: number
		offset: ChartOffsetInternal
	},
	syncWithTicks: boolean,
) => number[]

interface CartesianGridProps extends ZIndexable {
	/**
	 * The width of grid. If undefined, covers the full width of the chart plot area.
	 */
	width?: number
	/**
	 * The height of grid. If undefined, covers the full height of the chart plot area.
	 */
	height?: number
	/**
	 * A function that generates the y-coordinates of all horizontal lines.
	 *
	 * @see {@link https://codesandbox.io/p/sandbox/cartesian-grid-with-coordinate-generators-my38cg?file=%2Fsrc%2FApp.tsx Cartesian grid with coordinate generators}
	 */
	horizontalCoordinatesGenerator?: HorizontalCoordinatesGenerator
	/**
	 * A function that generates the x-coordinates of all vertical lines.
	 *
	 * @see {@link https://codesandbox.io/p/sandbox/cartesian-grid-with-coordinate-generators-my38cg?file=%2Fsrc%2FApp.tsx Cartesian grid with coordinate generators}
	 */
	verticalCoordinatesGenerator?: VerticalCoordinatesGenerator
	/**
	 * The x-coordinate of grid.
	 * If left undefined, it will be computed from the chart's offset and margins.
	 */
	x?: number
	/**
	 * The y-coordinate of grid.
	 * If left undefined, it will be computed from the chart's offset and margins.
	 */
	y?: number
	/**
	 * If set false, no horizontal grid lines will be drawn.
	 *
	 * @defaultValue true
	 */
	horizontal?: GridLineType
	/**
	 * If set false, no vertical grid lines will be drawn.
	 *
	 * @defaultValue true
	 */
	vertical?: GridLineType
	/**
	 * Array of coordinates in pixels where to draw horizontal grid lines.
	 * Has priority over syncWithTicks and horizontalValues.
	 *
	 * @defaultValue []
	 */
	horizontalPoints?: number[]
	/**
	 * Array of coordinates in pixels where to draw vertical grid lines.
	 * Has priority over syncWithTicks and verticalValues.
	 *
	 * @defaultValue []
	 */
	verticalPoints?: number[]
	/**
	 * The background color used to fill the space between grid lines
	 *
	 * @defaultValue none
	 * @example <CartesianGrid fill="red" />
	 * @example <CartesianGrid fill="#ccc" />
	 */
	fill?: string
	/**
	 * The opacity of the background used to fill the space between grid lines
	 *
	 * @example <CartesianGrid fill="red" fillOpacity={0.6} />
	 */
	fillOpacity?: number | string
	/**
	 * Defines background color of stripes.
	 *
	 * The values from this array will be passed in as the `fill` property in a `rect` SVG element.
	 * For possible values see: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill#rect
	 *
	 * In case there are more stripes than colors, the colors will start from beginning.
	 * So for example: verticalFill['yellow', 'black'] produces a pattern of yellow|black|yellow|black
	 *
	 * If this is undefined, or an empty array, then there is no background fill.
	 * Note: Grid lines will be rendered above these background stripes.
	 *
	 * @defaultValue []
	 */
	verticalFill?: string[]
	/**
	 * Defines background color of stripes.
	 *
	 * The values from this array will be passed in as the `fill` property in a `rect` SVG element.
	 * For possible values see: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill#rect
	 *
	 * In case there are more stripes than colors, the colors will start from beginning.
	 * So for example: horizontalFill['yellow', 'black'] produces a pattern of yellow|black|yellow|black
	 *
	 * If this is undefined, or an empty array, then there is no background fill.
	 * Note: Grid lines will be rendered above these background stripes.
	 *
	 * @defaultValue []
	 */
	horizontalFill?: string[]
	/**
	 * If true, only the lines that correspond to the axes ticks values will be drawn.
	 * If false, extra lines could be added for each axis (at min and max coordinates), if there will not such ticks.
	 * horizontalPoints, verticalPoints, horizontalValues, verticalValues have priority over syncWithTicks.
	 *
	 * @defaultValue false
	 */
	syncWithTicks?: boolean
	/**
	 * Array of values, where horizontal lines will be drawn. Numbers or strings, in dependence on axis type.
	 * Has priority over syncWithTicks but not over horizontalPoints.
	 */
	horizontalValues?: number[] | string[]
	/**
	 * Array of values, where vertical lines will be drawn. Numbers or strings, in dependence on axis type.
	 * Has priority over syncWithTicks but not over verticalPoints.
	 */
	verticalValues?: number[] | string[]
	/**
	 * The pattern of dashes and gaps used to paint the lines of the grid
	 *
	 * @example <CartesianGrid strokeDasharray="3 3" />
	 * @example <CartesianGrid strokeDasharray={[5, 5, 1, 5]} />
	 * @example <CartesianGrid strokeDasharray="5 5 1 5" />
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray stroke-dasharray on MDN}
	 */
	strokeDasharray?: string | number | ReadonlyArray<number>
	/**
	 * The id of XAxis which is corresponding to the data. Required when there are multiple XAxes.
	 * @defaultValue 0
	 */
	xAxisId?: AxisId
	/**
	 * The id of YAxis which is corresponding to the data. Required when there are multiple YAxes.
	 * @defaultValue 0
	 */
	yAxisId?: AxisId
	/**
	 * @defaultValue -100
	 */
	zIndex?: number
}

type AcceptedSvgProps = WithoutRemoveFalse<Omit<JSX.LineSVGAttributes<SVGLineElement>, "offset" | "stroke-dasharray">> &
	Omit<CamelCaseSVGAttrs, "strokeDasharray">

export type Props = AcceptedSvgProps & CartesianGridProps

type CartesianGridInternalProps = AcceptedSvgProps &
	RequiresDefaultProps<CartesianGridProps, typeof defaultCartesianGridProps> & {
		x: number
		y: number
		width: number
		height: number
	}

function Background(props: {
	fill?: string | number
	fillOpacity?: string | number
	x?: string | number
	y?: string | number
	width?: string | number
	height?: string | number
	ry?: string | number
}) {
	return (
		<Show when={props.fill && props.fill !== "none"}>
			<rect
				x={props.x}
				y={props.y}
				ry={props.ry}
				width={props.width}
				height={props.height}
				stroke="none"
				fill={String(props.fill)}
				fill-opacity={props.fillOpacity}
				class="recharts-cartesian-grid-bg"
			/>
		</Show>
	)
}

type LineItemProps = Props & {
	offset: ChartOffsetInternal
	xAxis: undefined | AxisPropsForCartesianGridTicksGeneration
	yAxis: undefined | AxisPropsForCartesianGridTicksGeneration
	x1: number
	y1: number
	x2: number
	y2: number
	key: string
	index: number
}

/* eslint-disable solid/reactivity -- plain utility fn; lineItemProps is not a Solid reactive proxy at this call site */
function renderDefaultLine(lineItemProps: LineItemProps) {
	const { x1, y1, x2, y2, key: _key, ...others } = lineItemProps
	const { offset: __, ...restOfFilteredProps } = svgPropertiesNoEvents(others) ?? {}
	return <line {...restOfFilteredProps} x1={x1} y1={y1} x2={x2} y2={y2} fill="none" />
}
/* eslint-enable solid/reactivity */

/* React `cloneElement(option, props)` produces a fresh vNode per call; Solid
 * JSX evaluates eagerly to a Node, so the same returned reference cannot be
 * inserted twice (DOM moves it). When the option is a function whose return
 * is a stable Node ref (e.g. `vi.fn().mockReturnValue(<g />)`, or a JSX literal
 * passed as `horizontal={<X />}`), clone the resulting node so each iteration
 * gets its own subtree. Returns from real component fns are usually fresh per
 * call and clone is a cheap no-op shape on those. */
function cloneIfNode(value: unknown): unknown {
	if (value != null && typeof value === "object" && "cloneNode" in value) {
		return (value as Node).cloneNode(true)
	}
	return value
}

/* eslint-disable solid/reactivity -- itemProps reads are structural type checks at component setup; LineItem is called once per grid line, not in a reactive context */
function LineItem(itemProps: { option: GridLineType; lineItemProps: LineItemProps }): JSX.Element {
	return <>{renderLineItem(itemProps)}</>
}

/* Runs inside LineItem's JSX expression so every reactive read is tracked. */
function renderLineItem(itemProps: { option: GridLineType; lineItemProps: LineItemProps }) {
	if (typeof itemProps.option === "function") {
		const fn = itemProps.option
		const fnProps: GridLineTypeFunctionProps = {
			...itemProps.lineItemProps,
			key: itemProps.lineItemProps.key,
			offset: itemProps.lineItemProps.offset,
		}
		return <>{cloneIfNode(fn(fnProps)) as JSX.Element}</>
	}
	if (itemProps.option != null && typeof itemProps.option === "object" && "cloneNode" in (itemProps.option as object)) {
		return <>{(itemProps.option as Node).cloneNode(true) as unknown as JSX.Element}</>
	}

	return renderDefaultLine(itemProps.lineItemProps)
}
/* eslint-enable solid/reactivity */

type GridLinesProps = CartesianGridInternalProps & {
	offset: GridLineTypeFunctionProps["offset"]
	xAxis: GridLineTypeFunctionProps["xAxis"]
	yAxis: GridLineTypeFunctionProps["yAxis"]
}

function HorizontalGridLines(props: GridLinesProps) {
	const horizontal = () => props.horizontal ?? true
	const horizontalPoints = () => props.horizontalPoints
	/* Mirrors upstream: `const { xAxisId, yAxisId, ...otherLineItemProps } = props`.
	 * The internal `LineItemProps` shape consumed by user-supplied vertical/horizontal
	 * render functions does not carry axis ids — those live in CartesianGrid's own
	 * default-resolved props and are stripped before forwarding. */
	const [, otherProps] = splitProps(props, ["xAxisId", "yAxisId"])

	return (
		<Show when={horizontal() && horizontalPoints() && horizontalPoints()?.length}>
			<g class="recharts-cartesian-grid-horizontal">
				<For each={horizontalPoints()}>
					{(entry, i) => {
						const lineItemProps = (): LineItemProps => ({
							...otherProps,
							index: i(),
							key: `line-${i()}`,
							x1: props.x,
							x2: props.x + props.width,
							y1: entry,
							y2: entry,
						})

						return <LineItem option={horizontal()} lineItemProps={lineItemProps()} />
					}}
				</For>
			</g>
		</Show>
	)
}

function VerticalGridLines(props: GridLinesProps) {
	const vertical = () => props.vertical ?? true
	const verticalPoints = () => props.verticalPoints
	const [, otherProps] = splitProps(props, ["xAxisId", "yAxisId"])

	return (
		<Show when={vertical() && verticalPoints() && verticalPoints()?.length}>
			<g class="recharts-cartesian-grid-vertical">
				<For each={verticalPoints()}>
					{(entry, i) => {
						const lineItemProps = (): LineItemProps => ({
							...otherProps,
							index: i(),
							key: `line-${i()}`,
							x1: entry,
							x2: entry,
							y1: props.y,
							y2: props.y + props.height,
						})

						return <LineItem option={vertical()} lineItemProps={lineItemProps()} />
					}}
				</For>
			</g>
		</Show>
	)
}

function HorizontalStripes(props: CartesianGridInternalProps) {
	const horizontal = () => props.horizontal ?? true

	const sortedPoints = () => {
		if (
			!horizontal() ||
			!props.horizontalFill ||
			!props.horizontalFill.length ||
			props.horizontalPoints == null
		) {
			return null
		}
		const rounded = props.horizontalPoints
			.map((e) => Math.round(e + props.y - props.y))
			.sort((a, b) => a - b)
		if (props.y !== rounded[0]) {
			rounded.unshift(0)
		}
		return rounded
	}

	/* eslint-disable solid/reactivity -- i() is the <For> index accessor; reads inside the For callback ARE tracked */
	/* Runs inside a JSX expression so prop and store reads are tracked. */
	const renderHorizontalStripe = (entry: number, i: number): JSX.Element => {
		const pts = sortedPoints()
		if (pts == null) return null
		const nextPoint = pts[i + 1]
		const lastStripe = nextPoint == null
		const lineHeight = lastStripe ? props.y + props.height - entry : nextPoint - entry
		if (lineHeight <= 0) {
			return null
		}
		const colorIndex = i % (props.horizontalFill?.length ?? 1)
		return (
			<rect
				y={entry}
				x={props.x}
				height={lineHeight}
				width={props.width}
				stroke="none"
				fill={props.horizontalFill?.[colorIndex]}
				fill-opacity={props.fillOpacity}
				class="recharts-cartesian-grid-bg"
			/>
		)
	}

	return (
		<Show when={sortedPoints()}>
			<g class="recharts-cartesian-gridstripes-horizontal">
				<For each={sortedPoints()}>
					{(entry, i) => <>{renderHorizontalStripe(entry, i())}</>}
				</For>
			</g>
		</Show>
	)
	/* eslint-enable solid/reactivity */
}

function VerticalStripes(props: CartesianGridInternalProps) {
	const vertical = () => props.vertical ?? true

	const sortedPoints = () => {
		if (!vertical() || !props.verticalFill || !props.verticalFill.length) {
			return null
		}
		const rounded = props.verticalPoints
			.map((e) => Math.round(e + props.x - props.x))
			.sort((a, b) => a - b)
		if (props.x !== rounded[0]) {
			rounded.unshift(0)
		}
		return rounded
	}

	/* eslint-disable solid/reactivity -- i() is the <For> index accessor; reads inside the For callback ARE tracked */
	/* Runs inside a JSX expression so prop and store reads are tracked. */
	const renderVerticalStripe = (entry: number, i: number): JSX.Element => {
		const pts = sortedPoints()
		if (pts == null) return null
		const nextPoint = pts[i + 1]
		const lastStripe = nextPoint == null
		const lineWidth = lastStripe ? props.x + props.width - entry : nextPoint - entry
		if (lineWidth <= 0) {
			return null
		}
		const colorIndex = i % (props.verticalFill?.length ?? 1)
		return (
			<rect
				x={entry}
				y={props.y}
				width={lineWidth}
				height={props.height}
				stroke="none"
				fill={props.verticalFill?.[colorIndex]}
				fill-opacity={props.fillOpacity}
				class="recharts-cartesian-grid-bg"
			/>
		)
	}

	return (
		<Show when={sortedPoints()}>
			<g class="recharts-cartesian-gridstripes-vertical">
				<For each={sortedPoints()}>
					{(entry, i) => <>{renderVerticalStripe(entry, i())}</>}
				</For>
			</g>
		</Show>
	)
	/* eslint-enable solid/reactivity */
}

const defaultVerticalCoordinatesGenerator: VerticalCoordinatesGenerator = (
	{ xAxis, width, height, offset },
	syncWithTicks,
) =>
	getCoordinatesOfGrid(
		getTicks({
			...defaultCartesianAxisProps,
			...xAxis,
			ticks: getTicksOfAxis(xAxis, true),
			viewBox: { height, width, x: 0, y: 0 },
		}),
		offset.left,
		offset.left + offset.width,
		syncWithTicks,
	)

const defaultHorizontalCoordinatesGenerator: HorizontalCoordinatesGenerator = (
	{ yAxis, width, height, offset },
	syncWithTicks,
) =>
	getCoordinatesOfGrid(
		getTicks({
			...defaultCartesianAxisProps,
			...yAxis,
			ticks: getTicksOfAxis(yAxis, true),
			viewBox: { height, width, x: 0, y: 0 },
		}),
		offset.top,
		offset.top + offset.height,
		syncWithTicks,
	)

export const defaultCartesianGridProps = {
	horizontal: true,
	horizontalFill: [],
	horizontalPoints: [],
	syncWithTicks: false,
	vertical: true,
	verticalFill: [],
	verticalPoints: [],
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.grid,
} as const satisfies Partial<Props>

/**
 * Renders background grid with lines and fill colors in a Cartesian chart.
 *
 * @consumes CartesianChartContext
 */
export function CartesianGrid(outsideProps: Props) {
	/* All hooks now bare T (GOTCHA-011). Arrow-thunk pattern keeps existing
	   `()` callsites valid and re-runs the selector under each reactive scope. */
	const chartWidth = createMemo(() => useChartWidth())
	const chartHeight = createMemo(() => useChartHeight())
	const offset = createMemo(() => useOffsetInternal())
	const theme = useRechartsTheme()
	const propsIncludingDefaults = createMemo((): CartesianGridInternalProps => ({
		...resolveDefaultProps(outsideProps, defaultCartesianGridProps),
		/* Grid colors fall back to the active theme (legacyTheme matches the 3.x defaults). */
		fill: outsideProps.fill ?? theme.grid.fill,
		fillOpacity: outsideProps.fillOpacity ?? theme.grid.fillOpacity,
		stroke: outsideProps.stroke ?? theme.grid.stroke,
		strokeDasharray: outsideProps.strokeDasharray ?? theme.grid.strokeDasharray,
		strokeOpacity: outsideProps.strokeOpacity ?? theme.grid.strokeOpacity,
		strokeWidth: outsideProps.strokeWidth ?? theme.grid.strokeWidth,
		height: isNumber(outsideProps.height) ? outsideProps.height : offset().height,
		width: isNumber(outsideProps.width) ? outsideProps.width : offset().width,
		x: isNumber(outsideProps.x) ? outsideProps.x : offset().left,
		y: isNumber(outsideProps.y) ? outsideProps.y : offset().top,
	}))

	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const xAxis = (): AxisPropsForCartesianGridTicksGeneration | undefined =>
		ctx
			? selectAxisPropsNeededForCartesianGridTicksGenerator(
					ctx.store,
					"xAxis",
					propsIncludingDefaults().xAxisId,
					isPanorama,
				)
			: undefined
	const yAxis = (): AxisPropsForCartesianGridTicksGeneration | undefined =>
		ctx
			? selectAxisPropsNeededForCartesianGridTicksGenerator(
					ctx.store,
					"yAxis",
					propsIncludingDefaults().yAxisId,
					isPanorama,
				)
			: undefined

	const computedPoints = createMemo(() => {
		const p = propsIncludingDefaults()
		const { x, y, width, height, syncWithTicks, horizontalValues, verticalValues } = p

		if (!isPositiveNumber(width) || !isPositiveNumber(height) || !isNumber(x) || !isNumber(y)) {
			return null
		}

		const verticalCoordinatesGenerator =
			p.verticalCoordinatesGenerator || defaultVerticalCoordinatesGenerator
		const horizontalCoordinatesGenerator =
			p.horizontalCoordinatesGenerator || defaultHorizontalCoordinatesGenerator

		let horizontalPoints = p.horizontalPoints
		let verticalPoints = p.verticalPoints

		if (
			(!horizontalPoints || !horizontalPoints.length) &&
			typeof horizontalCoordinatesGenerator === "function"
		) {
			const isHorizontalValues = horizontalValues && horizontalValues.length

			const generatorResult = horizontalCoordinatesGenerator(
				{
					height: chartHeight() ?? height,
					offset: offset(),
					width: chartWidth() ?? width,
					yAxis: yAxis()
						? ({
								...yAxis(),
								scale: yAxis()?.scale ?? undefined,
								ticks: isHorizontalValues ? horizontalValues : yAxis()?.ticks,
							} as AxisPropsForCartesianGridTicksGeneration)
						: undefined,
				},
				isHorizontalValues ? true : syncWithTicks,
			)

			warn(
				Array.isArray(generatorResult),
				`horizontalCoordinatesGenerator should return Array but instead it returned [${typeof generatorResult}]`,
			)
			if (Array.isArray(generatorResult)) {
				horizontalPoints = generatorResult
			}
		}

		if (
			(!verticalPoints || !verticalPoints.length) &&
			typeof verticalCoordinatesGenerator === "function"
		) {
			const isVerticalValues = verticalValues && verticalValues.length
			const generatorResult = verticalCoordinatesGenerator(
				{
					height: chartHeight() ?? height,
					offset: offset(),
					width: chartWidth() ?? width,
					xAxis: xAxis()
						? ({
								...xAxis(),
								scale: xAxis()?.scale ?? undefined,
								ticks: isVerticalValues ? verticalValues : xAxis()?.ticks,
							} as AxisPropsForCartesianGridTicksGeneration)
						: undefined,
				},
				isVerticalValues ? true : syncWithTicks,
			)
			warn(
				Array.isArray(generatorResult),
				`verticalCoordinatesGenerator should return Array but instead it returned [${typeof generatorResult}]`,
			)
			if (Array.isArray(generatorResult)) {
				verticalPoints = generatorResult
			}
		}

		return { horizontalPoints, verticalPoints }
	})

	const horizontalPointsReactive = (): number[] => computedPoints()?.horizontalPoints ?? []
	const verticalPointsReactive = (): number[] => computedPoints()?.verticalPoints ?? []

	return (
		<Show when={computedPoints() != null}>
			<ZIndexLayer zIndex={propsIncludingDefaults().zIndex}>
				<g class="recharts-cartesian-grid">
					<Background
						fill={propsIncludingDefaults().fill}
						fillOpacity={propsIncludingDefaults().fillOpacity}
						x={propsIncludingDefaults().x}
						y={propsIncludingDefaults().y}
						width={propsIncludingDefaults().width}
						height={propsIncludingDefaults().height}
						ry={
							(propsIncludingDefaults() as Record<string, unknown>).ry as
								| string
								| number
								| undefined
						}
					/>

					<HorizontalStripes
						{...propsIncludingDefaults()}
						horizontalPoints={horizontalPointsReactive()}
					/>
					<VerticalStripes
						{...propsIncludingDefaults()}
						verticalPoints={verticalPointsReactive()}
					/>

					<HorizontalGridLines
						{...propsIncludingDefaults()}
						offset={offset()}
						horizontalPoints={horizontalPointsReactive()}
						xAxis={xAxis()}
						yAxis={yAxis()}
					/>

					<VerticalGridLines
						{...propsIncludingDefaults()}
						offset={offset()}
						verticalPoints={verticalPointsReactive()}
						xAxis={xAxis()}
						yAxis={yAxis()}
					/>
				</g>
			</ZIndexLayer>
		</Show>
	)
}

CartesianGrid.displayName = "CartesianGrid"
