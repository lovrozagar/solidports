/* eslint-disable import/no-cycle, sort-keys */
/**
 * @fileOverview Reference Line
 */
import { createEffect, createMemo, onCleanup, Show, type JSX } from "solid-js"
import { clsx } from "clsx"
import { Layer } from "../container/Layer"
import {
	CartesianLabelContextProvider,
	CartesianLabelFromLabelProp,
	type ImplicitLabelType,
} from "../component/Label"
import { type IfOverflow, type Overflowable } from "../util/IfOverflow"
import { isNumOrStr } from "../util/DataUtils"
import { rectWithCoords } from "../util/CartesianUtils"
import type { CartesianViewBoxRequired, Coordinate } from "../util/types"
import { useViewBox } from "../context/chartLayoutContext"
import type { ReferenceLineSettings } from "../state/referenceElementsSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import {
	selectAxisScale,
	selectXAxisSettings,
	selectYAxisSettings,
} from "../state/selectors/axisSelectors"
import { useIsPanorama } from "../context/PanoramaContext"

import { useClipPathId } from "../container/ClipPathProvider"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { isWellBehavedNumber } from "../util/isWellBehavedNumber"
import type { BandPosition, RechartsScale } from "../util/scale/RechartsScale"
import type { CartesianScaleHelper } from "../util/scale/CartesianScaleHelper"
import { CartesianScaleHelperImpl } from "../util/scale/CartesianScaleHelper"

/**
 * Single point that defines one end of a segment.
 * These coordinates are in data space, meaning that you should provide
 * values that correspond to the data domain of the axes.
 * So you would provide a value of `Page A` to indicate the data value `Page A`
 * and then recharts will convert that to pixels.
 *
 * Likewise for numbers. If your x-axis goes from 0 to 100,
 * and you want the line to end at 50, you would provide `50` here.
 *
 * @inline
 */
export type ReferenceLineSegment = readonly [
	{
		x?: number | string
		y?: number | string
	},
	{
		x?: number | string
		y?: number | string
	},
]

interface ReferenceLineProps extends Overflowable, ZIndexable {
	/**
	 * If defined, renders a horizontal line on this position.
	 *
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceLine will internally calculate the correct pixel position.
	 *
	 * @example <ReferenceLine y="Page D" />
	 */
	y?: number | string

	/**
	 * If defined, renders a vertical line on this position.
	 *
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceLine will internally calculate the correct pixel position.
	 *
	 * @example <ReferenceLine x="Monday" />
	 */
	x?: number | string

	/**
	 * Tuple of coordinates. If defined, renders a diagonal line segment.
	 */
	segment?: ReferenceLineSegment

	/**
	 * The position of the reference line when the axis has bandwidth
	 * (e.g., a band scale). This determines where within the band
	 * the line is drawn.
	 * @defaultValue 'middle'
	 */
	position?: BandPosition

	className?: number | string
	/**
	 * The id of y-axis which is corresponding to the data.
	 * Required when there are multiple YAxes.
	 * @defaultValue 0
	 */
	yAxisId?: number | string
	/**
	 * The id of x-axis which is corresponding to the data.
	 * Required when there are multiple XAxes.
	 * @defaultValue 0
	 */
	xAxisId?: number | string
	shape?: JSX.Element | ((props: Record<string, unknown>) => JSX.Element)
	/**
	 * Renders a single label.
	 *
	 * - `false`: no labels are rendered
	 * - `string` | `number`: the content of the label
	 * - `object`: the props of LabelList component
	 * - `ReactElement`: a custom label element
	 * - `function`: a render function of custom label
	 *
	 * @defaultValue false
	 *
	 * @see {@link https://recharts.github.io/en-US/examples/LineChartWithReferenceLines/ Reference elements with a label}
	 */
	label?: ImplicitLabelType
	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue 400
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number
	/**
	 * The width of the stroke
	 * @defaultValue 1
	 */
	strokeWidth?: number | string
	children?: JSX.Element
}

/**
 * This excludes `viewBox` prop from svg for two reasons:
 * 1. The components wants viewBox of object type, and svg wants string
 *    - so there's a conflict, and the component will throw if it gets string
 * 2. Internally the component calls `svgPropertiesNoEvents` which filters the viewBox away anyway
 */
export type Props = Omit<JSX.LineSVGAttributes<SVGLineElement>, "viewBox"> & ReferenceLineProps

