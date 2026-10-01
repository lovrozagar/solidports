/* eslint-disable import/no-cycle, sort-keys */
import { createEffect, createMemo, createSignal, Show, splitProps, type JSX } from "solid-js"
import { clsx } from "clsx"
import type { BaseLineType, CurveType, Props as CurveProps } from "../shape/Curve"
import { Curve } from "../shape/Curve"
import { Layer } from "../container/Layer"
import {
	CartesianLabelListContextProvider,
	type CartesianLabelListEntry,
	type ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import type { DotsDotProps } from "../component/Dots"
import { Dots } from "../component/Dots"
import { Global } from "../util/Global"
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
import { isWellBehavedNumber } from "../util/isWellBehavedNumber"
import { usePlotArea } from "../hooks"
import type { WithIdRequired, WithoutId } from "../util/useUniqueId"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { AreaSettings } from "../state/types/AreaSettings"
import { SetCartesianGraphicalItem } from "../state/SetGraphicalItem"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import { getRadiusAndStrokeWidthFromDot } from "../util/getRadiusAndStrokeWidthFromDot"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { AxisId } from "../state/cartesianAxisSlice"
import type { StackDataPoint } from "../util/stacks/stackTypes"

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
	isAnimationActive: boolean
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
	stackId?: StackId
	tooltipType?: TooltipType
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
	stackId?: StackId
	stroke?: string
	strokeWidth?: string | number
	tooltipType?: TooltipType
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

export type Props = AreaSvgProps & AreaProps

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
}) {
	const allOtherProps = () => {
		const { id: _id, ...rest } = props.allProps
		return svgPropertiesNoEvents(rest)
	}
	const propsWithEvents = () => {
		const { id: _id, ...rest } = props.allProps
		return svgPropertiesAndEvents(rest)
	}

	return (
		<>
			<Show when={props.points?.length > 1}>
				<Layer clip-path={props.needClip ? `url(#clipPath-${props.clipPathId})` : undefined}>
					<Curve
						{...propsWithEvents()}
						id={props.allProps.id}
						points={props.points}
						connectNulls={props.allProps.connectNulls}
						type={props.allProps.type}
						baseLine={props.baseLine}
						layout={props.allProps.layout}
						stroke="none"
						class="recharts-area-area"
					/>
					<Show when={props.allProps.stroke !== "none"}>
						<Curve
							{...allOtherProps()}
							class="recharts-area-curve"
							layout={props.allProps.layout}
							type={props.allProps.type}
							connectNulls={props.allProps.connectNulls}
							fill="none"
							points={props.points}
						/>
					</Show>
					<Show
						when={
							props.allProps.stroke !== "none" &&
							props.allProps.isRange &&
							Array.isArray(props.baseLine)
						}
					>
						<Curve
							{...allOtherProps()}
							class="recharts-area-curve"
							layout={props.allProps.layout}
							type={props.allProps.type}
							connectNulls={props.allProps.connectNulls}
							fill="none"
							points={props.baseLine as ReadonlyArray<AreaPointItem>}
						/>
					</Show>
				</Layer>
			</Show>
			<AreaDotsWrapper
				points={props.points}
				allProps={{ ...props.allProps, id: undefined } as WithoutId<InternalProps>}
				clipPathId={props.clipPathId}
			/>
		</>
	)
}

function VerticalRect(props: {
	alpha: number
	baseLine: BaseLineType | undefined
	points: ReadonlyArray<AreaPointItem>
	strokeWidth: Props["strokeWidth"]
}) {
	const startY = () => props.points[0]?.y
	const endY = () => props.points[props.points.length - 1]?.y

	return (
		<Show when={isWellBehavedNumber(startY()) && isWellBehavedNumber(endY())}>
			{(() => {
				const height = () => props.alpha * Math.abs((startY() as number) - (endY() as number))
				const maxX = () => {
					let mx = Math.max(...props.points.map((entry) => entry.x || 0))
					if (isNumber(props.baseLine)) {
						mx = Math.max(props.baseLine as number, mx)
					} else if (props.baseLine && Array.isArray(props.baseLine) && props.baseLine.length) {
						mx = Math.max(
							...(props.baseLine as ReadonlyArray<AreaPointItem>).map((entry) => entry.x || 0),
							mx,
						)
					}
					return mx
				}

				return (
					<Show when={isNumber(maxX())}>
						<rect
							x={0}
							y={
								(startY() as number) < (endY() as number)
									? (startY() as number)
									: (startY() as number) - height()
							}
							width={maxX() + (props.strokeWidth ? parseInt(`${props.strokeWidth}`, 10) : 1)}
							height={Math.floor(height())}
						/>
					</Show>
				)
			})()}
		</Show>
	)
}

