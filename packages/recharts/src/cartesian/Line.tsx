/* eslint-disable import/no-cycle */
import {
	createEffect,
	createMemo,
	createSignal,
	mergeProps,
	Show,
	splitProps,
	type JSX,
} from "solid-js"
import { clsx } from "clsx"
import type { CurveType, Props as CurveProps } from "../shape/Curve"
import { Layer } from "../container/Layer"
import {
	CartesianLabelListContextProvider,
	type CartesianLabelListEntry,
	type ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import { Dots } from "../component/Dots"
import type { ErrorBarDataItem, ErrorBarDataPointFormatter } from "./ErrorBar"
import { interpolate, isNullish, noop } from "../util/DataUtils"
import { isClipDot } from "../util/ReactUtils"
import { getCateCoordinateOfLine, getTooltipNameProp, getValueByDataKey } from "../util/ChartUtils"
import type {
	ActiveDotType,
	ActiveShape,
	AnimationDuration,
	AnimationTiming,
	CartesianLayout,
	DataConsumer,
	DataKey,
	DataProvider,
	DotType,
	LegendType,
	TickItem,
	TooltipType,
	TrapezoidViewBox,
} from "../util/types"
import type { LegendPayload } from "../component/DefaultLegendContent"
import { ActivePoints } from "../component/ActivePoints"
import type { TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { SetErrorBarContext } from "../context/ErrorBarContext"
import { GraphicalItemChildrenScope } from "../context/GraphicalItemChildrenScope"
import { GraphicalItemClipPath, useNeedsClip } from "./GraphicalItemClipPath"
import { useChartLayout } from "../context/chartLayoutContext"
import type { BaseAxisWithScale } from "../state/selectors/axisSelectors"
import { useIsPanorama } from "../context/PanoramaContext"
import { selectLinePoints } from "../state/selectors/lineSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/_solid/useChartState"
import type { AxisId } from "../state/cartesianAxisSlice"
import { SetLegendPayload } from "../state/SetLegendPayload"
import { useAnimationId } from "../util/useAnimationId"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { usePlotArea } from "../hooks"
import type { WithIdRequired } from "../util/useUniqueId"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { SetCartesianGraphicalItem } from "../state/SetGraphicalItem"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { getRadiusAndStrokeWidthFromDot } from "../util/getRadiusAndStrokeWidthFromDot"
import { Shape } from "../util/ActiveShapeUtils"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import type { ChartData } from "../state/chartDataSlice"

export interface LinePointItem {
	readonly value: number
	readonly payload?: unknown
	/**
	 * Line coordinates can have gaps in them. We have `connectNulls` prop that allows to connect those gaps anyway.
	 * What it means is that some points can have `null` x or y coordinates.
	 */
	x: number | null
	y: number | null
}

/**
 * Internal props, combination of external props + defaultProps + private Recharts state
 */
interface InternalLineProps extends ZIndexable {
	activeDot: ActiveDotType
	animateNewValues: boolean
	animationBegin: number
	animationDuration: AnimationDuration
	animationEasing: AnimationTiming

	className?: string
	connectNulls: boolean
	data?: unknown
	dataKey?: DataKey<unknown>
	dot: DotType
	height: number
	hide: boolean
	id: GraphicalItemId
	isAnimationActive: boolean | "auto"
	label: ImplicitLabelListType
	layout: "horizontal" | "vertical"
	left: number
	legendType: LegendType
	shape?: ActiveShape<CurveProps, SVGPathElement>

	name?: string | number
	needClip?: boolean

	onAnimationEnd?: () => void
	onAnimationStart?: () => void

	points: ReadonlyArray<LinePointItem>
	tooltipType?: TooltipType
	top: number
	type?: CurveType
	unit?: string | number | null
	width: number
	xAxisId: AxisId
	yAxisId: AxisId
	children?: JSX.Element
}

/**
 * External props, intended for end users to fill in
 */
interface LineProps<DataPointType = unknown, DataValueType = unknown>
	extends DataProvider<DataPointType>, DataConsumer<DataPointType, DataValueType>, ZIndexable {
	/**
	 * The active dot is rendered on the closest data point when user interacts with the chart.
	 * @defaultValue true
	 */
	activeDot?: ActiveDotType
	/** @defaultValue true */
	animateNewValues?: boolean
	/** @defaultValue 0 */
	animationBegin?: number
	/** @defaultValue 1500 */
	animationDuration?: AnimationDuration
	/** @defaultValue ease */
	animationEasing?: AnimationTiming
	className?: string
	/** @defaultValue false */
	connectNulls?: boolean
	/** @defaultValue true */
	dot?: DotType
	/** @defaultValue false */
	hide?: boolean
	id?: string
	/** @defaultValue auto */
	isAnimationActive?: boolean | "auto"
	/** @defaultValue false */
	label?: ImplicitLabelListType
	/** @defaultValue line */
	legendType?: LegendType
	shape?: ActiveShape<CurveProps, SVGPathElement>
	name?: string | number
	onAnimationEnd?: () => void
	onAnimationStart?: () => void
	tooltipType?: TooltipType
	/** @defaultValue linear */
	type?: CurveType
	unit?: string | number | null
	/** @defaultValue 0 */
	xAxisId?: AxisId
	/** @defaultValue 0 */
	yAxisId?: AxisId
	/** @defaultValue 400 */
	zIndex?: number
	/** @defaultValue #3182bd */
	stroke?: string
	/** @defaultValue 1 */
	strokeWidth?: string | number
	strokeDasharray?: string | number
	children?: JSX.Element
}

/**
 * Because of naming conflict, we are forced to ignore certain (valid) SVG attributes.
 */
type LineSvgProps = Omit<CurveProps, "points" | "pathRef" | "ref" | "layout" | "baseLine">

type InternalProps = LineSvgProps & InternalLineProps

export type Props = LineSvgProps & LineProps

/* eslint-disable solid/reactivity -- plain utility fn; Props parameter is not a Solid reactive proxy at this call site */
const computeLegendPayloadFromAreaData = (props: Props): ReadonlyArray<LegendPayload> => {
	return [
		{
			color: props.stroke,
			dataKey: props.dataKey,
			inactive: props.hide,
			payload: props,
			type: props.legendType,
			value: getTooltipNameProp(props.name, props.dataKey),
		},
	]
}
/* eslint-enable solid/reactivity */

function SetLineTooltipEntrySettings(
	props: Pick<
		InternalProps,
		| "dataKey"
		| "data"
		| "stroke"
		| "strokeWidth"
		| "fill"
		| "name"
		| "hide"
		| "unit"
		| "tooltipType"
		| "id"
	>,
) {
	/* GOTCHA-005 (session 38): wrap in createMemo so reactive props flow into the
	   settings object — setup-time literal would freeze defaults at first render. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.data,
		getPosition: noop,
		settings: {
			color: props.stroke,
			dataKey: props.dataKey,
			fill: props.fill,
			graphicalItemId: props.id,
			hide: props.hide,
			name: getTooltipNameProp(props.name, props.dataKey),
			nameKey: undefined,
			stroke: props.stroke,
			strokeWidth: props.strokeWidth,
			type: props.tooltipType,
			unit: props.unit,
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

const generateSimpleStrokeDasharray = (totalLength: number, length: number): string => {
	return `${length}px ${totalLength - length}px`
}

function repeat(lines: number[], count: number) {
	const linesUnit = lines.length % 2 !== 0 ? [...lines, 0] : lines
	let result: number[] = []

	for (let i = 0; i < count; ++i) {
		result.push(...linesUnit)
	}

	return result
}

const getStrokeDasharray = (length: number, totalLength: number, lines: number[]) => {
	const lineLength = lines.reduce((pre, next) => pre + next)

	if (!lineLength) {
		return generateSimpleStrokeDasharray(totalLength, length)
	}

	const count = Math.floor(length / lineLength)
	const remainLength = length % lineLength
	const restLength = totalLength - length

	let remainLines: number[] = []
	for (let i = 0, sum = 0; i < lines.length; sum += lines[i] ?? 0, ++i) {
		const lineValue = lines[i]
		if (lineValue != null && sum + lineValue > remainLength) {
			remainLines = [...lines.slice(0, i), remainLength - sum]
			break
		}
	}

	const emptyLines = remainLines.length % 2 === 0 ? [0, restLength] : [restLength]

	return [...repeat(lines, count), ...remainLines, ...emptyLines]
		.map((line) => `${line}px`)
		.join(", ")
}

function LineDotsWrapper(props: {
	points: ReadonlyArray<LinePointItem>
	clipPathId: string
	allProps: InternalProps
}) {
	const lineProps = () => {
		const { id: _id, ...propsWithoutId } = props.allProps
		return svgPropertiesNoEvents(propsWithoutId)
	}

	return (
		<Dots
			points={props.points}
			dot={props.allProps.dot}
			className="recharts-line-dots"
			dotClassName="recharts-line-dot"
			dataKey={props.allProps.dataKey}
			baseProps={lineProps()}
			needClip={props.allProps.needClip}
			clipPathId={props.clipPathId}
		/>
	)
}

function LineLabelListProvider(props: {
	showLabels: boolean
	children: JSX.Element
	points: ReadonlyArray<LinePointItem>
}) {
	const labelListEntries = createMemo((): ReadonlyArray<CartesianLabelListEntry> => {
		return props.points?.map((point): CartesianLabelListEntry => {
			const viewBox: TrapezoidViewBox = {
				height: 0,
				lowerWidth: 0,
				upperWidth: 0,
				width: 0,
				x: point.x ?? 0,
				y: point.y ?? 0,
			}
			return {
				...viewBox,
				fill: undefined,
				parentViewBox: undefined,
				payload: point.payload,
				value: point.value,
				viewBox,
			}
		})
	})
	/* eslint-disable solid/reactivity -- showLabels and labelListEntries() are reactive inside JSX; linter can't trace through Context.Provider value prop */
	return (
		<CartesianLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</CartesianLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

function StaticCurve(props: {
	clipPathId: string
	pathRef: { current: SVGPathElement | null } | undefined
	points: ReadonlyArray<LinePointItem>
	allProps: InternalProps
	strokeDasharray?: string
}) {
	/* GOTCHA-014: spreads + reactive attrs go through mergeProps lazy memos. If the first
	   property read happens inside an event handler (no owner), Solid warns. Hoist
	   derived attrs into setup-scope createMemos so the memo's owner is the component. */
	const eventProps = createMemo(() => svgPropertiesAndEvents(props.allProps))
	const clipPath = createMemo(() =>
		props.allProps.needClip ? `url(#clipPath-${props.clipPathId})` : undefined,
	)
	const dasharray = createMemo(() => props.strokeDasharray ?? props.allProps.strokeDasharray)

	return (
		<>
			<Show when={props.points?.length > 1}>
				<Shape
					{...eventProps()}
					shapeType="curve"
					option={props.allProps.shape}
					class="recharts-line-curve"
					clip-path={clipPath()}
					connectNulls={props.allProps.connectNulls}
					fill="none"
					layout={props.allProps.layout}
					points={props.points}
					strokeDasharray={dasharray()}
					type={props.allProps.type}
					pathRef={props.pathRef}
				/>
			</Show>
			<LineDotsWrapper
				points={props.points}
				clipPathId={props.clipPathId}
				allProps={props.allProps}
			/>
		</>
	)
}

function getTotalLength(mainCurve: SVGPathElement | null | undefined): number {
	try {
		return (mainCurve && mainCurve.getTotalLength && mainCurve.getTotalLength()) || 0
	} catch {
		return 0
	}
}

function CurveWithAnimation(props: {
	clipPathId: string
	allProps: InternalProps
	previousPointsRef: { current: ReadonlyArray<LinePointItem> | null }
}) {
	/* GOTCHA-014-J: ref-object shape `{ current }` matches upstream React `useRef`.
	   Tests assert `pathRef: { current: <SVGPathElement> }` on the props payload
	   passed to user click/mouse handlers. Curve's `<path>` writes via callback
	   into `pathRef.current`. Animation closures read `pathRef.current` on every
	   tick so getTotalLength sees the live mounted node. */
	const pathRef: { current: SVGPathElement | null } = { current: null }
	let longestAnimatedLength = 0
	let startingPoint = 0
	let lastAnimationId = ""

	const animationId = useAnimationId(() => props.allProps.points, "recharts-line-")

	/* GOTCHA-014-G: snapshot prevPoints + diff factor at the moment animationId
	   flips. Upstream React re-runs setup on every parent render, freshly reading
	   the ref. Solid setup runs once, so we key the snapshot on animationId — the
	   memo re-evaluates exactly when a new animation starts, mirroring React's
	   per-render ref read. */
	const animationContext = createMemo(() => {
		animationId()
		const prevPoints = props.previousPointsRef.current
		return {
			prevPoints,
			prevPointsDiffFactor: prevPoints
				? prevPoints.length / props.allProps.points.length
				: 1,
		}
	})

	const [isAnimating, setIsAnimating] = createSignal(false)
	const showLabels = () => !isAnimating()

	const handleAnimationEnd = () => {
		if (typeof props.allProps.onAnimationEnd === "function") {
			props.allProps.onAnimationEnd()
		}
		setIsAnimating(false)
	}

	const handleAnimationStart = () => {
		if (typeof props.allProps.onAnimationStart === "function") {
			props.allProps.onAnimationStart()
		}
		setIsAnimating(true)
	}

	return (
		<LineLabelListProvider points={props.allProps.points} showLabels={showLabels()}>
			{/* GOTCHA-017: user JSX (ErrorBar) memoized via children() helper inside
			   SetErrorBarContext.Provider scope so createComponent(ErrorBar) captures
			   live ctx Accessor, not initial-default. Single read site. */}
			<GraphicalItemChildrenScope>{props.allProps.children}</GraphicalItemChildrenScope>
			<JavascriptAnimate
				animationId={animationId()}
				begin={props.allProps.animationBegin}
				duration={props.allProps.animationDuration}
				isActive={props.allProps.isAnimationActive}
				easing={props.allProps.animationEasing}
				onAnimationEnd={handleAnimationEnd}
				onAnimationStart={handleAnimationStart}
			>
				{(t: () => number) => {
					/* GOTCHA-014: children fn invoked once; reactive derivations live in
					   memos so StaticCurve's path stays mounted with attribute-only updates
					   per tick. Tests holding captured `path` refs see live attrs. */
					/* perf: cache totalLength per animationId — getTotalLength forces SVG
					   layout flush, so calling it every rAF tick produced 2.5ms+ avg work
					   per frame (vs 0.005ms in React, which captures totalLength once per
					   render). Re-read only when animationId changes (data swap). */
					let cachedTotalLength = 0
					let cachedForAnimationId = ""
					const getTotalLengthCached = (): number => {
						const id = animationId()
						if (cachedForAnimationId === id && cachedTotalLength > 0) {
							return cachedTotalLength
						}
						const len = getTotalLength(pathRef.current)
						if (len > 0) {
							cachedTotalLength = len
							cachedForAnimationId = id
						}
						return len
					}
					const dasharrayMemo = createMemo(() => {
						const tValue = t()
						const totalLength = getTotalLengthCached()
						if (lastAnimationId !== animationId()) {
							startingPoint = longestAnimatedLength
							lastAnimationId = animationId()
						}
						const lengthInterpolated = interpolate(
							startingPoint,
							totalLength + startingPoint,
							tValue,
						)
						const curLength = Math.min(lengthInterpolated, totalLength)
						let currentStrokeDasharray: string | undefined
						if (props.allProps.isAnimationActive) {
							if (props.allProps.strokeDasharray) {
								const lines = `${props.allProps.strokeDasharray}`
									.split(/[,\s]+/gim)
									.map((num) => parseFloat(num))
								currentStrokeDasharray = getStrokeDasharray(curLength, totalLength, lines)
							} else {
								currentStrokeDasharray = generateSimpleStrokeDasharray(totalLength, curLength)
							}
						} else {
							currentStrokeDasharray =
								props.allProps.strokeDasharray == null
									? undefined
									: String(props.allProps.strokeDasharray)
						}
						if (tValue > 0 && totalLength > 0) {
							longestAnimatedLength = Math.max(longestAnimatedLength, curLength)
						}
						return currentStrokeDasharray
					})
					const stepDataMemo = createMemo(() => {
						const ctx = animationContext()
						const tValue = t()
						if (ctx.prevPoints) {
							return tValue === 1
								? props.allProps.points
								: props.allProps.points.map((entry, index): LinePointItem => {
										const prevPointIndex = Math.floor(index * ctx.prevPointsDiffFactor)
										const prev = ctx.prevPoints?.[prevPointIndex]
										if (prev) {
											return {
												...entry,
												x: interpolate(prev.x, entry.x, tValue),
												y: interpolate(prev.y, entry.y, tValue),
											}
										}
										if (props.allProps.animateNewValues) {
											return {
												...entry,
												x: interpolate(props.allProps.width * 2, entry.x, tValue),
												y: interpolate(props.allProps.height / 2, entry.y, tValue),
											}
										}
										return { ...entry, x: entry.x, y: entry.y }
									})
						}
						return props.allProps.points
					})
					createEffect(() => {
						if (t() > 0 && getTotalLengthCached() > 0) {
							props.previousPointsRef.current = stepDataMemo()
						}
					})
					return (
						<StaticCurve
							allProps={props.allProps}
							points={stepDataMemo()}
							clipPathId={props.clipPathId}
							pathRef={pathRef}
							strokeDasharray={dasharrayMemo()}
						/>
					)
				}}
			</JavascriptAnimate>
			<LabelListFromLabelProp label={props.allProps.label} />
		</LineLabelListProvider>
	)
}

function RenderCurve(props: { clipPathId: string; allProps: InternalProps }) {
	const previousPointsRef: { current: ReadonlyArray<LinePointItem> | null } = { current: null }
	return (
		<CurveWithAnimation
			clipPathId={props.clipPathId}
			allProps={props.allProps}
			previousPointsRef={previousPointsRef}
		/>
	)
}

const errorBarDataPointFormatter: ErrorBarDataPointFormatter<LinePointItem> = (
	dataPoint: LinePointItem,
	dataKey,
): ErrorBarDataItem => {
	return {
		errorVal: getValueByDataKey(dataPoint.payload as LinePointItem, dataKey),
		value: dataPoint.value,
		x: dataPoint.x ?? undefined,
		y: dataPoint.y ?? undefined,
	}
}

function LineWithState(props: InternalProps) {
	return (
		<Show when={!props.hide}>
			{(() => {
				const layerClass = () => clsx("recharts-line", props.className)
				const clipPathId = () => props.id
				const dotMeta = () => getRadiusAndStrokeWidthFromDot(props.dot)
				const clipDot = () => isClipDot(props.dot)
				const dotSize = () => dotMeta().r * 2 + dotMeta().strokeWidth
				const activePointsClipPath = () =>
					props.needClip ? `url(#clipPath-${clipDot() ? "" : "dots-"}${clipPathId()})` : undefined

				return (
					<ZIndexLayer zIndex={props.zIndex}>
						<Layer class={layerClass()}>
							<Show when={props.needClip}>
								<defs>
									<GraphicalItemClipPath
										clipPathId={clipPathId()}
										xAxisId={props.xAxisId}
										yAxisId={props.yAxisId}
									/>
									<Show when={!clipDot()}>
										<clipPath id={`clipPath-dots-${clipPathId()}`}>
											<rect
												x={props.left - dotSize() / 2}
												y={props.top - dotSize() / 2}
												width={props.width + dotSize()}
												height={props.height + dotSize()}
											/>
										</clipPath>
									</Show>
								</defs>
							</Show>
							{/* GOTCHA-017 (session 34): SetErrorBarContext hoisted to Line()
							   outer scope. RenderCurve is now inside the Provider scope via
							   the outer wrapper. */}
							<RenderCurve allProps={props} clipPathId={clipPathId()} />
						</Layer>
						<ActivePoints
							activeDot={props.activeDot}
							points={props.points}
							mainColor={props.stroke}
							itemDataKey={props.dataKey}
							clipPath={activePointsClipPath()}
						/>
					</ZIndexLayer>
				)
			})()}
		</Show>
	)
}

export const defaultLineProps = {
	activeDot: true,
	animateNewValues: true,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	connectNulls: false,
	dot: true,
	fill: "#fff",
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "line",
	stroke: "#3182bd",
	strokeWidth: 1,
	type: "linear",
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.line,
} as const satisfies Partial<Props>

function LineImpl(props: WithIdRequired<Props>) {
	const resolved = resolveDefaultProps(props, defaultLineProps)

	const needClipResult = () => useNeedsClip(resolved.xAxisId, resolved.yAxisId)
	/* arrow thunks: bare hooks, but callsites repeatedly read inside Show predicate
	   and render-fn — thunk preserves callsite shape and reactivity. See GOTCHA-011. */
	const plotArea = () => usePlotArea()
	const layout = () => useChartLayout()
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const stateCtx = useOptionalChartState()
	/* perf: createMemo caches selectLinePoints result; without it, every consumer
	   read during the animation loop triggers a fresh selector chain (selectLinePoints
	   → selectAxisWithScale → axis recompute), costing 16ms/frame. Memoizing collapses
	   that to one recompute per store-change.
	   Axis reactivity: selectLinePoints reads ctx.store._solid.cartesianAxes (a Solid store
	   proxy) without untrack — this memo tracks those signals directly.
	   Item reactivity: explicit read of stateCtx.state.graphicalItems[id] tracks mutations
	   to graphicalItems (e.g. dataKey change) and passes updated settings to the selector. */
	const points = createMemo(() => {
		const rawItem = stateCtx?.state.graphicalItems[resolved.id]
		const itemSettings =
			rawItem != null && rawItem.type === "line"
				? (rawItem as import("../state/_solid/chartState").LineState).settings
				: undefined
		return ctx
			? selectLinePoints(
					ctx.store,
					resolved.xAxisId,
					resolved.yAxisId,
					isPanorama,
					resolved.id,
					itemSettings != null ? { lineSettings: itemSettings } : undefined,
				)
			: undefined
	})

	return (
		<Show
			when={
				(layout() === "horizontal" || layout() === "vertical") &&
				points() != null &&
				plotArea() != null
			}
		>
			{(() => {
				const viewBox = plotArea()
				const {
					height,
					width,
					x: left,
					y: top,
				} = viewBox as { height: number; width: number; x: number; y: number }

				return (
					<LineWithState
						{...resolved}
						id={resolved.id}
						connectNulls={resolved.connectNulls}
						dot={resolved.dot}
						activeDot={resolved.activeDot}
						animateNewValues={resolved.animateNewValues}
						animationBegin={resolved.animationBegin}
						animationDuration={resolved.animationDuration}
						animationEasing={resolved.animationEasing}
						isAnimationActive={resolved.isAnimationActive}
						hide={resolved.hide}
						label={resolved.label}
						legendType={resolved.legendType}
						xAxisId={resolved.xAxisId}
						yAxisId={resolved.yAxisId}
						points={points() as ReadonlyArray<LinePointItem>}
						layout={layout() as "horizontal" | "vertical"}
						height={height}
						width={width}
						left={left}
						top={top}
						needClip={needClipResult()?.needClip()}
					/>
				)
			})()}
		</Show>
	)
}

export function computeLinePoints({
	layout,
	xAxis,
	yAxis,
	xAxisTicks,
	yAxisTicks,
	dataKey,
	bandSize,
	displayedData,
}: {
	layout: CartesianLayout
	xAxis: BaseAxisWithScale
	yAxis: BaseAxisWithScale
	xAxisTicks: TickItem[]
	yAxisTicks: TickItem[]
	dataKey: Props["dataKey"]
	bandSize: number
	displayedData: ChartData
}): ReadonlyArray<LinePointItem> {
	return displayedData
		.map((entry, index): LinePointItem | null => {
			const entryRecord =
				entry != null && typeof entry === "object"
					? (entry as Record<string, unknown>)
					: ({} as Record<string, unknown>)
			const value = getValueByDataKey(entry, dataKey) as number

			if (layout === "horizontal") {
				const x = getCateCoordinateOfLine({
					axis: xAxis,
					bandSize,
					entry: entryRecord,
					index,
					ticks: xAxisTicks,
				})
				const y = isNullish(value) ? null : yAxis.scale.map(value)
				return {
					payload: entry,
					value,
					x,
					y: y ?? null,
				}
			}

			const x = isNullish(value) ? null : xAxis.scale.map(value)
			const y = getCateCoordinateOfLine({
				axis: yAxis,
				bandSize,
				entry: entryRecord,
				index,
				ticks: yAxisTicks,
			})
			if (x == null || y == null) {
				return null
			}
			return {
				payload: entry,
				value,
				x,
				y,
			}
		})
		.filter(Boolean) as ReadonlyArray<LinePointItem>
}

/**
 * @provides LabelListContext
 * @provides ErrorBarContext
 * @consumes CartesianChartContext
 */
export function Line(outsideProps: Props) {
	/* GOTCHA-013 + GOTCHA-014: split children, then mergeProps for the defaults
	   layer. resolveDefaultProps `{...realProps}` snapshots the props proxy at
	   first render — animationEasing, isAnimationActive and every other prop
	   freeze. mergeProps preserves the lazy proxy so reactive parents (e.g.
	   tests changing dataKey at runtime) keep flowing values into LineImpl. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props = mergeProps(defaultLineProps, restProps) as ReturnType<
		typeof resolveDefaultProps<typeof restProps, typeof defaultLineProps>
	>
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	return (
		<RegisterGraphicalItemId id={props.id} type="line">
			{(id) => {
				/* GOTCHA-017 (session 34): SetErrorBarContext hoisted from LineWithState
				   to here so user JSX <ErrorBar/> in props.children evaluates inside the
				   Provider owner. Points come from the same selector LineImpl uses. */
				const linePoints = () =>
					ctx
						? selectLinePoints(ctx.store, props.xAxisId, props.yAxisId, isPanorama, id)
						: undefined
				return (
					<>
						<SetLegendPayload legendPayload={computeLegendPayloadFromAreaData(props)} />
						<SetLineTooltipEntrySettings
							dataKey={props.dataKey}
							data={props.data}
							stroke={props.stroke}
							strokeWidth={props.strokeWidth}
							fill={props.fill}
							name={props.name}
							hide={props.hide}
							unit={props.unit}
							tooltipType={props.tooltipType}
							id={id}
						/>
						<SetCartesianGraphicalItem
							type="line"
							id={id}
							data={props.data}
							xAxisId={props.xAxisId}
							yAxisId={props.yAxisId}
							zAxisId={0}
							dataKey={props.dataKey}
							hide={props.hide}
							isPanorama={isPanorama}
						/>
						<SetErrorBarContext
							xAxisId={props.xAxisId}
							yAxisId={props.yAxisId}
							data={linePoints()}
							dataPointFormatter={errorBarDataPointFormatter}
							errorBarOffset={0}
						>
							{(() => {
								/* GOTCHA-017 (session 34): memoize children INSIDE SetErrorBarContext
								   so ErrorBar JSX createComponent captures the live Provider. */
								const memoizedChildren = createMemo(() => childrenProps.children)
								return (
									<LineImpl {...props} id={id}>
										{memoizedChildren()}
									</LineImpl>
								)
							})()}
						</SetErrorBarContext>
					</>
				)
			}}
		</RegisterGraphicalItemId>
	)
}

Line.displayName = "Line"
