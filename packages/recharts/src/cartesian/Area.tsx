/* eslint-disable import/no-cycle, sort-keys */
import type { Formatter } from "../component/DefaultTooltipContent"
import { createMemo, Show, createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { clsx } from "clsx"
import type { BaseLineType, CurveType, Props as CurveProps } from "../shape/Curve"
import { Layer } from "../container/Layer"
import {
	LabelListContextBridge,
	CartesianLabelListContextProvider,
	type CartesianLabelListEntry,
	type ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import type { DotsDotProps } from "../component/Dots"
import { Dots } from "../component/Dots"
import { interpolate, isNan, isNullish, isNumber, noop } from "../util/DataUtils"
import {
	getCateCoordinateOfLine,
	getNormalizedStackId,
	getTooltipNameProp,
	getValueByDataKey,
	type StackId,
} from "../util/ChartUtils"
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
	NullableCoordinate,
	TickItem,
	TooltipType,
	TrapezoidViewBox,
} from "../util/types"
import { Shape } from "../util/ActiveShapeUtils"
import type { AnimationInterpolateFn } from "../state/types/AnimationSettings"
import { matchAnimationItems, matchByIndex } from "../animation/matchBy"
import type { AnimationItem, AnimationMatchByProp } from "../animation/matchBy"
import { isClipDot } from "../util/ReactUtils"
import type { LegendPayload } from "../component/DefaultLegendContent"
import { ActivePoints } from "../component/ActivePoints"
import type { TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { GraphicalItemClipPath, useNeedsClip } from "./GraphicalItemClipPath"
import type { BaseAxisWithScale } from "../state/selectors/axisSelectors"
import type { ChartData } from "../state/chartDataSlice"
import type { AreaPointItem, ComputedArea } from "../state/selectors/areaSelectors"
import { selectArea } from "../state/selectors/areaSelectors"
import { useOptionalChartState } from "../state/useChartState"
import { useIsPanorama } from "../context/PanoramaContext"
import { useCartesianChartLayout, useChartLayout } from "../context/chartLayoutContext"
import { useChartName } from "../state/selectors/selectors"
import { SetLegendPayload } from "../state/SetLegendPayload"
import { useChartStore } from "../state/RechartsStoreContext"
import { useAnimationId } from "../util/useAnimationId"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { usePlotArea } from "../hooks"
import type { WithIdRequired, WithoutId } from "../util/useUniqueId"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { AreaSettings } from "../state/types/AreaSettings"
import { SetCartesianGraphicalItem } from "../state/SetGraphicalItem"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import { useAnimationStartSnapshot } from "../animation/useAnimationStartSnapshot"
import { AreaRevealShape } from "./AreaRevealShape"
import type { AreaRevealShapeProps } from "./AreaRevealShape"
import { getRadiusAndStrokeWidthFromDot } from "../util/getRadiusAndStrokeWidthFromDot"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { AxisId } from "../state/cartesianAxisSlice"
import type { StackDataPoint } from "../util/stacks/stackTypes"

import { splitProps } from '../util/solid-1-compat';
/** @inline */
export type BaseValue = number | "dataMin" | "dataMax"

type BaseValueCoordinate<DataPointType = unknown> = NullableCoordinate & {
	payload: DataPointType | undefined
}

interface InternalAreaProps extends ZIndexable {
	activeDot: ActiveDotType
	animationBegin: number
	animationDuration: AnimationDuration
	animationEasing: AnimationTiming
	baseLine: BaseLineType | undefined

	baseValue?: BaseValue
	className?: string
	connectNulls: boolean
	data?: ChartData
	dataKey: DataKey<unknown>
	dot: DotType
	height: number
	hide: boolean
	id: string
	isAnimationActive: boolean | "auto"
	isRange?: boolean
	label?: ImplicitLabelListType
	layout: CartesianLayout
	left: number
	legendType: LegendType
	name?: string | number
	needClip: boolean
	onAnimationEnd?: () => void
	onAnimationStart?: () => void
	points: ReadonlyArray<AreaPointItem>
	shape: ActiveShape<AreaRevealShapeProps, SVGPathElement>
	animationInterpolateFn: AnimationInterpolateFn<AreaPointItem, CartesianLayout>
	animationMatchBy: AnimationMatchByProp<AreaPointItem>
	stackId?: StackId
	tooltipType?: TooltipType
	formatter?: Formatter
	top: number
	type?: CurveType
	unit?: string | number
	width: number
	xAxisId: string | number
	yAxisId: string | number
	children?: JSX.Element
}

interface AreaProps<DataPointType = unknown, DataValueType = unknown>
	extends
		DataProvider<DataPointType>,
		Required<DataConsumer<DataPointType, DataValueType>>,
		ZIndexable {
	activeDot?: ActiveDotType
	animationBegin?: number
	animationDuration?: AnimationDuration
	animationEasing?: AnimationTiming
	baseLine?: BaseLineType
	baseValue?: BaseValue
	className?: string
	connectNulls?: boolean
	dot?: DotType
	hide?: boolean
	id?: string
	isAnimationActive?: boolean | "auto"
	isRange?: boolean
	label?: ImplicitLabelListType
	legendType?: LegendType
	name?: string | number
	onAnimationEnd?: () => void
	onAnimationStart?: () => void
	/**
	 * The shape of the area. Defaults to `AreaRevealShape`, which reveals the area with a
	 * clip-path during the entrance animation.
	 * During animations, a function shape also receives `animationElapsedTime`, `isAnimating`, and `isEntrance`.
	 */
	shape?: ActiveShape<AreaRevealShapeProps, SVGPathElement>
	/**
	 * Custom animation function for interpolating data items.
	 * When provided, this replaces the default animation interpolation.
	 *
	 * @since 3.9
	 * @see {@link https://recharts.github.io/en-US/guide/animations/ Animations guide}
	 */
	animationInterpolateFn?: AnimationInterpolateFn<AreaPointItem, CartesianLayout>
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
	animationMatchBy?: AnimationMatchByProp<AreaPointItem>
	stackId?: StackId
	stroke?: string
	strokeWidth?: string | number
	tooltipType?: TooltipType
	/**
	 * Formats the value displayed in the tooltip for this Area.
	 * When set, takes precedence over the `formatter` prop on the Tooltip component.
	 */
	formatter?: Formatter
	type?: CurveType
	unit?: string | number
	xAxisId?: AxisId
	yAxisId?: AxisId
	zIndex?: number
	children?: JSX.Element
}

type AreaSvgProps = Omit<
	CurveProps,
	"points" | "ref" | "layout" | "path" | "pathRef" | "baseLine" | "dangerouslySetInnerHTML"
>

type InternalProps = AreaSvgProps & InternalAreaProps

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type Props<DataPointType = any, DataValueType = any> = AreaSvgProps & AreaProps<DataPointType, DataValueType>

function getLegendItemColor(
	stroke: string | undefined,
	fill: string | undefined,
): string | undefined {
	return stroke && stroke !== "none" ? stroke : fill
}

/* eslint-disable solid/reactivity -- plain utility fn; areaProps is not a Solid reactive proxy at this call site */
const computeLegendPayloadFromAreaData = (areaProps: Props): ReadonlyArray<LegendPayload> => {
	return [
		{
			color: getLegendItemColor(areaProps.stroke, areaProps.fill),
			dataKey: areaProps.dataKey,
			inactive: areaProps.hide,
			payload: areaProps,
			type: areaProps.legendType,
			value: getTooltipNameProp(areaProps.name, areaProps.dataKey),
		},
	]
}
/* eslint-enable solid/reactivity */

function SetAreaTooltipEntrySettings(
	props: Pick<
		WithIdRequired<Props>,
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
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.data,
		getPosition: noop,
		settings: {
			color: getLegendItemColor(props.stroke, props.fill),
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

function AreaDotsWrapper(props: {
	clipPathId: string
	points: ReadonlyArray<AreaPointItem>
	allProps: WithoutId<InternalProps>
}) {
	const areaProps = (): DotsDotProps => svgPropertiesNoEvents(props.allProps)

	return (
		<Dots
			points={props.points}
			dot={props.allProps.dot}
			className="recharts-area-dots"
			dotClassName="recharts-area-dot"
			dataKey={props.allProps.dataKey}
			baseProps={areaProps()}
			needClip={props.allProps.needClip}
			clipPathId={props.clipPathId}
		/>
	)
}

function AreaLabelListProvider(props: {
	showLabels: boolean
	children: JSX.Element
	points: ReadonlyArray<AreaPointItem>
}) {
	const labelListEntries = createMemo((): ReadonlyArray<CartesianLabelListEntry> => {
		return props.points.map((point): CartesianLabelListEntry => {
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

	/* eslint-disable solid/reactivity -- showLabels and labelListEntries() in JSX; linter can't trace through Context.Provider value prop */
	return (
		<CartesianLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</CartesianLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

function StaticArea(props: {
	points: ReadonlyArray<AreaPointItem>
	baseLine: BaseLineType | undefined
	needClip: boolean
	clipPathId: string
	allProps: InternalProps
	animationElapsedTime: number
	isAnimating: boolean
	isEntrance: boolean
}) {
	/* eslint-disable-next-line solid/reactivity -- splitProps keeps lazy getters; reads happen in the memo below */
	const [, propsWithoutId] = splitProps(props.allProps, ["id"])
	const propsWithEvents = createMemo(() => svgPropertiesAndEvents(propsWithoutId))

	return (
		<>
			<Show when={props.points?.length > 1}>
				<Layer clip-path={props.needClip ? `url(#clipPath-${props.clipPathId})` : undefined}>
					<Shape
						{...propsWithEvents()}
						shapeType="curve"
						option={props.allProps.shape}
						DefaultShape={AreaRevealShape}
						id={props.allProps.id}
						points={props.points}
						connectNulls={props.allProps.connectNulls}
						type={props.allProps.type}
						baseLine={props.baseLine}
						layout={props.allProps.layout}
						stroke={props.allProps.stroke}
						isRange={props.allProps.isRange}
						animationElapsedTime={props.animationElapsedTime}
						isAnimating={props.isAnimating}
						isEntrance={props.isEntrance}
					/>
				</Layer>
			</Show>
			<AreaDotsWrapper
				points={props.points}
				allProps={propsWithoutId as WithoutId<InternalProps>}
				clipPathId={props.clipPathId}
			/>
		</>
	)
}

function interpolateScalarBaseLine(
	baseLine: BaseLineType | undefined,
	prevBaseLine: BaseLineType | undefined,
	animationElapsedTime: number,
): BaseLineType {
	if (isNumber(baseLine)) {
		const previousNumberBaseLine = isNumber(prevBaseLine) ? prevBaseLine : undefined
		return interpolate(previousNumberBaseLine, baseLine, animationElapsedTime)
	}
	if (isNullish(baseLine) || isNan(baseLine)) {
		const previousNumberBaseLine = isNumber(prevBaseLine) ? prevBaseLine : undefined
		return interpolate(previousNumberBaseLine, 0, animationElapsedTime)
	}
	return baseLine
}

const defaultAreaAnimateItems: AnimationInterpolateFn<AreaPointItem, CartesianLayout> = (
	items,
	animationElapsedTime,
) => {
	if (items == null) {
		// First render: return items as-is, clip-path animation handles the reveal
		return []
	}
	if (animationElapsedTime === 1) {
		return items.flatMap((item) => (item.status === "removed" ? [] : [item.next]))
	}
	return items.flatMap((item) => {
		if (item.status === "matched") {
			return [
				{
					...item.next,
					x: interpolate(item.prev.x, item.next.x, animationElapsedTime),
					y: interpolate(item.prev.y, item.next.y, animationElapsedTime),
				},
			]
		}
		if (item.status === "added") {
			/*
			 * Here we just return the final position without interpolating
			 * so that we can allow the default initial animation that is done by clipPath in AreaRevealShape.
			 * If you want your own custom animations then you may want to interpolate this one as well.
			 */
			return [item.next]
		}
		// removed: drop
		return []
	})
}

function AreaWithAnimation(props: {
	needClip: boolean
	clipPathId: string
	allProps: InternalProps
	previousPointsRef: { current: ReadonlyArray<AreaPointItem> | null }
	previousBaselineRef: { current: BaseLineType | undefined }
}) {
	const animationInput = createMemo(() => ({
		baseLine: props.allProps.baseLine,
		points: props.allProps.points,
	}))
	/* Same content-compared identity AnimatedItems derives from `animationInput`. */
	const baseLineAnimationId = useAnimationId(animationInput, "recharts-area-baseline-")
	const baseLineAnimationState = useAnimationStartSnapshot(
		baseLineAnimationId,
		/* eslint-disable-next-line solid/reactivity -- the ref box is a stable mutable container */
		props.previousBaselineRef,
	)
	const layout = createMemo(() => useCartesianChartLayout())

	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks(
		() => props.allProps.onAnimationStart,
		() => props.allProps.onAnimationEnd,
	)

	const baseLineAnimationItems = createMemo((): ReadonlyArray<AnimationItem<NullableCoordinate>> | null => {
		const baseLine = props.allProps.baseLine
		const prevBaseLine = baseLineAnimationState.frozenStartValue()
		if (Array.isArray(baseLine) && Array.isArray(prevBaseLine)) {
			return matchAnimationItems<NullableCoordinate>(prevBaseLine, baseLine, props.allProps.animationMatchBy as AnimationMatchByProp<NullableCoordinate>)
		}
		if (Array.isArray(baseLine)) {
			return matchAnimationItems<NullableCoordinate>(null, baseLine, props.allProps.animationMatchBy as AnimationMatchByProp<NullableCoordinate>)
		}
		return null
	})

	return (
		<Show when={layout()}>
			{(cartesianLayout) => (
				<AreaLabelListProvider showLabels={!isAnimating()} points={props.allProps.points}>
					{props.allProps.children}
					<AnimatedItems
						animationInput={animationInput()}
						animationIdPrefix="recharts-area-"
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
						{(stepPoints, animationElapsedTime, isEntrance) => {
							const stepBaseLine = createMemo((): BaseLineType | undefined => {
								const t = animationElapsedTime()
								const baseLine = props.allProps.baseLine
								if (t === 1) {
									return baseLine
								}
								if (Array.isArray(baseLine)) {
									return (
										props.allProps.animationInterpolateFn as unknown as AnimationInterpolateFn<
											NullableCoordinate,
											CartesianLayout
										>
									)(baseLineAnimationItems(), t, cartesianLayout())
								}
								return isEntrance()
									? baseLine
									: interpolateScalarBaseLine(baseLine, baseLineAnimationState.frozenStartValue(), t)
							})
							createEffect(
								() => ({ step: stepBaseLine(), t: animationElapsedTime() }),
								({ step, t }) => {
									baseLineAnimationState.syncStepValue(step, t)
								},
							)
							return (
								<StaticArea
									points={stepPoints()}
									baseLine={stepBaseLine()}
									needClip={props.needClip}
									clipPathId={props.clipPathId}
									allProps={props.allProps}
									animationElapsedTime={animationElapsedTime()}
									isAnimating={isAnimating() || animationElapsedTime() < 1}
									isEntrance={isEntrance()}
								/>
							)
						}}
					</AnimatedItems>
					<LabelListFromLabelProp label={props.allProps.label} />
				</AreaLabelListProvider>
			)}
		</Show>
	)
}

function RenderArea(props: { needClip: boolean; clipPathId: string; allProps: InternalProps }) {
	const previousPointsRef: { current: ReadonlyArray<AreaPointItem> | null } = { current: null }
	const previousBaselineRef: { current: BaseLineType | undefined } = { current: undefined }
	return (
		<AreaWithAnimation
			needClip={props.needClip}
			clipPathId={props.clipPathId}
			allProps={props.allProps}
			previousPointsRef={previousPointsRef}
			previousBaselineRef={previousBaselineRef}
		/>
	)
}

function AreaWithState(props: InternalProps) {
	return (
		<Show when={!props.hide}>
			{(() => {
				const layerClass = () => clsx("recharts-area", props.className)
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
							<RenderArea
								needClip={props.needClip}
								clipPathId={clipPathId()}
								allProps={props}
							/>
						</Layer>
						<ActivePoints
							points={props.points}
							mainColor={getLegendItemColor(props.stroke, props.fill)}
							itemDataKey={props.dataKey}
							activeDot={props.activeDot}
							clipPath={activePointsClipPath()}
						/>
						<Show when={props.isRange && Array.isArray(props.baseLine)}>
							<ActivePoints
								points={props.baseLine as ReadonlyArray<AreaPointItem>}
								mainColor={getLegendItemColor(props.stroke, props.fill)}
								itemDataKey={props.dataKey}
								activeDot={props.activeDot}
								clipPath={activePointsClipPath()}
							/>
						</Show>
					</ZIndexLayer>
				)
			})()}
		</Show>
	)
}

export const defaultAreaProps = {
	activeDot: true,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	animationInterpolateFn: defaultAreaAnimateItems,
	animationMatchBy: matchByIndex,
	connectNulls: false,
	dot: false,
	fill: "#3182bd",
	fillOpacity: 0.6,
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "line",
	shape: AreaRevealShape,
	stroke: "#3182bd",
	strokeWidth: 1,
	type: "linear",
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.area,
} as const satisfies Partial<Props>

function AreaImpl(props: WithIdRequired<Props>) {
	const resolved = resolveDefaultProps(props, defaultAreaProps)
	const ctx = useChartStore()
	const stateCtx = useOptionalChartState()
	const layout = createMemo(() => useChartLayout())
	const chartName = createMemo(() => (ctx ? useChartName(ctx.store) : undefined))
	const needClipResult = createMemo(() => useNeedsClip(resolved.xAxisId, resolved.yAxisId))
	const isPanorama = useIsPanorama()

	/* perf: cache selector result; without memo every consumer read triggers full chain.
	   Axis reactivity: selectArea reads ctx.store.cartesianAxes (Solid proxy) without
	   untrack — this memo tracks those signals.
	   Item reactivity: explicit graphicalItems[id] read tracks item settings mutations. */
	const areaData = createMemo(() => {
		const rawItem = stateCtx?.state.graphicalItems[props.id]
		const itemSettings =
			rawItem != null && rawItem.type === "area"
				? (rawItem as import("../state/chartState").AreaState).settings
				: undefined
		return ctx
			? selectArea(
					ctx.store,
					props.id,
					isPanorama,
					itemSettings != null ? { areaSettings: itemSettings } : undefined,
				)
			: undefined
	})
	const plotArea = createMemo(() => usePlotArea())
	const visibleArea = createMemo(() => {
		if (
			(layout() === "horizontal" || layout() === "vertical") &&
			plotArea() != null &&
			(chartName() === "AreaChart" || chartName() === "ComposedChart") &&
			areaData()?.points?.length
		) {
			return areaData()
		}
		return undefined
	})

	return (
		<Show when={visibleArea() != null}>
			<AreaWithState
				{...resolved}
				activeDot={resolved.activeDot}
				animationBegin={resolved.animationBegin}
				animationDuration={resolved.animationDuration}
				animationEasing={resolved.animationEasing}
				baseLine={visibleArea()?.baseLine}
				connectNulls={resolved.connectNulls}
				dot={resolved.dot}
				fill={resolved.fill}
				fillOpacity={resolved.fillOpacity}
				height={plotArea()?.height ?? 0}
				hide={resolved.hide}
				layout={layout() as CartesianLayout}
				isAnimationActive={resolved.isAnimationActive}
				isRange={visibleArea()?.isRange}
				legendType={resolved.legendType}
				needClip={needClipResult()?.needClip() ?? false}
				points={visibleArea()?.points ?? []}
				stroke={resolved.stroke}
				width={plotArea()?.width ?? 0}
				left={plotArea()?.x ?? 0}
				top={plotArea()?.y ?? 0}
				xAxisId={resolved.xAxisId}
				yAxisId={resolved.yAxisId}
			/>
		</Show>
	)
}

export const getBaseValue = (
	layout: "horizontal" | "vertical",
	chartBaseValue: BaseValue | undefined,
	itemBaseValue: BaseValue | undefined,
	xAxis: BaseAxisWithScale,
	yAxis: BaseAxisWithScale,
): number => {
	const baseValue: BaseValue | undefined = itemBaseValue ?? chartBaseValue

	if (isNumber(baseValue)) {
		return baseValue as number
	}

	const numericAxis = layout === "horizontal" ? yAxis : xAxis
	const rawDomain = numericAxis.scale.domain()
	const domain: [number, number] = [Number(rawDomain[0] ?? 0), Number(rawDomain[1] ?? 0)]

	if (numericAxis.type === "number") {
		const domainMax = Math.max(domain[0], domain[1])
		const domainMin = Math.min(domain[0], domain[1])

		if (baseValue === "dataMin") {
			return domainMin
		}
		if (baseValue === "dataMax") {
			return domainMax
		}

		return domainMax < 0 ? domainMax : Math.max(Math.min(domain[0], domain[1]), 0)
	}

	if (baseValue === "dataMin") {
		return domain[0]
	}
	if (baseValue === "dataMax") {
		return domain[1]
	}

	return domain[0]
}

export function computeArea({
	areaSettings: { connectNulls, baseValue: itemBaseValue, dataKey },
	stackedData,
	layout,
	chartBaseValue,
	xAxis,
	yAxis,
	displayedData,
	dataStartIndex,
	xAxisTicks,
	yAxisTicks,
	bandSize,
	stackDataKeys,
}: {
	areaSettings: AreaSettings
	stackedData: ReadonlyArray<StackDataPoint> | undefined
	layout: "horizontal" | "vertical"
	chartBaseValue: BaseValue | undefined
	xAxis: BaseAxisWithScale
	yAxis: BaseAxisWithScale
	displayedData: ChartData
	dataStartIndex: number
	xAxisTicks: TickItem[]
	yAxisTicks: TickItem[]
	bandSize: number
	stackDataKeys?: ReadonlyArray<DataKey<unknown>>
}): ComputedArea {
	const hasStack = stackedData && stackedData.length
	const baseValue = getBaseValue(layout, chartBaseValue, itemBaseValue, xAxis, yAxis)
	const isHorizontalLayout = layout === "horizontal"
	let isRange = false

	const points: ReadonlyArray<AreaPointItem> = displayedData.map((entry, index): AreaPointItem => {
		const entryRecord =
			entry != null && typeof entry === "object"
				? (entry as Record<string, unknown>)
				: ({} as Record<string, unknown>)
		let valueAsArray: ReadonlyArray<unknown> | undefined

		if (hasStack) {
			valueAsArray = stackedData[dataStartIndex + index]
		} else {
			const rawValue = getValueByDataKey(entry, dataKey)

			if (!Array.isArray(rawValue)) {
				valueAsArray = [baseValue, rawValue]
			} else {
				valueAsArray = rawValue
				isRange = true
			}
		}

		const value1 = valueAsArray?.[1] ?? null

		const rawValue = getValueByDataKey(entry, dataKey)
		const wholeStackIsNull =
			Boolean(hasStack) &&
			rawValue == null &&
			stackDataKeys != null &&
			stackDataKeys.length > 0 &&
			stackDataKeys.every((key) => getValueByDataKey(entry, key) == null)
		const isBreakPoint =
			value1 == null ||
			(Boolean(hasStack) && !connectNulls && rawValue == null) ||
			wholeStackIsNull

		if (isHorizontalLayout) {
			return {
				payload: entry,
				value: valueAsArray,
				x: getCateCoordinateOfLine({
					axis: xAxis,
					bandSize,
					entry: entryRecord,
					index,
					ticks: xAxisTicks,
				}),
				y: isBreakPoint ? null : (yAxis.scale.map(value1) ?? null),
			}
		}

		return {
			payload: entry,
			value: valueAsArray,
			x: isBreakPoint ? null : (xAxis.scale.map(value1) ?? null),
			y: getCateCoordinateOfLine({
				axis: yAxis,
				bandSize,
				entry: entryRecord,
				index,
				ticks: yAxisTicks,
			}),
		}
	})

	let baseLine: number | NullableCoordinate[] | undefined
	if (hasStack || isRange) {
		baseLine = points.map((entry: AreaPointItem): BaseValueCoordinate => {
			const x = Array.isArray(entry.value) ? entry.value[0] : null
			if (isHorizontalLayout) {
				return {
					payload: entry.payload,
					x: entry.x,
					y: x != null && entry.y != null ? (yAxis.scale.map(x) ?? null) : null,
				}
			}
			return {
				payload: entry.payload,
				x: x != null ? (xAxis.scale.map(x) ?? null) : null,
				y: entry.y,
			}
		})
	} else {
		baseLine = isHorizontalLayout ? yAxis.scale.map(baseValue) : xAxis.scale.map(baseValue)
	}

	return {
		baseLine: baseLine ?? 0,
		isRange,
		points,
	}
}

/**
 * @provides LabelListContext
 * @consumes CartesianChartContext
 */
function AreaFn(outsideProps: Props): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps. The spread inside
	   resolveDefaultProps reads the `children` getter and eagerly invokes user JSX
	   (ErrorBar/etc.) before RegisterGraphicalItemId installs its Provider.
	   Memoize once: the `get children()` getter on user JSX re-creates components on
	   every read; without resolveChildren, downstream JSX holes re-mint ErrorBar each
	   time → infinite dispatch loop on `state.errorBars[id]`. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props = resolveDefaultProps(restProps, defaultAreaProps)
	const isPanorama = useIsPanorama()
	return (
		<RegisterGraphicalItemId id={props.id} type="area">
			{(id) => (
				<LabelListContextBridge>
					{(() => {
						/* Memoize children inside Provider scope (GOTCHA-013). */
						const memoizedChildren = createMemo(() => childrenProps.children)
						return (
							<>
								<SetLegendPayload legendPayload={computeLegendPayloadFromAreaData(props)} />
								<SetAreaTooltipEntrySettings
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
									type="area"
									id={id}
									data={props.data}
									dataKey={props.dataKey}
									xAxisId={props.xAxisId}
									yAxisId={props.yAxisId}
									zAxisId={0}
									stackId={getNormalizedStackId(props.stackId)}
									hide={props.hide}
									barSize={undefined}
									baseValue={props.baseValue}
									isPanorama={isPanorama}
									connectNulls={props.connectNulls}
								/>
								<AreaImpl {...props} id={id}>
									{memoizedChildren()}
								</AreaImpl>
							</>
						)
					})()}
				</LabelListContextBridge>
			)}
		</RegisterGraphicalItemId>
	)
}

/**
 * Typed entry point: the generics constrain props at the call site, like upstream.
 */
/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped usage accepts any data */
export const Area = AreaFn as (<DataPointType = any, DataValueType = any>(
	props: Props<DataPointType, DataValueType>,
) => JSX.Element) & { displayName?: string }
Area.displayName = "Area"