function HorizontalRect(props: {
	alpha: number
	baseLine: BaseLineType | undefined
	points: ReadonlyArray<AreaPointItem>
	strokeWidth: Props["strokeWidth"]
}) {
	const startX = () => props.points[0]?.x
	const endX = () => props.points[props.points.length - 1]?.x

	return (
		<Show when={isWellBehavedNumber(startX()) && isWellBehavedNumber(endX())}>
			{(() => {
				const width = () => props.alpha * Math.abs((startX() as number) - (endX() as number))
				const maxY = () => {
					let my = Math.max(...props.points.map((entry) => entry.y || 0))
					if (isNumber(props.baseLine)) {
						my = Math.max(props.baseLine as number, my)
					} else if (props.baseLine && Array.isArray(props.baseLine) && props.baseLine.length) {
						my = Math.max(
							...(props.baseLine as ReadonlyArray<AreaPointItem>).map((entry) => entry.y || 0),
							my,
						)
					}
					return my
				}

				return (
					<Show when={isNumber(maxY())}>
						<rect
							x={
								(startX() as number) < (endX() as number)
									? (startX() as number)
									: (startX() as number) - width()
							}
							y={0}
							width={width()}
							height={Math.floor(
								maxY() + (props.strokeWidth ? parseInt(`${props.strokeWidth}`, 10) : 1),
							)}
						/>
					</Show>
				)
			})()}
		</Show>
	)
}

