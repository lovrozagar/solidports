/* eslint-disable import/no-cycle */
import type { Formatter } from "../component/DefaultTooltipContent"
import { createMemo, For, Show, untrack } from 'solid-js';
import { structurallyEqual } from "../util/structurallyEqual"
import { ShapeOption } from "../util/ShapeElementProps"
import { CellsContextProvider, createCellsRegistry } from "../context/CellsContext"
import type { CellsRegistry } from "../context/CellsContext"
import { createHoverDedupe } from "../util/hoverDedupe"
import type { JSX } from '@solidjs/web';
import { clsx } from "clsx"
import { Layer } from "../container/Layer"
import {
	LabelListContextBridge,
	CartesianLabelListContextProvider,
	type CartesianLabelListEntry,
	type ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import { Curve, type CurveType, type Props as CurveProps } from "../shape/Curve"
import type { ErrorBarDataItem, ErrorBarDataPointFormatter, ErrorBarDirection } from "./ErrorBar"
import { getLinearRegression, interpolate, isNullish } from "../util/DataUtils"
import { getCateCoordinateOfLine, getTooltipNameProp, getValueByDataKey } from "../util/ChartUtils"
import { adaptEventsOfChild } from "../util/types"
import type { CartesianLayout, ShapeAnimationProps } from "../util/types"
import type {
	ActiveShape,
	AnimationDuration,
	AnimationTiming,
	Coordinate,
	DataConsumer,
	DataKey,
	DataProvider,
	LegendType,
	NonEmptyArray,
	NullableCoordinate,
	PresentationAttributesAdaptChildEvent,
	SymbolType,
	TickItem,
	TrapezoidViewBox,
} from "../util/types"
import type { TooltipType } from "../component/DefaultTooltipContent"
import type { ScatterShapeProps } from "../util/ScatterUtils"
import { ScatterSymbol } from "../util/ScatterUtils"
import type { InnerSymbolsProp } from "../shape/Symbols"
import type { LegendPayload } from "../component/DefaultLegendContent"
import {
	useMouseClickItemDispatch,
	useMouseEnterItemDispatch,
	useMouseLeaveItemDispatch,
} from "../context/tooltipContext"
import type {
	TooltipPayload,
	TooltipPayloadConfiguration,
	TooltipPayloadEntry,
} from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { SetErrorBarContext } from "../context/ErrorBarContext"
import { GraphicalItemChildrenScope } from "../context/GraphicalItemChildrenScope"
import type { AxisId } from "../state/cartesianAxisSlice"
import { GraphicalItemClipPath, useNeedsClip } from "./GraphicalItemClipPath"
import { selectScatterPoints } from "../state/selectors/scatterSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import type { BaseAxisWithScale, ZAxisWithScale } from "../state/selectors/axisSelectors"
import { implicitZAxis } from "../state/selectors/axisSelectors"
import { useIsPanorama } from "../context/PanoramaContext"
import { selectActiveTooltipIndex } from "../state/selectors/tooltipSelectors"
import { SetLegendPayload } from "../state/SetLegendPayload"
import { DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME } from "../util/Constants"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { ScatterSettings } from "../state/types/ScatterSettings"
import { SetCartesianGraphicalItem } from "../state/SetGraphicalItem"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
} from "../util/svgPropertiesNoEvents"
import { useCartesianChartLayout } from "../context/chartLayoutContext"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import type { AnimationInterpolateFn } from "../animation/AnimatedItems"
import { matchAppend } from "../animation/matchBy"
import type { AnimationMatchByProp } from "../animation/matchBy"
import { useViewBox } from "../context/chartLayoutContext"
import type { WithIdRequired, WithoutId } from "../util/useUniqueId"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { ChartData } from "../state/chartDataSlice"

import { splitProps } from '../util/solid-1-compat';
export interface ScatterPointNode {
	x?: number | string
	y?: number | string
	z?: number | string
}

