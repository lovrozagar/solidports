/* eslint-disable import/no-cycle, sort-keys */
import type { JSX } from '@solidjs/web';
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { WithoutRemoveFalse } from "../util/types"
import type { CamelCaseSVGAttrs } from "../util/CamelCaseSVGAttrs"
import { createMemo, Show, useContext, createEffect } from 'solid-js';
import last from "es-toolkit/compat/last"

import { clsx } from "clsx"
import { interpolate, isNullish, noop } from "../util/DataUtils"
import { polarToCartesian } from "../util/PolarUtils"
import { getTooltipNameProp, getValueByDataKey } from "../util/ChartUtils"
import { Polygon } from "../shape/Polygon"
import { Layer } from "../container/Layer"
import {
	LabelListContextBridge,
	CartesianLabelListContextProvider,
	CartesianLabelListEntry,
	ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import { Dots } from "../component/Dots"
import {
	ActiveDotType,
	AnimationDuration,
	AnimationTiming,
	DataConsumer,
	DataKey,
	DotType,
	LegendType,
	TooltipType,
	TrapezoidViewBox,
} from "../util/types"
import type { LegendPayload } from "../component/DefaultLegendContent"
import { ActivePoints } from "../component/ActivePoints"
import { TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { selectRadarPoints } from "../state/selectors/radarSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { RechartsStateContext } from "../state/RechartsStateContext"
import type { AngleAxisSettings, RadiusAxisSettings } from "../state/polarAxisSlice"
import { useIsPanorama } from "../context/PanoramaContext"
import { SetPolarLegendPayload } from "../state/SetLegendPayload"
import { useAnimationId } from "../util/useAnimationId"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { SetPolarGraphicalItem } from "../state/SetGraphicalItem"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import type { AnimationInterpolateFn } from "../animation/AnimatedItems"
import { matchAnimationItems, matchByIndex } from "../animation/matchBy"
import type { AnimationMatchByProp } from "../animation/matchBy"
import { useAnimationStartSnapshot } from "../animation/useAnimationStartSnapshot"
import { usePolarChartLayout } from "../context/chartLayoutContext"
import type { PolarLayout } from "../util/types"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { WithIdRequired } from "../util/useUniqueId"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { RechartsScale } from "../util/scale/RechartsScale"

import { mergeProps, splitProps } from '../util/solid-1-compat';
export interface RadarPoint {
	x: number
	y: number
	cx?: number
	cy?: number
	angle: number
	radius?: number
	value?: number
	payload?: unknown
	name?: string | number
}

interface RadarProps<DataPointType = unknown, DataValueType = unknown>
	extends ZIndexable, DataConsumer<DataPointType, DataValueType> {
	/**
	 * @defaultValue true
	 */
	activeDot?: ActiveDotType
	/**
	 * @defaultValue 0
	 */
	angleAxisId?: string | number
	/**
	 * Specifies when the animation should begin, the unit of this option is ms.
	 * @defaultValue 0
	 */
	animationBegin?: number
	/**
	 * Specifies the duration of animation, the unit of this option is ms.
	 * @defaultValue 1500
	 */
	animationDuration?: AnimationDuration
	/**
	 * The type of easing function.
	 * @defaultValue ease
	 */
	animationEasing?: AnimationTiming
	/**
	 * Custom animation function for interpolating data items.
	 * When provided, this replaces the default animation interpolation.
	 *
	 * @since 3.9
	 * @see {@link https://recharts.github.io/en-US/guide/animations/ Animations guide}
	 */
	animationInterpolateFn?: AnimationInterpolateFn<RadarPoint, PolarLayout>
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
	animationMatchBy?: AnimationMatchByProp<RadarPoint>
	baseLinePoints?: RadarPoint[]
	className?: string
	connectNulls?: boolean
	/**
	 * Renders a circle element at each data point. Options:
	 *
	 * - `false`: no dots are drawn;
	 * - `true`: renders the dots with default settings;
	 * - `object`: the props of the dot. This will be merged with the internal calculated props of each dot;
	 * - `Element`: the custom dot element;
	 * - `function`: a render function of the custom dot.
	 *
	 * @defaultValue false
	 */
	dot?: DotType
	/**
	 * @defaultValue false
	 */
	hide?: boolean
	/**
	 * If set false, animation of polygon will be disabled.
	 * If set "auto", animation is disabled during SSR and when the user prefers reduced motion.
	 * @defaultValue auto
	 */
	isAnimationActive?: boolean | "auto"
	isRange?: boolean
	/**
	 * Renders one label for each point. Options:
	 * - `true`: renders default labels;
	 * - `false`: no labels are rendered;
	 * - `object`: the props of LabelList component;
	 * - `Element`: a custom label element;
	 * - `function`: a render function of custom label.
	 *
	 * @defaultValue false
	 */
	label?: ImplicitLabelListType
	/**
	 * The type of icon in legend.  If set to 'none', no legend item will be rendered.
	 * @defaultValue rect
	 */
	legendType?: LegendType
	/**
	 * The customized event handler of animation end
	 */
	onAnimationEnd?: () => void
	/**
	 * The customized event handler of animation start
	 */
	onAnimationStart?: () => void
	onMouseEnter?: (props: InternalRadarProps, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	onMouseLeave?: (props: InternalRadarProps, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * @defaultValue 0
	 */
	radiusAxisId?: string | number

	/**
	 * If set a function, the function will be called to render customized shape.
	 */
	shape?: (props: Record<string, unknown>) => JSX.Element
	/**
	 * The name of this graphical item, used in tooltip and legend.
	 */
	name?: string | number
	tooltipType?: TooltipType
	/**
	 * @defaultValue 100
	 */
	zIndex?: number
}

export type RadiusAxisForRadar = { scale: RechartsScale }
export type AngleAxisForRadar = {
	scale: RechartsScale
	type: "number" | "category"
	dataKey: DataKey<unknown> | undefined
	cx: number
	cy: number
}

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type Props<DataPointType = any, DataValueType = any> = WithoutRemoveFalse<
	Omit<JSX.GSVGAttributes<SVGGraphicsElement>, "onMouseEnter" | "onMouseLeave" | "points" | "ref">
> &
	CamelCaseSVGAttrs &
	RadarProps<DataPointType, DataValueType>

export type RadarComposedData = {
	points: RadarPoint[]
	baseLinePoints: RadarPoint[]
	isRange: boolean
}

function getLegendItemColor(
	stroke: string | undefined,
	fill: string | undefined,
): string | undefined {
	return stroke && stroke !== "none" ? stroke : fill
}

/* eslint-disable solid/reactivity -- plain utility fn; Props parameter is not a Solid reactive proxy at this call site */
const computeLegendPayloadFromRadarSectors = (
	props: PropsWithDefaults,
): ReadonlyArray<LegendPayload> => {
	return [
		{
			color: getLegendItemColor(props.stroke, props.fill),
			dataKey: props.dataKey,
			inactive: props.hide,
			payload: props,
			type: props.legendType,
			value: getTooltipNameProp(props.name, props.dataKey),
		},
	]
}
/* eslint-enable solid/reactivity */

function SetRadarTooltipEntrySettings(
	props: Pick<
		WithIdRequired<PropsWithDefaults>,
		"dataKey" | "stroke" | "strokeWidth" | "fill" | "name" | "hide" | "tooltipType" | "id"
	>,
): JSX.Element {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		/*
		 * I suppose this here _could_ return props.points
		 * because while Radar does not support item tooltip mode, it _could_ support it.
		 * But when I actually do return the points here, a defaultIndex test starts failing.
		 * So, undefined it is.
		 */
		dataDefinedOnItem: undefined,
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
			unit: "",
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

function RadarDotsWrapper(props: {
	points: ReadonlyArray<RadarPoint>
	radarProps: PropsWithDefaults
}): JSX.Element {
	const [, propsWithoutId] = splitProps(props.radarProps, ["id", "children"])
	const baseProps = createMemo(() => svgPropertiesNoEvents(propsWithoutId))

	return (
		<Dots
			points={props.points}
			dot={props.radarProps.dot}
			className="recharts-radar-dots"
			dotClassName="recharts-radar-dot"
			dataKey={props.radarProps.dataKey}
			baseProps={baseProps()}
		/>
	)
}

export function computeRadarPoints({
	radiusAxis,
	angleAxis,
	displayedData,
	dataKey,
	bandSize,
}: {
	radiusAxis: RadiusAxisForRadar
	angleAxis: AngleAxisForRadar
	displayedData: unknown[]
	dataKey: RadarProps["dataKey"]
	bandSize: number
}): RadarComposedData {
	const { cx, cy } = angleAxis
	let isRange = false
	const points: RadarPoint[] = []
	const angleBandSize = angleAxis.type !== "number" ? (bandSize ?? 0) : 0

	displayedData.forEach((entry, i) => {
		const name = getValueByDataKey(entry, angleAxis.dataKey, i)
		const value = getValueByDataKey(entry, dataKey)
		const angle: number = (angleAxis.scale.map(name) ?? 0) + angleBandSize
		const pointValue = Array.isArray(value) ? last(value) : value
		const radius: number = isNullish(pointValue) ? 0 : (radiusAxis.scale.map(pointValue) ?? 0)

		if (Array.isArray(value) && value.length >= 2) {
			isRange = true
		}

		points.push({
			...polarToCartesian(cx, cy, radius, angle),
			angle,
			cx,
			cy,
			name,
			payload: entry,
			radius,
			value: value as number | undefined,
		})
	})
	const baseLinePoints: RadarPoint[] = []

	if (isRange) {
		points.forEach((point: RadarPoint) => {
			if (Array.isArray(point.value)) {
				const baseValue = point.value[0]
				const radius: number = isNullish(baseValue) ? 0 : (radiusAxis.scale.map(baseValue) ?? 0)

				baseLinePoints.push({
					...point,
					radius,
					...polarToCartesian(cx, cy, radius, point.angle),
				})
			} else {
				baseLinePoints.push(point)
			}
		})
	}

	return { baseLinePoints, isRange, points }
}

function RadarLabelListProvider(props: {
	showLabels: boolean
	points: ReadonlyArray<RadarPoint>
	children: JSX.Element
}): JSX.Element {
	const labelListEntries = createMemo((): ReadonlyArray<CartesianLabelListEntry> =>
		props.points.map((point): CartesianLabelListEntry => {
			const viewBox: TrapezoidViewBox = {
				height: 0,
				lowerWidth: 0,
				upperWidth: 0,
				width: 0,
				x: point.x,
				y: point.y,
			}
			return {
				...viewBox,
				fill: undefined,
				parentViewBox: undefined,
				payload: point.payload,
				value: point.value ?? "",
				viewBox,
			}
		}),
	)

	/* eslint-disable solid/reactivity -- Provider value reads labelListEntries() and props.showLabels inside JSX attribute; both are reactive */
	return (
		<CartesianLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</CartesianLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

/* eslint-disable solid/reactivity -- props.points null check and props.radarProps.shape structural check are stable at mount; event handlers close over stable references */
function StaticPolygon(props: {
	points: ReadonlyArray<RadarPoint>
	baseLinePoints: ReadonlyArray<RadarPoint>
	radarProps: InternalRadarProps
}): JSX.Element {
	return <>{renderStaticPolygon(props)}</>
}

/* Runs inside StaticPolygon's JSX expression so every reactive read is tracked. */
function renderStaticPolygon(props: {
	points: ReadonlyArray<RadarPoint>
	baseLinePoints: ReadonlyArray<RadarPoint>
	radarProps: InternalRadarProps
}): JSX.Element {
	if (props.points == null) {
		return null
	}

	/* GOTCHA-016-C: dedupe across enter/over and leave/out events so user.hover doesn't double-fire. */
	let entered = false
	const handleMouseEnter = (e: MouseEvent & { currentTarget: SVGGraphicsElement }) => {
		if (entered) return
		entered = true
		if (props.radarProps.onMouseEnter) {
			props.radarProps.onMouseEnter(props.radarProps, e)
		}
	}

	const handleMouseLeave = (e: MouseEvent & { currentTarget: SVGGraphicsElement }) => {
		if (!entered) return
		entered = false
		if (props.radarProps.onMouseLeave) {
			props.radarProps.onMouseLeave(props.radarProps, e)
		}
	}

	let radar: JSX.Element
	if (typeof props.radarProps.shape === "function") {
		radar = props.radarProps.shape({ ...props.radarProps, points: props.points })
	} else {
		radar = (
			<Polygon
				{...(svgPropertiesAndEvents(props.radarProps) as Record<string, unknown>)}
				/* GOTCHA-016-C: mirror enter/leave on over/out; the user's own over/out still fire. */
				onMouseEnter={handleMouseEnter}
				onMouseOver={(e: MouseEvent & { currentTarget: SVGGraphicsElement }) => {
					;(props.radarProps.onMouseOver as ((e: MouseEvent) => void) | undefined)?.(e)
					handleMouseEnter(e)
				}}
				onMouseLeave={handleMouseLeave}
				onMouseOut={(e: MouseEvent & { currentTarget: SVGGraphicsElement }) => {
					;(props.radarProps.onMouseOut as ((e: MouseEvent) => void) | undefined)?.(e)
					handleMouseLeave(e)
				}}
				points={props.points}
				baseLinePoints={props.radarProps.isRange ? props.baseLinePoints : undefined}
				connectNulls={props.radarProps.connectNulls}
			/>
		)
	}

	/* points attr on <g> mirrors polygon coords — getAttribute("points") detects
	   reactivity in tests; SVG <g> doesn't spec points but jsdom/browsers return
	   unknown attrs. Solid's JSX transform tracks props.points read in attr position. */
	const gProps = {
		class: "recharts-radar-polygon",
		get points() { return props.points.map((p) => `${p.x},${p.y}`).join(" ") },
	} as JSX.GSVGAttributes<SVGGElement>

	return (
		<g {...gProps}>
			{radar}
			<RadarDotsWrapper radarProps={props.radarProps} points={props.points} />
		</g>
	)
}
/* eslint-enable solid/reactivity */

const defaultRadarAnimateItems: AnimationInterpolateFn<RadarPoint, PolarLayout> = (items, animationElapsedTime) => {
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
					x: interpolate(item.prev.x, item.next.x, animationElapsedTime),
					y: interpolate(item.prev.y, item.next.y, animationElapsedTime),
				},
			]
		}
		// added: animate from center
		return [
			{
				...item.next,
				x: interpolate(item.next.cx, item.next.x, animationElapsedTime),
				y: interpolate(item.next.cy, item.next.y, animationElapsedTime),
			},
		]
	})
}

function PolygonWithAnimation(props: {
	radarProps: InternalRadarProps
	previousPointsRef: { current: ReadonlyArray<RadarPoint> | undefined }
	previousBaseLinePointsRef: { current: ReadonlyArray<RadarPoint> | undefined }
}): JSX.Element {
	/* Upstream keys the baseline snapshot on the same input as the points
	   animation; a content-compared id over `points` flips exactly when the
	   AnimatedItems animation restarts. */
	const baseLineAnimationId = useAnimationId(() => props.radarProps.points, "recharts-radar-baseline-")
	const baseLineAnimationState = useAnimationStartSnapshot(
		baseLineAnimationId,
		/* eslint-disable-next-line solid/reactivity -- the ref box is a stable mutable container */
		props.previousBaseLinePointsRef,
	)
	const baseLineAnimationItems = createMemo(() =>
		matchAnimationItems(
			baseLineAnimationState.frozenStartValue() ?? null,
			props.radarProps.baseLinePoints,
			props.radarProps.animationMatchBy,
		),
	)

	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks(
		() => props.radarProps.onAnimationStart,
		() => props.radarProps.onAnimationEnd,
	)
	const layout = createMemo(() => usePolarChartLayout())

	return (
		<Show when={layout()}>
			{(polarLayout) => (
				<RadarLabelListProvider showLabels={!isAnimating()} points={props.radarProps.points}>
					<AnimatedItems
						animationInput={props.radarProps.points}
						animationIdPrefix="recharts-radar-"
						items={props.radarProps.points}
						previousItemsRef={props.previousPointsRef}
						isAnimationActive={props.radarProps.isAnimationActive}
						animationBegin={props.radarProps.animationBegin}
						animationDuration={props.radarProps.animationDuration}
						animationEasing={props.radarProps.animationEasing}
						onAnimationStart={handleAnimationStart}
						onAnimationEnd={handleAnimationEnd}
						animationInterpolateFn={props.radarProps.animationInterpolateFn}
						animationMatchBy={props.radarProps.animationMatchBy}
						layout={polarLayout()}
					>
						{(stepData, animationElapsedTime) => {
							const stepBaseLinePoints = createMemo(() => {
								const t = animationElapsedTime()
								return t === 1
									? props.radarProps.baseLinePoints
									: props.radarProps.animationInterpolateFn(baseLineAnimationItems(), t, polarLayout())
							})
							createEffect(
								() => ({ step: stepBaseLinePoints(), t: animationElapsedTime() }),
								({ step, t }) => {
									baseLineAnimationState.syncStepValue(step, t)
								},
							)
							return (
								<StaticPolygon
									points={stepData()}
									baseLinePoints={stepBaseLinePoints()}
									radarProps={props.radarProps}
								/>
							)
						}}
					</AnimatedItems>
					<LabelListFromLabelProp label={props.radarProps.label} />
					{props.radarProps.children}
				</RadarLabelListProvider>
			)}
		</Show>
	)
}

function RenderPolygon(props: InternalRadarProps): JSX.Element {
	const previousPointsRef: { current: ReadonlyArray<RadarPoint> | undefined } = { current: undefined }
	const previousBaseLinePointsRef: { current: ReadonlyArray<RadarPoint> | undefined } = {
		current: undefined,
	}
	return (
		<PolygonWithAnimation
			radarProps={props}
			previousPointsRef={previousPointsRef}
			previousBaseLinePointsRef={previousBaseLinePointsRef}
		/>
	)
}

export const defaultRadarProps = {
	activeDot: true,
	angleAxisId: 0,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	animationInterpolateFn: defaultRadarAnimateItems,
	animationMatchBy: matchByIndex,
	dot: false,
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "rect",
	radiusAxisId: 0,
	zIndex: DefaultZIndexes.area,
} as const satisfies Partial<Props>

type PropsWithDefaults = RequiresDefaultProps<Props, typeof defaultRadarProps>

export type InternalRadarProps = WithIdRequired<PropsWithDefaults> & RadarComposedData

function RadarWithState(props: InternalRadarProps): JSX.Element {
	const layerClass = () => clsx("recharts-radar", props.className)

	return (
		<Show when={!props.hide}>
			<ZIndexLayer zIndex={props.zIndex}>
				<Layer class={layerClass()}>
					<RenderPolygon {...props} />
				</Layer>
				<ActivePoints
					points={props.points}
					mainColor={getLegendItemColor(props.stroke, props.fill)}
					itemDataKey={props.dataKey}
					activeDot={props.activeDot}
				/>
			</ZIndexLayer>
		</Show>
	)
}

function RadarImpl(props: WithIdRequired<PropsWithDefaults>): JSX.Element {
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const stateCtx = useContext(RechartsStateContext)

	const radarPoints = createMemo(() => {
		/* Read angle/radius/item settings from new chartState so mutations invalidate
		   this memo. When present, pass as overrides so selector chain recomputes
		   scale from override domain/type rather than legacy store values. */
		const angleId = String(props.angleAxisId ?? 0)
		const radiusId = String(props.radiusAxisId ?? 0)
		const solidState = stateCtx?.state
		const angleEntry = solidState?.polarAxes.angleAxis[angleId]
		/* Spread to enumerate all fields — Solid only tracks accessed properties,
		   so spread forces subscriptions to every setting key on mutation. */
		const solidAngle = angleEntry?.settings != null
			? ({ ...angleEntry.settings } as AngleAxisSettings)
			: undefined
		const radiusEntry = solidState?.polarAxes.radiusAxis[radiusId]
		const solidRadius = radiusEntry?.settings != null
			? ({ ...radiusEntry.settings } as RadiusAxisSettings)
			: undefined
		void solidRadius
		void solidState?.graphicalItems[props.id]

		if (!ctx) {
			return undefined
		}
		return selectRadarPoints(
			ctx.store,
			props.radiusAxisId,
			props.angleAxisId,
			isPanorama,
			props.id,
			solidAngle,
		)
	})

	return (
		<Show when={radarPoints()?.points != null && radarPoints()}>
			{(rp) => (
				<RadarWithState
					{...props}
					points={rp().points}
					baseLinePoints={rp().baseLinePoints}
					isRange={rp().isRange}
				/>
			)}
		</Show>
	)
}

/**
 * @consumes PolarChartContext
 * @provides LabelListContext
 */
function RadarFn(outsideProps: Props): JSX.Element {
	/* GOTCHA-013: split children before mergeProps so RegisterGraphicalItemId scope
	   captures children. mergeProps over resolveDefaultProps (GOTCHA-005-C / 008-D):
	   resolveDefaultProps `{ ...realProps }` spread snapshots the props proxy, freezing
	   reactive props at first render — dataKey/data/etc never update on signal change.
	   mergeProps preserves the lazy proxy through the defaults layer. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props = mergeProps(defaultRadarProps, restProps) as PropsWithDefaults
	return (
		<RegisterGraphicalItemId id={props.id} type="radar">
			{(id: string) => (
				<LabelListContextBridge>
					{(() => {
						/* Memoize children inside Provider scope (GOTCHA-013). */
						const memoizedChildren = createMemo(() => childrenProps.children)
						return (
							<>
								<SetPolarGraphicalItem
									type="radar"
									id={id}
									data={undefined}
									dataKey={props.dataKey}
									hide={props.hide}
									angleAxisId={props.angleAxisId}
									radiusAxisId={props.radiusAxisId}
								/>
								<SetPolarLegendPayload legendPayload={computeLegendPayloadFromRadarSectors(props)} />
								<SetRadarTooltipEntrySettings
									dataKey={props.dataKey}
									stroke={props.stroke}
									strokeWidth={props.strokeWidth}
									fill={props.fill}
									name={props.name}
									hide={props.hide}
									tooltipType={props.tooltipType}
									id={id}
								/>
								<RadarImpl {...props} id={id}>
									{memoizedChildren()}
								</RadarImpl>
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
export const Radar = RadarFn as (<DataPointType = any, DataValueType = any>(
	props: Props<DataPointType, DataValueType>,
) => JSX.Element) & { displayName?: string }