const renderLine = (
	option: ReferenceLineProps["shape"],
	lineProps: JSX.LineSVGAttributes<SVGLineElement>,
) => {
	if (typeof option === "function") {
		return (option as (p: Record<string, unknown>) => JSX.Element)(
			lineProps as Record<string, unknown>,
		)
	}

	if (
		!isWellBehavedNumber(lineProps.x1 as number) ||
		!isWellBehavedNumber(lineProps.y1 as number) ||
		!isWellBehavedNumber(lineProps.x2 as number) ||
		!isWellBehavedNumber(lineProps.y2 as number)
	) {
		return null
	}
	return <line {...lineProps} class="recharts-reference-line-line" />
}

type EndPointsPropsSubset = Pick<PropsWithDefaults, "y" | "x" | "segment" | "ifOverflow">

const getHorizontalLineEndPoints = (
	yCoord: number | string,
	ifOverflow: IfOverflow,
	position: Props["position"],
	yAxisOrientation: string | undefined,
	yAxisScale: RechartsScale,
	viewBox: CartesianViewBoxRequired,
): ReadonlyArray<Coordinate> | null => {
	const { x, width } = viewBox
	const coord = yAxisScale.map(yCoord, { position })
	if (!isWellBehavedNumber(coord)) {
		return null
	}

	if (ifOverflow === "discard" && !yAxisScale.isInRange(coord)) {
		return null
	}

	const points = [
		{ x: x + width, y: coord },
		{ x, y: coord },
	]
	return yAxisOrientation === "left" ? points.reverse() : points
}

const getVerticalLineEndPoints = (
	xCoord: number | string,
	ifOverflow: IfOverflow,
	position: Props["position"],
	xAxisOrientation: string | undefined,
	xAxisScale: RechartsScale,
	viewBox: CartesianViewBoxRequired,
): ReadonlyArray<Coordinate> | null => {
	const { y, height } = viewBox
	const coord = xAxisScale.map(xCoord, { position })
	if (!isWellBehavedNumber(coord)) {
		return null
	}

	if (ifOverflow === "discard" && !xAxisScale.isInRange(coord)) {
		return null
	}

	const points = [
		{ x: coord, y: y + height },
		{ x: coord, y },
	]
	return xAxisOrientation === "top" ? points.reverse() : points
}

const getSegmentLineEndPoints = (
	segment: ReferenceLineSegment,
	ifOverflow: IfOverflow,
	position: Props["position"],
	scales: CartesianScaleHelper,
): ReadonlyArray<Coordinate> | null => {
	const points: [Coordinate, Coordinate] = [
		scales.mapWithFallback(segment[0], { fallback: "rangeMin", position }),
		scales.mapWithFallback(segment[1], { fallback: "rangeMax", position }),
	]

	if (ifOverflow === "discard" && points.some((p) => !scales.isInRange(p))) {
		return null
	}

	return points
}

export const getEndPoints = (
	xAxisScale: RechartsScale,
	yAxisScale: RechartsScale,
	viewBox: CartesianViewBoxRequired,
	position: Props["position"],
	xAxisOrientation: string | undefined,
	yAxisOrientation: string | undefined,
	props: EndPointsPropsSubset,
): ReadonlyArray<Coordinate> | null => {
	const { x: xCoord, y: yCoord, segment, ifOverflow } = props
	const isFixedX = isNumOrStr(xCoord)
	const isFixedY = isNumOrStr(yCoord)

	if (isFixedY) {
		return getHorizontalLineEndPoints(
			yCoord as number | string,
			ifOverflow,
			position,
			yAxisOrientation,
			yAxisScale,
			viewBox,
		)
	}
	if (isFixedX) {
		return getVerticalLineEndPoints(
			xCoord as number | string,
			ifOverflow,
			position,
			xAxisOrientation,
			xAxisScale,
			viewBox,
		)
	}
	if (segment != null && segment.length === 2) {
		return getSegmentLineEndPoints(
			segment,
			ifOverflow,
			position,
			new CartesianScaleHelperImpl({ x: xAxisScale, y: yAxisScale }),
		)
	}

	return null
}

function ReportReferenceLine(props: ReferenceLineSettings): null {
	const ctx = useChartStore()
	createEffect(() => {
		ctx?.setStore("referenceElements", "lines", (prev) => [...prev, props])
		onCleanup(() => {
			ctx?.setStore("referenceElements", "lines", (prev) => prev.filter((l) => l !== props))
		})
	})
	return null
}

