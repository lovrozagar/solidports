/* eslint-disable import/no-cycle */
import type { Formatter } from "../component/DefaultTooltipContent"
import { createMemo, createSignal, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { clsx } from "clsx"
import type { CurveType, Props as CurveProps } from "../shape/Curve"
import { Layer } from "../container/Layer"
import {
	LabelListContextBridge,
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
import { useOptionalChartState } from "../state/useChartState"
import type { AxisId } from "../state/cartesianAxisSlice"
import { SetLegendPayload } from "../state/SetLegendPayload"
import { useAnimationId } from "../util/useAnimationId"
import { useAnimatedLineLength } from "./useAnimatedLineLength"
import { LineDrawShape } from "./LineDrawShape"
import type { LineDrawShapeProps } from "./LineDrawShape"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { usePlotArea } from "../hooks"
import type { WithIdRequired } from "../util/useUniqueId"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { SetCartesianGraphicalItem } from "../state/SetGraphicalItem"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import type { AnimationInterpolateFn } from "../animation/AnimatedItems"
import { matchByIndex } from "../animation/matchBy"
import type { AnimationItem, AnimationMatchByProp } from "../animation/matchBy"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { getRadiusAndStrokeWidthFromDot } from "../util/getRadiusAndStrokeWidthFromDot"
import { Shape } from "../util/ActiveShapeUtils"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import type { ChartData } from "../state/chartDataSlice"

import { mergeProps, splitProps } from '../util/solid-1-compat';
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
	animationInterpolateFn: AnimationInterpolateFn<LinePointItem, CartesianLayout>
	animationMatchBy: AnimationMatchByProp<LinePointItem>

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
	shape: ActiveShape<LineDrawShapeProps, SVGPathElement>

	name?: string | number
	needClip?: boolean

	onAnimationEnd?: () => void
	onAnimationStart?: () => void

	points: ReadonlyArray<LinePointItem>
	tooltipType?: TooltipType
	formatter?: Formatter
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
	/**
	 * Custom animation function for interpolating data items.
	 * When provided, this replaces the default animation interpolation.
	 *
	 * @since 3.9
	 * @see {@link https://recharts.github.io/en-US/guide/animations/ Animations guide}
	 */
	animationInterpolateFn?: AnimationInterpolateFn<LinePointItem, CartesianLayout>
	/**
	 * Strategy for matching previous items to next items during animation.
	 *
	 * - `matchByIndex` (default): match by array position with proportional stretching
	 * - `matchAppend`: match sequentially by index and treat newly appended items as new
	 * - `matchByDataKey('someKey')`: match by a data key from the payload
	 * - Custom function `(item, index) => key`: match by the returned key
	 *
	 * @defaultValue index
	 */
	animationMatchBy?: AnimationMatchByProp<LinePointItem>
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
	/**
	 * The shape of the line. Defaults to `LineDrawShape`, which reveals the path via
	 * stroke-dasharray during the entrance animation.
	 * During animations, a function shape also receives `animationElapsedTime`,
	 * `isAnimating`, `isEntrance`, and `visibleLength`.
	 */
	shape?: ActiveShape<LineDrawShapeProps, SVGPathElement>
	name?: string | number
	onAnimationEnd?: () => void
	onAnimationStart?: () => void
	tooltipType?: TooltipType
	/**
	 * Formats the value displayed in the tooltip for this Line.
	 * When set, takes precedence over the `formatter` prop on the Tooltip component.
	 */
	formatter?: Formatter
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

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type Props<DataPointType = any, DataValueType = any> = LineSvgProps & LineProps<DataPointType, DataValueType>

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
		| "formatter"
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
			formatter: props.formatter,
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

function getTotalLength(mainCurve: SVGPathElement | null): number {
	try {
		return (mainCurve && mainCurve.getTotalLength && mainCurve.getTotalLength()) || 0
	} catch {
		return 0
	}
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
	animationElapsedTime?: number
	isAnimating?: boolean
	isEntrance?: boolean
	visibleLength?: number | null
}) {
	/* GOTCHA-014: spreads + reactive attrs go through mergeProps lazy memos. If the first
	   property read happens inside an event handler (no owner), Solid warns. Hoist
	   derived attrs into setup-scope createMemos so the memo's owner is the component. */
	/* eslint-disable-next-line solid/reactivity -- splitProps keeps lazy getters; reads happen in the memo below */
	const [, others] = splitProps(props.allProps, [
		"type",
		"layout",
		"connectNulls",
		"needClip",
		"shape",
		"strokeDasharray",
	])
	const eventProps = createMemo(() => svgPropertiesAndEvents(others))
	const clipPath = createMemo(() =>
		props.allProps.needClip ? `url(#clipPath-${props.clipPathId})` : undefined,
	)

	return (
		<>
			<Show when={props.points?.length > 1}>
				<Shape
					{...eventProps()}
					shapeType="curve"
					option={props.allProps.shape}
					DefaultShape={LineDrawShape}
					class="recharts-line-curve"
					clip-path={clipPath()}
					connectNulls={props.allProps.connectNulls}
					fill="none"
					layout={props.allProps.layout}
					points={props.points}
					strokeDasharray={props.allProps.strokeDasharray}
					type={props.allProps.type}
					pathRef={props.pathRef}
					animationElapsedTime={props.animationElapsedTime}
					isAnimating={props.isAnimating}
					isEntrance={props.allProps.animateNewValues ? props.isEntrance : false}
					visibleLength={props.visibleLength}
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

function averageShift(items: ReadonlyArray<AnimationItem<LinePointItem>>): number {
	let total = 0
	let count = 0
	for (const item of items) {
		if (item.status === "matched" && item.prev.x != null && item.next.x != null) {
			total += item.next.x - item.prev.x
			count++
		}
	}
	return count > 0 ? total / count : 0
}

const defaultLineAnimateItems: AnimationInterpolateFn<LinePointItem, CartesianLayout> = (
	items,
	animationElapsedTime,
) => {
	if (items == null) {
		// First render: return empty, stroke-dasharray handles the reveal
		return []
	}
	// At animationElapsedTime=1 return only the non-removed items
	if (animationElapsedTime === 1) return items.flatMap((item) => (item.status === "removed" ? [] : [item.next]))

	const shift = averageShift(items)

	const result: LinePointItem[] = []

	for (const item of items) {
		if (item.status === "matched") {
			result.push({
				...item.next,
				x: interpolate(item.prev.x, item.next.x, animationElapsedTime),
				y: interpolate(item.prev.y, item.next.y, animationElapsedTime),
			})
		} else if (item.status === "added") {
			if (item.next.x != null) {
				// Extrapolate entry position: the point starts where it "would have been"
				const entryX = item.next.x - shift
				result.push({
					...item.next,
					x: interpolate(entryX, item.next.x, animationElapsedTime),
					y: item.next.y,
				})
			} else {
				result.push(item.next)
			}
		} else if (item.status === "removed") {
			if (item.prev.x != null) {
				const exitX = item.prev.x + shift
				result.push({
					...item.prev,
					x: interpolate(item.prev.x, exitX, animationElapsedTime),
					y: item.prev.y,
				})
			}
			// else: removed items are simply dropped
		}
	}

	return result
}

function CurveWithAnimation(props: {
	clipPathId: string
	allProps: InternalProps
	previousPointsRef: { current: ReadonlyArray<LinePointItem> | null }
}) {
	/* GOTCHA-014-J: ref-object shape `{ current }` matches upstream React `useRef`.
	   Tests assert `pathRef: { current: <SVGPathElement> }` on the props payload
	   passed to user click/mouse handlers. Curve's `<path>` writes via callback
	   into `pathRef.current`. */
	/* Signal-backed so the dasharray memos re-run once the <path> ref attaches; React
	   gets the same re-measure from the re-render after onAnimationStart. */
	const [pathElement, setPathElement] = createSignal<SVGPathElement | null>(null, { ownedWrite: true })
	const pathRef: { current: SVGPathElement | null } = {
		get current() {
			return pathElement()
		},
		set current(element: SVGPathElement | null) {
			setPathElement(() => element)
		},
	}

	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks(
		() => props.allProps.onAnimationStart,
		() => props.allProps.onAnimationEnd,
	)
	/* Same content-compared identity AnimatedItems uses for its animation id. */
	const lengthAnimationId = useAnimationId(() => props.allProps.points, "recharts-line-length-")
	const getVisibleLength = useAnimatedLineLength(lengthAnimationId)

	// Guard for totalLength: don't update previousPointsRef before SVG path is measured
	const shouldUpdatePreviousRef = (animationElapsedTime: number) =>
		animationElapsedTime > 0 && getTotalLength(pathRef.current) > 0

	return (
		<LineLabelListProvider points={props.allProps.points} showLabels={!isAnimating()}>
			{/* GOTCHA-017: user JSX (ErrorBar) memoized via children() helper inside
			   SetErrorBarContext.Provider scope so createComponent(ErrorBar) captures
			   live ctx Accessor, not initial-default. Single read site. */}
			<GraphicalItemChildrenScope>{props.allProps.children}</GraphicalItemChildrenScope>
			<AnimatedItems
				animationInput={props.allProps.points}
				animationIdPrefix="recharts-line-"
				items={props.allProps.points}
				previousItemsRef={props.previousPointsRef}
				isAnimationActive={props.allProps.isAnimationActive}
				animationBegin={props.allProps.animationBegin}
				animationDuration={props.allProps.animationDuration}
				animationEasing={props.allProps.animationEasing}
				onAnimationStart={handleAnimationStart}
				onAnimationEnd={handleAnimationEnd}
				animationInterpolateFn={props.allProps.animationInterpolateFn}
				animationMatchBy={props.allProps.animationMatchBy}
				shouldUpdatePreviousRef={shouldUpdatePreviousRef}
				layout={props.allProps.layout}
			>
				{(stepData, animationElapsedTime, isEntrance) => {
					const animationActive = () => isAnimating() || animationElapsedTime() < 1
					const visibleLength = createMemo(() =>
						animationActive()
							? getVisibleLength(animationElapsedTime(), getTotalLength(pathRef.current))
							: null,
					)
					return (
						<StaticCurve
							allProps={props.allProps}
							points={stepData()}
							clipPathId={props.clipPathId}
							pathRef={pathRef}
							animationElapsedTime={animationElapsedTime()}
							isAnimating={animationActive()}
							isEntrance={isEntrance()}
							visibleLength={visibleLength()}
						/>
					)
				}}
			</AnimatedItems>
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
	animationInterpolateFn: defaultLineAnimateItems,
	animationMatchBy: matchByIndex,
	connectNulls: false,
	dot: true,
	fill: "#fff",
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "line",
	shape: LineDrawShape,
	stroke: "#3182bd",
	strokeWidth: 1,
	type: "linear",
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.line,
} as const satisfies Partial<Props>

function LineImpl(props: WithIdRequired<Props>) {
	const resolved = resolveDefaultProps(props, defaultLineProps)

	const needClipResult = createMemo(() => useNeedsClip(resolved.xAxisId, resolved.yAxisId))
	/* arrow thunks: bare hooks, but callsites repeatedly read inside Show predicate
	   and render-fn — thunk preserves callsite shape and reactivity. See GOTCHA-011. */
	const plotArea = createMemo(() => usePlotArea())
	const layout = createMemo(() => useChartLayout())
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const stateCtx = useOptionalChartState()
	/* perf: createMemo caches selectLinePoints result; without it, every consumer
	   read during the animation loop triggers a fresh selector chain (selectLinePoints
	   → selectAxisWithScale → axis recompute), costing 16ms/frame. Memoizing collapses
	   that to one recompute per store-change.
	   Axis reactivity: selectLinePoints reads ctx.store.cartesianAxes (a Solid store
	   proxy) without untrack — this memo tracks those signals directly.
	   Item reactivity: explicit read of stateCtx.state.graphicalItems[id] tracks mutations
	   to graphicalItems (e.g. dataKey change) and passes updated settings to the selector. */
	const points = createMemo(() => {
		const rawItem = stateCtx?.state.graphicalItems[resolved.id]
		const itemSettings =
			rawItem != null && rawItem.type === "line"
				? (rawItem as import("../state/chartState").LineState).settings
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
function LineFn(outsideProps: Props) {
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
							formatter={props.formatter}
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
							<LabelListContextBridge>
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
							</LabelListContextBridge>
						</SetErrorBarContext>
					</>
				)
			}}
		</RegisterGraphicalItemId>
	)
}

/**
 * Typed entry point: the generics constrain `data`/`dataKey` at the call site, like upstream.
 */
/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export const Line = LineFn as {
	<DataPointType = any, DataValueType = any>(props: Props<DataPointType, DataValueType>): JSX.Element
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream fallback overload for mismatched data/dataKey */
	(props: Props<any, any>): JSX.Element
	displayName?: string
}
Line.displayName = "Line"