function ClipRect(props: {
	alpha: number
	layout: CartesianLayout
	points: ReadonlyArray<AreaPointItem>
	baseLine: BaseLineType | undefined
	strokeWidth: Props["strokeWidth"]
}) {
	return (
		<Show
			when={props.layout === "vertical"}
			fallback={
				<HorizontalRect
					alpha={props.alpha}
					points={props.points}
					baseLine={props.baseLine}
					strokeWidth={props.strokeWidth}
				/>
			}
		>
			<VerticalRect
				alpha={props.alpha}
				points={props.points}
				baseLine={props.baseLine}
				strokeWidth={props.strokeWidth}
			/>
		</Show>
	)
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
	/* eslint-disable-next-line solid/reactivity -- animationInput is a createMemo accessor passed by reference; useAnimationId tracks it internally */
	const animationId = useAnimationId(animationInput, "recharts-area-")

	/* GOTCHA-014-G: keyed snapshot of prev at animationId flip. */
	const animationContext = createMemo(() => {
		animationId()
		return {
			prevPoints: props.previousPointsRef.current,
			prevBaseLine: props.previousBaselineRef.current,
		}
	})
	/* arrow thunk so the Show predicate re-fires on layout change.
	   Pre-flip the bare `layout != null` check below was always-true
	   (Accessor function != null); post-flip it is a real null check. */
	const layout = () => useCartesianChartLayout()

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
		<Show when={layout != null}>
			<AreaLabelListProvider showLabels={showLabels()} points={props.allProps.points}>
				{props.allProps.children}
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
						/* GOTCHA-014: thunk children — prev via effect. */
						const computed = createMemo<{
							hasPrev: boolean
							stepPoints?: ReadonlyArray<AreaPointItem>
							stepBaseLine?: BaseLineType
						}>(() => {
							const ctx = animationContext()
							const prevPoints = ctx.prevPoints
							const prevBaseLine = ctx.prevBaseLine
							const tValue = t()
							if (prevPoints) {
								const prevPointsDiffFactor = prevPoints.length / props.allProps.points.length
								const stepPoints: ReadonlyArray<AreaPointItem> =
									tValue === 1
										? props.allProps.points
										: props.allProps.points.map((entry, index): AreaPointItem => {
												const prevPointIndex = Math.floor(index * prevPointsDiffFactor)
												if (prevPoints[prevPointIndex]) {
													const prev: AreaPointItem = prevPoints[prevPointIndex]
													return {
														...entry,
														x: interpolate(prev.x, entry.x, tValue),
														y: interpolate(prev.y, entry.y, tValue),
													}
												}
												return entry
											})
								let stepBaseLine: BaseLineType
								if (isNumber(props.allProps.baseLine)) {
									stepBaseLine = interpolate(prevBaseLine, props.allProps.baseLine, tValue)
								} else if (
									isNullish(props.allProps.baseLine) ||
									isNan(props.allProps.baseLine)
								) {
									stepBaseLine = interpolate(prevBaseLine, 0, tValue)
								} else {
									stepBaseLine = (
										props.allProps.baseLine as ReadonlyArray<NullableCoordinate>
									).map((entry, index) => {
										const prevPointIndex = Math.floor(index * prevPointsDiffFactor)
										if (Array.isArray(prevBaseLine) && prevBaseLine[prevPointIndex]) {
											const prev = prevBaseLine[prevPointIndex]
											return Object.assign({}, entry, {
												x: interpolate(prev.x, entry.x, tValue),
												y: interpolate(prev.y, entry.y, tValue),
											})
										}
										return entry
									})
								}
								return { hasPrev: true, stepPoints, stepBaseLine }
							}
							return { hasPrev: false }
						})
						createEffect(() => {
							const c = computed()
							if (t() > 0) {
								if (c.hasPrev) {
									props.previousPointsRef.current = c.stepPoints ?? null
									props.previousBaselineRef.current = c.stepBaseLine
								} else {
									props.previousPointsRef.current = props.allProps.points
									props.previousBaselineRef.current = props.allProps.baseLine
								}
							}
						})
						return (
							<Show
								when={computed().hasPrev}
								fallback={
									<Layer>
										<Show when={props.allProps.isAnimationActive}>
											<defs>
												<clipPath id={`animationClipPath-${props.clipPathId}`}>
													<ClipRect
														alpha={t()}
														points={props.allProps.points}
														baseLine={props.allProps.baseLine}
														layout={layout() as CartesianLayout}
														strokeWidth={props.allProps.strokeWidth}
													/>
												</clipPath>
											</defs>
										</Show>
										<Layer clip-path={`url(#animationClipPath-${props.clipPathId})`}>
											<StaticArea
												points={props.allProps.points}
												baseLine={props.allProps.baseLine}
												needClip={props.needClip}
												clipPathId={props.clipPathId}
												allProps={props.allProps}
											/>
										</Layer>
									</Layer>
								}
							>
								<StaticArea
									points={computed().stepPoints as ReadonlyArray<AreaPointItem>}
									baseLine={computed().stepBaseLine as BaseLineType}
									needClip={props.needClip}
									clipPathId={props.clipPathId}
									allProps={props.allProps}
								/>
							</Show>
						)
					}}
				</JavascriptAnimate>
				<LabelListFromLabelProp label={props.allProps.label} />
			</AreaLabelListProvider>
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
	connectNulls: false,
	dot: false,
	fill: "#3182bd",
	fillOpacity: 0.6,
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "line",
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
	const layout = () => useChartLayout()
	const chartName = createMemo(() => (ctx ? useChartName(ctx.store) : undefined))
	const needClipResult = () => useNeedsClip(resolved.xAxisId, resolved.yAxisId)
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
	const plotArea = () => usePlotArea()

	return (
		<Show
			when={
				(layout() === "horizontal" || layout() === "vertical") &&
				plotArea() != null &&
				(chartName() === "AreaChart" || chartName() === "ComposedChart") &&
				areaData()?.points?.length
					? areaData()
					: undefined
			}
			keyed
		>
			{(data) => {
				const viewBox = plotArea() as { height: number; width: number; x: number; y: number }
				return (
					<AreaWithState
						{...resolved}
						activeDot={resolved.activeDot}
						animationBegin={resolved.animationBegin}
						animationDuration={resolved.animationDuration}
						animationEasing={resolved.animationEasing}
						baseLine={data.baseLine}
						connectNulls={resolved.connectNulls}
						dot={resolved.dot}
						fill={resolved.fill}
						fillOpacity={resolved.fillOpacity}
						height={viewBox.height}
						hide={resolved.hide}
						layout={layout() as CartesianLayout}
						isAnimationActive={
							resolved.isAnimationActive === "auto" ? !Global.isSsr : resolved.isAnimationActive
						}
						isRange={data.isRange}
						legendType={resolved.legendType}
						needClip={needClipResult()?.needClip() ?? false}
						points={data.points}
						stroke={resolved.stroke}
						width={viewBox.width}
						left={viewBox.x}
						top={viewBox.y}
						xAxisId={resolved.xAxisId}
						yAxisId={resolved.yAxisId}
					/>
				)
			}}
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

		const isBreakPoint =
			value1 == null || (hasStack && !connectNulls && getValueByDataKey(entry, dataKey) == null)

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
export function Area(outsideProps: Props) {
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
			{(id) => {
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
			}}
		</RegisterGraphicalItemId>
	)
}

Area.displayName = "Area"