function ReferenceLineImpl(props: PropsWithDefaults) {
	const isPanorama = useIsPanorama()
	const clipPathId = useClipPathId()
	const ctx = useChartStore()
	/* perf: cache selector results; without memo every consumer read triggers full chain. */
	const xAxis = createMemo(() => (ctx ? selectXAxisSettings(ctx.store, props.xAxisId) : undefined))
	const yAxis = createMemo(() => (ctx ? selectYAxisSettings(ctx.store, props.yAxisId) : undefined))
	const xAxisScale = createMemo(() =>
		ctx ? selectAxisScale(ctx.store, "xAxis", props.xAxisId, isPanorama) : undefined,
	)
	const yAxisScale = createMemo(() =>
		ctx ? selectAxisScale(ctx.store, "yAxis", props.yAxisId, isPanorama) : undefined,
	)

	const viewBox = () => useViewBox()

	const endPoints = () => {
		const xScale = xAxisScale()
		const yScale = yAxisScale()
		const vb = viewBox()
		if (
			!clipPathId ||
			!vb ||
			xAxis() == null ||
			yAxis() == null ||
			xScale == null ||
			yScale == null
		) {
			return null
		}
		return getEndPoints(
			xScale,
			yScale,
			vb,
			props.position,
			xAxis()?.orientation,
			yAxis()?.orientation,
			props,
		)
	}

	return (
		<Show when={endPoints() != null && endPoints()?.length === 2}>
			{(() => {
				const point1 = () => endPoints()?.[0]
				const point2 = () => endPoints()?.[1]
				return (
					<Show when={point1() != null && point2() != null}>
						{(() => {
							const x1 = () => point1()?.x
							const y1 = () => point1()?.y
							const x2 = () => point2()?.x
							const y2 = () => point2()?.y

							const clipPath = () =>
								props.ifOverflow === "hidden" ? `url(#${clipPathId})` : undefined

							const lineProps = (): JSX.LineSVGAttributes<SVGLineElement> => ({
								"clip-path": clipPath(),
								...svgPropertiesAndEvents(props),
								x1: x1(),
								y1: y1(),
								x2: x2(),
								y2: y2(),
							})

							const rect = () =>
								rectWithCoords({
									x1: x1() as number,
									x2: x2() as number,
									y1: y1() as number,
									y2: y2() as number,
								})

							return (
								<ZIndexLayer zIndex={props.zIndex}>
									<Layer class={clsx("recharts-reference-line", props.className)}>
										{renderLine(props.shape, lineProps())}
										<CartesianLabelContextProvider
											{...rect()}
											lowerWidth={rect().width}
											upperWidth={rect().width}
										>
											<CartesianLabelFromLabelProp label={props.label} />
											{props.children}
										</CartesianLabelContextProvider>
									</Layer>
								</ZIndexLayer>
							)
						})()}
					</Show>
				)
			})()}
		</Show>
	)
}

export const referenceLineDefaultProps = {
	fill: "none",
	"fill-opacity": 1,
	ifOverflow: "discard",
	label: false,
	position: "middle",
	stroke: "#ccc",
	"stroke-width": 1,
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.line,
} as const satisfies Partial<Props>

type PropsWithDefaults = RequiresDefaultProps<Props, typeof referenceLineDefaultProps>

/**
 * Draws a line on the chart connecting two points.
 *
 * This component, unlike {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/line line}, is aware of the cartesian coordinate system,
 * so you specify the dimensions by using data coordinates instead of pixels.
 *
 * ReferenceLine will calculate the pixels based on the provided data coordinates.
 *
 * If you prefer to render using pixels rather than data coordinates,
 * consider using the {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/line line SVG element} instead.
 *
 * @provides CartesianLabelContext
 * @consumes CartesianChartContext
 */
export function ReferenceLine(outsideProps: Props) {
	const props: PropsWithDefaults = resolveDefaultProps(outsideProps, referenceLineDefaultProps)
	return (
		<>
			<ReportReferenceLine
				yAxisId={props.yAxisId}
				xAxisId={props.xAxisId}
				ifOverflow={props.ifOverflow}
				x={props.x}
				y={props.y}
				segment={props.segment}
			/>
			<ReferenceLineImpl {...props} />
		</>
	)
}

ReferenceLine.displayName = "ReferenceLine"