/**
 * Scatter coordinates are nullable because sometimes the point value is out of the domain,
 * and we can't compute a valid coordinate for it.
 *
 * Scatter -> Symbol ignores points with null cx or cy so those won't render if using the default shapes.
 * However: the points are exposed via various props and can be used in custom shapes so we keep them around.
 */
export interface ScatterPointItem {
	/** The x coordinate of the point center in pixels. */
	cx: number | undefined
	/** The y coordinate of the point center in pixels. */
	cy: number | undefined
	/** The x coordinate (in pixels) of the top-left corner of the rectangle that wraps the point. */
	x: number | undefined
	/** The y coordinate (in pixels) of the top-left corner of the rectangle that wraps the point. */
	y: number | undefined
	/** ScatterPointItem size is an abstract number that is used to calculate the radius of the point. */
	size: number
	/** Width of the point in pixels. */
	width: number
	/** Height of the point in pixels. */
	height: number
	node: ScatterPointNode
	payload?: unknown
	tooltipPayload?: TooltipPayload
	tooltipPosition: Coordinate
}

export type ScatterCustomizedShape =
	| ActiveShape<ScatterShapeProps, SVGPathElement & InnerSymbolsProp>
	| SymbolType

interface ScatterInternalProps extends ZIndexable {
	data?: ChartData
	xAxisId: string | number
	yAxisId: string | number
	zAxisId: string | number
	dataKey?: DataKey<unknown>
	line?: JSX.Element | ((lineProps: Record<string, unknown>) => JSX.Element) | CurveProps | boolean
	lineType: "fitting" | "joint"
	lineJointType: CurveType
	legendType: LegendType
	tooltipType?: TooltipType
	formatter?: Formatter
	className?: string
	name?: string
	activeShape?: ScatterCustomizedShape
	shape: ScatterCustomizedShape
	points: ReadonlyArray<ScatterPointItem>
	hide: boolean
	label?: ImplicitLabelListType
	isAnimationActive: boolean | "auto"
	animationBegin: number
	animationDuration: AnimationDuration
	animationEasing: AnimationTiming
	animationInterpolateFn: AnimationInterpolateFn<ScatterPointItem, CartesianLayout>
	animationMatchBy: AnimationMatchByProp<ScatterPointItem>
	needClip: boolean
	id: GraphicalItemId
	children?: JSX.Element
}

interface ScatterProps<DataPointType = unknown, DataValueType = unknown>
	extends DataProvider<DataPointType>, DataConsumer<DataPointType, DataValueType>, ZIndexable {
	id?: string
	xAxisId?: AxisId
	yAxisId?: AxisId
	zAxisId?: AxisId
	line?: JSX.Element | ((lineProps: Record<string, unknown>) => JSX.Element) | CurveProps | boolean
	lineType?: "fitting" | "joint"
	lineJointType?: CurveType
	legendType?: LegendType
	tooltipType?: TooltipType
	/**
	 * Formats the value displayed in the tooltip for this Scatter.
	 * When set, takes precedence over the `formatter` prop on the Tooltip component.
	 */
	formatter?: Formatter
	className?: string
	name?: string
	activeShape?: ScatterCustomizedShape
	shape?: ScatterCustomizedShape
	hide?: boolean
	label?: ImplicitLabelListType
	isAnimationActive?: boolean | "auto"
	animationBegin?: number
	animationDuration?: AnimationDuration
	animationEasing?: AnimationTiming
	/**
	 * Custom animation function for interpolating data items.
	 * When provided, this replaces the default animation interpolation.
	 *
	 * @since 3.9
	 * @see {@link https://recharts.github.io/en-US/guide/animations/ Animations guide}
	 */
	animationInterpolateFn?: AnimationInterpolateFn<ScatterPointItem, CartesianLayout>
	/**
	 * Strategy for matching previous items to next items during animation.
	 *
	 * - `matchAppend` (default): match sequentially by index and treat newly appended items as new
	 * - `matchByIndex`: match by array position with proportional stretching
	 * - `matchByDataKey('someKey')`: match by a data key from the payload
	 * - Custom function `(item, index) => key`: match by the returned key
	 *
	 * @defaultValue append
	 */
	animationMatchBy?: AnimationMatchByProp<ScatterPointItem>
	zIndex?: number
	children?: JSX.Element
}

type BaseScatterSvgProps = Omit<
	PresentationAttributesAdaptChildEvent<ScatterPointItem, SVGGraphicsElement>,
	"points" | "ref" | "children" | "dangerouslySetInnerHTML"
>

type InternalProps = BaseScatterSvgProps & ScatterInternalProps

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type Props<DataPointType = any, DataValueType = any> = BaseScatterSvgProps & ScatterProps<DataPointType, DataValueType>

/* eslint-disable solid/reactivity -- plain utility fn; Props parameter is not a Solid reactive proxy at this call site */
const computeLegendPayloadFromScatterProps = (
	scatterProps: Props,
): ReadonlyArray<LegendPayload> => {
	return [
		{
			color: scatterProps.fill,
			dataKey: scatterProps.dataKey,
			inactive: scatterProps.hide,
			payload: scatterProps,
			type: scatterProps.legendType,
			value: getTooltipNameProp(scatterProps.name, scatterProps.dataKey),
		},
	]
}
/* eslint-enable solid/reactivity */

function SetScatterTooltipEntrySettings(props: {
	dataKey?: DataKey<unknown> | undefined
	points?: ReadonlyArray<ScatterPointItem>
	stroke?: string
	strokeWidth?: number | string
	fill?: string
	name?: string
	hide?: boolean
	tooltipType?: TooltipType
	formatter?: Formatter
	id: GraphicalItemId
}) {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.points?.map((p: ScatterPointItem) => p.tooltipPayload),
		getPosition: (index) => props.points?.[Number(index)]?.tooltipPosition,
		settings: {
			color: props.fill,
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
			unit: "",
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

function ScatterLine(props: {
	points: ReadonlyArray<ScatterPointItem>
	allProps: WithoutId<InternalProps>
}) {
	return (
		<Show when={props.allProps.line}>
			{(() => {
				const scatterProps = () => svgPropertiesNoEvents(props.allProps)
				const customLineProps = () => svgPropertiesNoEventsFromUnknown(props.allProps.line)
				const linePoints = (): ReadonlyArray<NullableCoordinate> => {
					if (props.allProps.lineType === "joint") {
						return props.points.map((entry) => ({ x: entry.cx ?? null, y: entry.cy ?? null }))
					}
					if (props.allProps.lineType === "fitting" && props.points.length > 0) {
						const { xmin, xmax, a, b } = getLinearRegression(
							props.points as NonEmptyArray<ScatterPointItem>,
						)
						const linearExp = (x: number) => a * x + b
						return [
							{ x: xmin, y: linearExp(xmin) },
							{ x: xmax, y: linearExp(xmax) },
						]
					}
					return []
				}

				const lineProps = () => {
					const sp: Record<string, unknown> = scatterProps()
					const clp = customLineProps()
					const strokeFromFill = typeof sp?.fill === "string" ? sp.fill : undefined
					return {
						...sp,
						...clp,
						fill: typeof clp?.fill === "string" ? clp.fill : "none",
						points: linePoints(),
						stroke: typeof clp?.stroke === "string" ? clp.stroke : strokeFromFill,
					}
				}

				/* element: cloned with lineProps; function: called with them; otherwise a Curve */
				return (
					<Layer class="recharts-scatter-line">
						<ShapeOption
							option={typeof props.allProps.line === "boolean" ? undefined : props.allProps.line}
							shapeProps={lineProps() as Record<string, unknown>}
							renderDefault={(shapeProps) => <Curve {...shapeProps} type={props.allProps.lineJointType} />}
						/>
					</Layer>
				)
			})()}
		</Show>
	)
}

function ScatterLabelListProvider(props: {
	showLabels: boolean
	points: ReadonlyArray<ScatterPointItem>
	children: JSX.Element
}) {
	const chartViewBox = createMemo(() => useViewBox())
	const labelListEntries = createMemo((): ReadonlyArray<CartesianLabelListEntry> => {
		return props.points?.map((point): CartesianLabelListEntry => {
			const viewBox: TrapezoidViewBox = {
				height: point.height,
				lowerWidth: point.width,
				upperWidth: point.width,
				width: point.width,
				x: point.x ?? 0,
				y: point.y ?? 0,
			}
			return {
				...viewBox,
				fill: undefined,
				parentViewBox: chartViewBox(),
				payload: point.payload,
				value: undefined,
				viewBox,
			}
		})
	})

	/* eslint-disable solid/reactivity -- Provider value reads labelListEntries() and props.showLabels inside JSX attribute; both are reactive */
	return (
		<CartesianLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</CartesianLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

function ScatterSymbols(
	props: ShapeAnimationProps & {
		points: ReadonlyArray<ScatterPointItem>
		showLabels: boolean
		allOtherScatterProps: InternalProps
	},
) {
	/* GOTCHA-016-C: one entry per pointer move across both event pairs, shared by all items. */
	const hover = createHoverDedupe()
	const ctx = useChartStore()
	/* perf: cache selector result; without memo every consumer read triggers full chain. */
	const activeIndex = createMemo(() => (ctx ? selectActiveTooltipIndex(ctx.store) : undefined))
	/* eslint-disable solid/reactivity -- allOtherScatterProps destructure and dataKey/id reads are stable identifiers captured once at setup; dispatch hooks take static config */
	const [idProps, allOtherPropsWithoutId] = splitProps(props.allOtherScatterProps, ["id"])
	const id = idProps.id

	const baseProps = () => svgPropertiesNoEvents(allOtherPropsWithoutId)
	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() => props.allOtherScatterProps.onMouseEnter as never,
		() => props.allOtherScatterProps.dataKey,
		String(id),
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() => props.allOtherScatterProps.onMouseLeave as never,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() => props.allOtherScatterProps.onClick as never,
		() => props.allOtherScatterProps.dataKey,
		String(id),
	)
	/* eslint-enable solid/reactivity */

	/* eslint-disable solid/reactivity -- i() is the <For> index accessor; all reads inside the For callback ARE tracked */
	return (
		<Show when={props.points?.length > 0}>
			<ScatterLine
				points={props.points as ReadonlyArray<ScatterPointItem>}
				allProps={allOtherPropsWithoutId}
			/>
			<For each={props.points}>
				{(entry: ScatterPointItem, i) => {
					const hasActiveShape = () =>
						props.allOtherScatterProps.activeShape != null &&
						props.allOtherScatterProps.activeShape !== false
					/* Memos so a hover only re-renders the points whose active state flips. */
					const isActive = createMemo(() => hasActiveShape() && activeIndex() === String(i()))
					const option = createMemo(() =>
						hasActiveShape() && isActive()
							? props.allOtherScatterProps.activeShape
							: props.allOtherScatterProps.shape,
					)
					const symbolProps = (): ScatterShapeProps => ({
						...baseProps(),
						...entry,
						animationElapsedTime: props.animationElapsedTime,
						index: i(),
						isAnimating: props.isAnimating,
						isEntrance: props.isEntrance,
						[DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME]: String(id),
					})
					/* Event handlers bind once per item, like a keyed list. */
					const handlerIndex = untrack(i)
					const adapted = untrack(
						() =>
							(adaptEventsOfChild(
								props.allOtherScatterProps as unknown as Record<string, unknown>,
								entry,
								handlerIndex,
							) ?? {}) as Record<string, ((e: Event) => void) | undefined>,
					)

					/* GOTCHA-016-C: bind both pairs, dedupe per-instance. Compose adapted user handlers. */
					const enter = onMouseEnterFromContext(entry, handlerIndex)
					const leave = onMouseLeaveFromContext(entry, handlerIndex)
					const userOver = adapted.onMouseOver
					const userOut = adapted.onMouseOut
					const fireEnter = (e: MouseEvent & { currentTarget: SVGElement }) => {
						if (!hover.enter(e)) return
						userOver?.(e)
						enter(e)
					}
					const fireLeave = (e: MouseEvent & { currentTarget: SVGElement }) => {
						if (!hover.leave(e)) return
						userOut?.(e)
						leave(e)
					}
					return (
						<ZIndexLayer zIndex={isActive() ? DefaultZIndexes.activeDot : undefined}>
							<Layer
								class="recharts-scatter-symbol"
								{...adapted}
								onMouseEnter={fireEnter}
								onMouseOver={fireEnter}
								onMouseLeave={fireLeave}
								onMouseOut={fireLeave}
								onClick={onClickFromContext(entry, handlerIndex)}
							>
								<ScatterSymbol option={option()} isActive={isActive()} {...symbolProps()} />
							</Layer>
						</ZIndexLayer>
					)
				}}
			</For>
		</Show>
	)
	/* eslint-enable solid/reactivity */
}

const defaultScatterAnimateItems: AnimationInterpolateFn<ScatterPointItem, CartesianLayout> = (
	items,
	animationElapsedTime,
) => {
	if (items == null) return []
	if (animationElapsedTime === 1) {
		return items.flatMap((item) => (item.status === "removed" ? [] : [item.next]))
	}
	return items.flatMap((item) => {
		if (item.status === "removed") return []
		if (item.status === "matched") {
			return [
				{
					...item.next,
					cx: item.next.cx == null ? undefined : interpolate(item.prev.cx, item.next.cx, animationElapsedTime),
					cy: item.next.cy == null ? undefined : interpolate(item.prev.cy, item.next.cy, animationElapsedTime),
					size: interpolate(item.prev.size, item.next.size, animationElapsedTime),
				},
			]
		}
		// added
		return [{ ...item.next, size: interpolate(0, item.next.size, animationElapsedTime) }]
	})
}

function SymbolsWithAnimation(props: {
	allProps: InternalProps
	previousPointsRef: { current: ReadonlyArray<ScatterPointItem> | null }
}) {
	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks()
	const layout = createMemo(() => useCartesianChartLayout())

	return (
		<Show when={layout()}>
			{(cartesianLayout) => (
				<ScatterLabelListProvider showLabels={!isAnimating()} points={props.allProps.points}>
					<AnimatedItems
						animationInput={props.allProps.points}
						animationIdPrefix="recharts-scatter-"
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
						layout={cartesianLayout()}
					>
						{(stepData, animationElapsedTime, isEntrance) => (
							<Layer>
								<ScatterSymbols
									points={stepData()}
									allOtherScatterProps={props.allProps}
									showLabels={!isAnimating()}
									animationElapsedTime={animationElapsedTime()}
									isAnimating={isAnimating() || animationElapsedTime() < 1}
									isEntrance={isEntrance()}
								/>
							</Layer>
						)}
					</AnimatedItems>
					<LabelListFromLabelProp label={props.allProps.label} />
				</ScatterLabelListProvider>
			)}
		</Show>
	)
}

function RenderSymbols(props: { allProps: InternalProps }) {
	const previousPointsRef: { current: ReadonlyArray<ScatterPointItem> | null } = { current: null }
	return (
		<SymbolsWithAnimation
			allProps={props.allProps}
			previousPointsRef={previousPointsRef}
		/>
	)
}

export function computeScatterPoints({
	displayedData,
	xAxis,
	yAxis,
	zAxis,
	scatterSettings,
	xAxisTicks,
	yAxisTicks,
	cells,
}: {
	displayedData: ReadonlyArray<unknown>
	xAxis: BaseAxisWithScale
	yAxis: BaseAxisWithScale
	zAxis: ZAxisWithScale | undefined
	scatterSettings: ScatterSettings
	xAxisTicks: ReadonlyArray<TickItem> | undefined
	yAxisTicks: ReadonlyArray<TickItem> | undefined
	cells: ReadonlyArray<JSX.Element> | undefined
}): ReadonlyArray<ScatterPointItem> {
	const xAxisDataKey = isNullish(xAxis.dataKey) ? scatterSettings.dataKey : xAxis.dataKey
	const yAxisDataKey = isNullish(yAxis.dataKey) ? scatterSettings.dataKey : yAxis.dataKey
	const zAxisDataKey = zAxis && zAxis.dataKey
	const defaultRangeZ = zAxis ? zAxis.range : implicitZAxis.range
	const defaultZ = defaultRangeZ && defaultRangeZ[0]
	const xBandSize = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() : 0
	const yBandSize = yAxis.scale.bandwidth ? yAxis.scale.bandwidth() : 0
	return displayedData.map((entry: unknown, index): ScatterPointItem => {
		const x: unknown = getValueByDataKey(entry, xAxisDataKey)
		const y: unknown = getValueByDataKey(entry, yAxisDataKey)
		const z: unknown = (!isNullish(zAxisDataKey) && getValueByDataKey(entry, zAxisDataKey)) || "-"

		const tooltipPayload: Array<TooltipPayloadEntry> = [
			{
				dataKey: xAxisDataKey,
				graphicalItemId: scatterSettings.id,
				name: isNullish(xAxis.dataKey) ? scatterSettings.name : xAxis.name || String(xAxis.dataKey),
				payload: entry,
				type: scatterSettings.tooltipType,
				unit: xAxis.unit || "",
				value: x as number,
			},
			{
				dataKey: yAxisDataKey,
				graphicalItemId: scatterSettings.id,
				name: isNullish(yAxis.dataKey) ? scatterSettings.name : yAxis.name || String(yAxis.dataKey),
				payload: entry,
				type: scatterSettings.tooltipType,
				unit: yAxis.unit || "",
				value: y as number,
			},
		]

		if (z !== "-" && zAxis != null) {
			tooltipPayload.push({
				dataKey: zAxisDataKey,
				graphicalItemId: scatterSettings.id,
				name: zAxis.name || (zAxis.dataKey as string),
				payload: entry,
				type: scatterSettings.tooltipType,
				unit: zAxis.unit || "",
				value: z as number,
			})
		}

		const cx: number | null = getCateCoordinateOfLine({
			axis: xAxis,
			bandSize: xBandSize,
			dataKey: xAxisDataKey,
			entry: entry as Record<string, unknown>,
			index,
			ticks: xAxisTicks,
		})
		const cy = getCateCoordinateOfLine({
			axis: yAxis,
			bandSize: yBandSize,
			dataKey: yAxisDataKey,
			entry: entry as Record<string, unknown>,
			index,
			ticks: yAxisTicks,
		})
		const size = z !== "-" && zAxis != null ? zAxis.scale.map(z) : defaultZ
		const radius = size == null ? 0 : Math.sqrt(Math.max(size, 0) / Math.PI)

		return {
			...(entry as Record<string, unknown>),
			cx,
			cy,
			height: 2 * radius,
			node: { x, y, z } as ScatterPointNode,
			payload: entry,
			size,
			tooltipPayload,
			tooltipPosition: { x: cx as number, y: cy as number },
			width: 2 * radius,
			x: cx == null ? undefined : cx - radius,
			y: cy == null ? undefined : cy - radius,
			...(cells && cells[index] && (cells[index] as { props?: Record<string, unknown> }).props),
		} as ScatterPointItem
	})
}

const errorBarDataPointFormatter: ErrorBarDataPointFormatter<ScatterPointItem> = (
	dataPoint: ScatterPointItem,
	dataKey,
	direction: ErrorBarDirection,
): ErrorBarDataItem => {
	return {
		errorVal: getValueByDataKey(dataPoint, dataKey) as number | number[] | undefined,
		value: direction === "x" ? Number(dataPoint.node.x) : Number(dataPoint.node.y),
		x: dataPoint.cx,
		y: dataPoint.cy,
	}
}

function ScatterWithId(props: InternalProps) {
	return (
		<Show when={!props.hide}>
			{(() => {
				const layerClass = () => clsx("recharts-scatter", props.className)
				const clipPathId = () => props.id

				return (
					<ZIndexLayer zIndex={props.zIndex}>
						<Layer
							class={layerClass()}
							clip-path={props.needClip ? `url(#clipPath-${clipPathId()})` : undefined}
							id={props.id}
						>
							<Show when={props.needClip}>
								<defs>
									<GraphicalItemClipPath
										clipPathId={clipPathId()}
										xAxisId={props.xAxisId}
										yAxisId={props.yAxisId}
									/>
								</defs>
							</Show>
							{/* GOTCHA-017 (session 34): SetErrorBarContext hoisted to Scatter()
							   outer scope so user <ErrorBar/> evaluates inside the live Provider
							   owner. RenderSymbols + children are now inside that Provider via the
							   wrapper at outer scope. */}
							<Layer>
								<RenderSymbols allProps={props} />
							</Layer>
							<GraphicalItemChildrenScope>{props.children}</GraphicalItemChildrenScope>
						</Layer>
					</ZIndexLayer>
				)
			})()}
		</Show>
	)
}

export const defaultScatterProps = {
	animationBegin: 0,
	animationDuration: 400,
	animationEasing: "linear",
	animationInterpolateFn: defaultScatterAnimateItems,
	animationMatchBy: matchAppend,
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "circle",
	line: false,
	lineJointType: "linear",
	lineType: "joint",

	shape: "circle",
	xAxisId: 0,
	yAxisId: 0,
	zAxisId: 0,
	zIndex: DefaultZIndexes.scatter,
} as const satisfies Partial<Props>

function ScatterImpl(props: WithIdRequired<Props> & { cellsRegistry: CellsRegistry }) {
	/* GOTCHA-017: split children, route via JSX child slot only. ErrorBar must
	   evaluate inside SetErrorBarContext (deeper, in ScatterWithId), wrapped by
	   GraphicalItemChildrenScope. */
	const [childrenProps, restProps] = splitProps(props, ["children"])
	const resolved = resolveDefaultProps(restProps, defaultScatterProps)

	const needClipResult = createMemo(() => useNeedsClip(resolved.xAxisId, resolved.yAxisId))
	const cells = createMemo((): ReadonlyArray<Record<string, unknown>> | undefined => {
		const list = props.cellsRegistry.cells()
		return list.length === 0 ? undefined : (list as unknown as ReadonlyArray<Record<string, unknown>>)
	})
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()

	/* Per-chart chartSelector memo keyed by ids and cells; settings come from the store. */
	const points = createMemo(() => {
		return ctx
			? selectScatterPoints(
					ctx.store,
					resolved.xAxisId,
					resolved.yAxisId,
					resolved.zAxisId,
					props.id,
					cells(),
					isPanorama,
				)
			: undefined
		/* selectors rebuild equal points after unrelated store writes; keep the previous
		   array so the keyed point list does not remount every symbol */
	}, { equals: structurallyEqual })

	return (
		<Show when={needClipResult() != null && points() != null}>
			<>
				<SetScatterTooltipEntrySettings
					dataKey={props.dataKey}
					points={points() as ReadonlyArray<ScatterPointItem>}
					stroke={props.stroke}
					strokeWidth={props["stroke-width"]}
					fill={props.fill}
					name={props.name}
					hide={props.hide}
					tooltipType={props.tooltipType}
					formatter={props.formatter}
					id={props.id}
				/>
				<ScatterWithId
					{...resolved}
					xAxisId={resolved.xAxisId}
					yAxisId={resolved.yAxisId}
					zAxisId={resolved.zAxisId}
					lineType={resolved.lineType}
					lineJointType={resolved.lineJointType}
					legendType={resolved.legendType}
					shape={resolved.shape}
					hide={resolved.hide}
					isAnimationActive={resolved.isAnimationActive}
					animationBegin={resolved.animationBegin}
					animationDuration={resolved.animationDuration}
					animationEasing={resolved.animationEasing}
					points={points() as ReadonlyArray<ScatterPointItem>}
					needClip={needClipResult()?.needClip() ?? false}
				>
					{childrenProps.children}
				</ScatterWithId>
			</>
		</Show>
	)
}

/**
 * @provides LabelListContext
 * @provides ErrorBarContext
 * @provides CellReader
 * @consumes CartesianChartContext
 */
function ScatterFn(outsideProps: Props): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps so user JSX (ErrorBar) is
	   not eagerly invoked at Scatter setup, before RegisterGraphicalItemId installs
	   its Provider. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props = resolveDefaultProps(restProps, defaultScatterProps)
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	return (
		<RegisterGraphicalItemId id={props.id} type="scatter">
			{(id) => {
				/* perf: cache selector result; without memo every consumer read triggers full chain. */
				const points = createMemo(() =>
					ctx
						? selectScatterPoints(
								ctx.store,
								props.xAxisId,
								props.yAxisId,
								props.zAxisId,
								id,
								undefined,
								isPanorama,
							)
						: undefined,
				)
				return (
					<>
						<SetLegendPayload legendPayload={computeLegendPayloadFromScatterProps(props)} />
						<SetCartesianGraphicalItem
							type="scatter"
							id={id}
							data={props.data}
							xAxisId={props.xAxisId}
							yAxisId={props.yAxisId}
							zAxisId={props.zAxisId}
							dataKey={props.dataKey}
							hide={props.hide}
							name={props.name}
							tooltipType={props.tooltipType}
							isPanorama={isPanorama}
						/>
						<SetErrorBarContext
							xAxisId={props.xAxisId}
							yAxisId={props.yAxisId}
							data={points()}
							dataPointFormatter={errorBarDataPointFormatter}
							errorBarOffset={0}
						>
							<LabelListContextBridge>
								{(() => {
									/* <Cell/> children register here; upstream reads them with findAllByType. */
									const cellsRegistry = createCellsRegistry()
									return (
										<CellsContextProvider value={cellsRegistry}>
										{(() => {
											/* GOTCHA-017 (session 34): memoize children INSIDE SetErrorBarContext.
											   createMemo establishes its owner at the call site — by placing it
											   here, the ErrorBar JSX evaluates with the live SetErrorBarContext
											   in scope. Without the memo, repeated reads of props.children re-mint
											   ErrorBar and loop the addErrorBar dispatch. */
											const memoizedChildren = createMemo(() => childrenProps.children)
											return (
												<ScatterImpl {...props} id={id} cellsRegistry={cellsRegistry}>
													{memoizedChildren()}
												</ScatterImpl>
											)
										})()}
										</CellsContextProvider>
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
 * Typed entry point: the generics constrain props at the call site, like upstream.
 */
/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped usage accepts any data */
export const Scatter = ScatterFn as {
	<DataPointType = any, DataValueType = any>(props: Props<DataPointType, DataValueType>): JSX.Element
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream fallback overload for mismatched data/dataKey */
	(props: Props<any, any>): JSX.Element
	displayName?: string
}
Scatter.displayName = "Scatter"
