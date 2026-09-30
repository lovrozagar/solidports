/* eslint-disable import/no-cycle, sort-keys */
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Index,
	mergeProps,
	Show,
	splitProps,
	untrack,
	type JSX,
} from "solid-js"
import { clsx } from "clsx"
import type { StackSeries } from "../util/stacks/stackTypes"
import type { Props as RectangleProps, RectRadius } from "../shape/Rectangle"
import { Layer } from "../container/Layer"
import type { ErrorBarDataItem, ErrorBarDataPointFormatter } from "./ErrorBar"
import {
	CartesianLabelListContextProvider,
	type CartesianLabelListEntry,
	type ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import { interpolate, isNan, mathSign, noop } from "../util/DataUtils"
import {
	type BarPositionPosition,
	getBaseValueOfBar,
	getCateCoordinateOfBar,
	getTooltipNameProp,
	getValueByDataKey,
	type StackId,
	truncateByDomain,
} from "../util/ChartUtils"
import { adaptEventsOfChild } from "../util/types"
import type {
	ActiveShape,
	AnimationDuration,
	CartesianViewBoxRequired,
	ChartOffsetInternal,
	Coordinate,
	DataConsumer,
	DataKey,
	LegendType,
	PresentationAttributesAdaptChildEvent,
	TickItem,
	TooltipType,
	TrapezoidViewBox,
} from "../util/types"
import { BarRectangle, type MinPointSize, minPointSizeCallback } from "../util/BarUtils"
import { getRectanglePath } from "../shape/Rectangle"
import { round } from "../util/round"
import type { LegendPayload } from "../component/DefaultLegendContent"
import {
	useMouseClickItemDispatch,
	useMouseEnterItemDispatch,
	useMouseLeaveItemDispatch,
} from "../context/tooltipContext"
import type { TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { SetErrorBarContext } from "../context/ErrorBarContext"
import { GraphicalItemClipPath, useNeedsClip } from "./GraphicalItemClipPath"
import { useChartLayout } from "../context/chartLayoutContext"
import { selectBarRectangles } from "../state/selectors/barSelectors"
import type { BaseAxisWithScale } from "../state/selectors/axisSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/_solid/useChartState"
import { useIsPanorama } from "../context/PanoramaContext"
import { selectActiveTooltipIndex } from "../state/selectors/tooltipSelectors"
import { SetLegendPayload } from "../state/SetLegendPayload"
import { useAnimationId } from "../util/useAnimationId"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { BarSettings } from "../state/types/BarSettings"
import { SetCartesianGraphicalItem } from "../state/SetGraphicalItem"
import { svgPropertiesNoEvents, svgPropertiesNoEventsFromUnknown } from "../util/svgPropertiesNoEvents"
import { isEventKey } from "../util/excludeEventProps"
import { createCellsRegistry, useCellsRegistry } from "../context/CellsContext"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import type { EasingInput } from "../animation/easing"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { getZIndexFromUnknown } from "../zIndex/getZIndexFromUnknown"
import type { AxisId } from "../state/cartesianAxisSlice"
import { BarStackClipLayer, useBarStackClipPathUrl, useStackId } from "./BarStack"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import type { ChartData } from "../state/chartDataSlice"

type BarRectangleType = {
	x: number | null
	y: number | null
	width: number
	height: number
}

export interface BarRectangleItem extends RectangleProps {
	value: number | [number, number]
	/** the coordinate of background rectangle */
	background?: BarRectangleType
	tooltipPosition: Coordinate
	readonly payload?: unknown
	parentViewBox: CartesianViewBoxRequired
	x: number
	y: number
	width: number
	height: number
	/**
	 * Chart range coordinate of the baseValue of the first bar in a stack.
	 */
	stackedBarStart: number
}

export type BarShapeProps = BarRectangleItem & {
	isActive: boolean
	index: number
	option?: ActiveShape<BarShapeProps, SVGPathElement> | undefined
}

export interface BarProps<DataPointType = unknown, DataValueType = unknown>
	extends DataConsumer<DataPointType, DataValueType>, ZIndexable {
	className?: string
	index?: string | number
	xAxisId?: AxisId
	yAxisId?: AxisId
	stackId?: StackId
	barSize?: string | number
	unit?: string | number
	name?: string | number
	tooltipType?: TooltipType
	legendType?: LegendType
	minPointSize?: MinPointSize
	maxBarSize?: number
	hide?: boolean
	shape?: ActiveShape<BarShapeProps, SVGPathElement>
	activeBar?: ActiveShape<BarShapeProps, SVGPathElement>
	background?: ActiveShape<BarShapeProps, SVGPathElement> & ZIndexable
	radius?: RectRadius
	onAnimationStart?: () => void
	onAnimationEnd?: () => void
	isAnimationActive?: boolean | "auto"
	animationBegin?: number
	animationDuration?: AnimationDuration
	animationEasing?: EasingInput
	id?: string
	label?: ImplicitLabelListType
	zIndex?: number
	children?: JSX.Element
}

type InternalBarProps = {
	layout: "horizontal" | "vertical"
	data: ReadonlyArray<BarRectangleItem> | undefined
	xAxisId: string | number
	yAxisId: string | number
	hide: boolean
	legendType: LegendType
	minPointSize: MinPointSize
	activeBar: ActiveShape<BarShapeProps, SVGPathElement>
	isAnimationActive: boolean | "auto"
	animationBegin: number
	animationDuration: AnimationDuration
	animationEasing: EasingInput
	needClip?: boolean
	className?: string
	index?: string | number
	stackId?: string | number
	barSize?: string | number
	unit?: string | number
	name?: string | number
	dataKey?: DataKey<unknown>
	tooltipType?: TooltipType
	maxBarSize?: number
	shape?: ActiveShape<BarShapeProps, SVGPathElement>
	background?: ActiveShape<BarShapeProps, SVGPathElement>
	radius?: number | [number, number, number, number]
	onAnimationStart?: () => void
	onAnimationEnd?: () => void
	id: GraphicalItemId
	label?: ImplicitLabelListType
	children?: JSX.Element
}

type BarSvgProps = Omit<
	PresentationAttributesAdaptChildEvent<BarRectangleItem, SVGPathElement>,
	"radius" | "name" | "ref"
>

export type Props = BarSvgProps & BarProps

type InternalProps = BarSvgProps & InternalBarProps

/* eslint-disable solid/reactivity -- plain utility fn; Props parameter is not a Solid reactive proxy at this call site */
const computeLegendPayloadFromBarData = (barProps: Props): ReadonlyArray<LegendPayload> => {
	return [
		{
			color: typeof barProps.fill === "string" ? barProps.fill : undefined,
			dataKey: barProps.dataKey,
			inactive: barProps.hide,
			payload: barProps,
			type: barProps.legendType,
			value: getTooltipNameProp(barProps.name, barProps.dataKey),
		},
	]
}
/* eslint-enable solid/reactivity */

function SetBarTooltipEntrySettings(
	props: Pick<
		InternalProps,
		"dataKey" | "stroke" | "strokeWidth" | "fill" | "name" | "hide" | "unit" | "tooltipType" | "id"
	>,
) {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: undefined,
		getPosition: noop,
		settings: {
			color: props.fill,
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

function BarBackground(props: {
	background?: ActiveShape<BarShapeProps, SVGPathElement>
	data: ReadonlyArray<BarRectangleItem> | undefined
	dataKey: DataKey<unknown> | undefined
	allOtherBarProps: InternalProps
}) {
	const ctx = useChartStore()
	/* perf: cache selector result; without memo every consumer read triggers full chain. */
	const activeIndex = createMemo(() => (ctx ? selectActiveTooltipIndex(ctx.store) : undefined))
	/* eslint-disable solid/reactivity -- dataKey/id are stable identifiers captured once at setup; dispatch hooks take static config */
	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() =>
			props.allOtherBarProps.onMouseEnter as
				| ((d: BarRectangleItem, i: number, e: MouseEvent) => void)
				| undefined,
		props.dataKey,
		props.allOtherBarProps.id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() =>
			props.allOtherBarProps.onMouseLeave as
				| ((d: BarRectangleItem, i: number, e: MouseEvent) => void)
				| undefined,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() =>
			props.allOtherBarProps.onClick as
				| ((d: BarRectangleItem, i: number, e: MouseEvent) => void)
				| undefined,
		props.dataKey,
		props.allOtherBarProps.id,
	)
	/* eslint-enable solid/reactivity */

	return (
		<Show when={props.background && props.data != null}>
			<ZIndexLayer zIndex={getZIndexFromUnknown(props.background, DefaultZIndexes.barBackground)}>
				<For each={props.data}>
					{(entry: BarRectangleItem, i) => {
						return (
							<Show when={entry.background}>
								{(() => {
									/* match upstream: keep parentViewBox/payload/stackedBarStart on rest;
									   strip only value/background/tooltipPosition. */
									const bgSvgProps = svgPropertiesNoEventsFromUnknown(props.background)
									const bgFill = typeof bgSvgProps?.fill === "string" ? bgSvgProps.fill : "#eee"
									const {
										value: _v,
										background: _bg,
										tooltipPosition: _tp,
										...rectProps
									} = entry
									const bg = entry.background
									const adapted = (adaptEventsOfChild(
										props.allOtherBarProps as unknown as Record<string, unknown>,
										entry,
										i(),
									) ?? {}) as Record<string, ((e: Event) => void) | undefined>
									/* GOTCHA-016-C: bind both pairs, dedupe per-instance. Compose adapted user handlers ahead of context dispatch. */
									const enter = onMouseEnterFromContext(entry, i()) as unknown as (
										e: MouseEvent,
									) => void
									const leave = onMouseLeaveFromContext(entry, i()) as unknown as (
										e: MouseEvent,
									) => void
									const click = onClickFromContext(entry, i()) as unknown as (e: MouseEvent) => void
									const userOver = adapted.onMouseOver
									const userOut = adapted.onMouseOut
									let entered = false
									const fireEnter = (e: MouseEvent) => {
										if (entered) return
										entered = true
										userOver?.(e)
										enter(e)
									}
									const fireLeave = (e: MouseEvent) => {
										if (!entered) return
										entered = false
										userOut?.(e)
										leave(e)
									}
									return (
										<BarRectangle
											option={props.background}
											isActive={String(i()) === activeIndex()}
											{...rectProps}
											fill={bgFill}
											x={bg?.x ?? rectProps.x}
											y={bg?.y ?? rectProps.y}
											width={bg?.width ?? rectProps.width}
											height={bg?.height ?? rectProps.height}
											dataKey={props.dataKey}
											index={i()}
											className="recharts-bar-background-rectangle"
											{...adapted}
											onMouseEnter={fireEnter}
											onMouseOver={fireEnter}
											onMouseLeave={fireLeave}
											onMouseOut={fireLeave}
											onClick={click}
										/>
									)
								})()}
							</Show>
						)
					}}
				</For>
			</ZIndexLayer>
		</Show>
	)
}

function BarLabelListProvider(props: {
	showLabels: boolean
	children: JSX.Element
	rects: ReadonlyArray<BarRectangleItem> | undefined
}) {
	const labelListEntries = () =>
		props.rects?.map((entry: BarRectangleItem): CartesianLabelListEntry => {
			const viewBox: TrapezoidViewBox = {
				height: entry.height,
				lowerWidth: entry.width,
				upperWidth: entry.width,
				width: entry.width,
				x: entry.x,
				y: entry.y,
			}
			return {
				...viewBox,
				fill: entry.fill,
				parentViewBox: entry.parentViewBox,
				payload: entry.payload,
				value: entry.value,
				viewBox,
			}
		})

	/* eslint-disable solid/reactivity -- Provider value reads labelListEntries() and props.showLabels inside JSX attribute; both are reactive */
	return (
		<CartesianLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</CartesianLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

/* perf: fast-path renderer for the common case (no custom shape, plain
   Rectangle, no per-bar update animation). Bypasses the
   BarStackClipLayer -> BarRectangle -> Shape -> ShapeSelector -> Dynamic ->
   Rectangle -> RectanglePath chain — 7 components per bar -> 0. Renders the
   exact 2-`<g>` + 1-`<path>` DOM structure required by Bar tests
   (recharts-bar-rectangle / recharts-inactive-bar / recharts-rectangle).

   28 bars: 196 createComponent calls + 196 owner-tree nodes + ~5 reactive
   effects per bar saved. Reactive geometry (x/y/width/height/d) bound
   directly via JSX so Solid's compiler emits setAttribute ops with one
   render-effect per attribute slot (no scheduler dispatch through
   intermediate component scopes). */
function FastBarPath(props: {
	entry: () => BarRectangleItem
	index: number
	staticAttrs: Record<string, unknown>
	entryStaticAttrs: Record<string, unknown>
	stackEvents: Record<string, (e: Event) => void>
	pathClass: () => string
	radius: RectRadius | undefined
}) {
	/* eslint-disable solid/reactivity -- props.index and props.radius are stable numeric props captured once at setup */
	const clipPathUrl = useBarStackClipPathUrl(props.index)
	const radius = props.radius ?? 0
	/* eslint-enable solid/reactivity */
	const isValid = () => {
		const e = props.entry()
		return (
			e.x === +e.x &&
			e.y === +e.y &&
			e.width === +e.width &&
			e.height === +e.height &&
			e.width !== 0 &&
			e.height !== 0
		)
	}
	const [pathEl, setPathEl] = createSignal<SVGPathElement | null>(null)
	/* perf: imperative per-frame setAttribute via ref. Prev-value cache skips
	   redundant DOM writes — Solid effects re-run on any dep change, but most
	   per-frame ticks only change one or two attrs, not all of them. */
	let prevX = NaN, prevY = NaN, prevW = NaN, prevH = NaN, prevD = "", prevFill = ""
	createEffect(() => {
		const el = pathEl()
		if (!el) return
		const e = props.entry()
		const x = round(e.x)
		const y = round(e.y)
		const w = round(e.width)
		const h = round(e.height)
		if (x !== prevX) { el.setAttribute("x", String(x)); prevX = x }
		if (y !== prevY) { el.setAttribute("y", String(y)); prevY = y }
		if (w !== prevW) { el.setAttribute("width", String(w)); prevW = w }
		if (h !== prevH) { el.setAttribute("height", String(h)); prevH = h }
		const d = getRectanglePath(e.x, e.y, e.width, e.height, radius)
		if (d !== prevD) { el.setAttribute("d", d); prevD = d }
		const f = e.fill
		if (f != null && f !== prevFill) { el.setAttribute("fill", f); prevFill = f }
	})
	const setPathRef = (el: SVGPathElement) => {
		el.setAttribute("radius", String(radius))
		setPathEl(el)
	}
	return (
		<g
			class="recharts-layer recharts-bar-stack-layer recharts-bar-rectangle"
			clip-path={clipPathUrl}
			{...props.stackEvents}
		>
			<g class="recharts-layer recharts-inactive-bar">
				<Show when={isValid()}>
					<path
						ref={setPathRef}
						{...props.staticAttrs}
						{...props.entryStaticAttrs}
						class={props.pathClass()}
					/>
				</Show>
			</g>
		</g>
	)
}

function BarRectangles(props: {
	data: ReadonlyArray<BarRectangleItem> | undefined
	allProps: InternalProps
}) {
	/* eslint-disable solid/reactivity -- dataKey/id destructure and dispatch hook reads are stable identifiers captured once at setup */
	const { id: _id, name: _name, ...baseProps } = svgPropertiesNoEvents(props.allProps) ?? {}
	/* mirror upstream `<BarStackClipLayer ... onMouseEnter onMouseLeave onClick>`:
	   wire context dispatchers + per-entry adaptEventsOfChild forwards */
	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() =>
			props.allProps.onMouseEnter as
				| ((d: BarRectangleItem, i: number, e: MouseEvent) => void)
				| undefined,
		props.allProps.dataKey,
		props.allProps.id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() =>
			props.allProps.onMouseLeave as
				| ((d: BarRectangleItem, i: number, e: MouseEvent) => void)
				| undefined,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() =>
			props.allProps.onClick as
				| ((d: BarRectangleItem, i: number, e: MouseEvent) => void)
				| undefined,
		props.allProps.dataKey,
		props.allProps.id,
	)
	/* eslint-enable solid/reactivity */

	/* perf: pre-extract event handlers once. `adaptEventsOfChild(props.allProps, …)`
	   does `Object.keys` + `proxy[key]` per entry — that read iterates the BarImpl
	   mergeProps proxy and triggers the `data` getter which calls
	   `selectBarRectangles`. Inside the per-entry `adapted` createMemo this turns
	   into a per-frame selector chain (343ms total in the profile). Snapshotting
	   to a plain object decouples the per-entry binding from the proxy. */
	type ChildHandler = (data: BarRectangleItem, index: number, e: Event) => void
	const eventHandlers: Record<string, ChildHandler> = {}
	{
		/* eslint-disable-next-line solid/reactivity -- props.allProps proxy snapshot at setup; event handlers don't change after mount */
		const proxy = props.allProps as unknown as Record<string, unknown>
		for (const key of Object.keys(proxy)) {
			if (isEventKey(key)) {
				const v = proxy[key]
				if (typeof v === "function") {
					eventHandlers[key] = v as ChildHandler
				}
			}
		}
	}

	/* eslint-disable solid/reactivity -- shape/radius/className reads are intentional one-time setup captures; fast-path eligibility is determined once at mount */
	/* perf: detect fast-path eligibility ONCE at setup. Default Bar (no custom
	   shape) hits FastBarPath which renders <g><g><path/></g></g> directly with
	   reactive d-binding — bypasses 7-component-deep chain. Custom shape /
	   activeBar / function-option falls through to BarStackClipLayer + Shape
	   chain for parity with React's clone-and-extend semantics. */
	const useFastPath = props.allProps.shape == null
	const radius = props.allProps.radius
	/* split static path attrs once: spread on every <path/> covers fill/stroke/
	   strokeWidth/className/data-* etc. without re-walking the proxy per bar. */
	const staticPathAttrs = (() => {
		if (!useFastPath) return {} as Record<string, unknown>
		const out: Record<string, unknown> = { ...(baseProps as Record<string, unknown>) }
		/* geometry handled by reactive d-binding; drop to avoid Solid emitting
		   x/y/width/height attrs on the path element (path doesn't support them).
		   keep fill — Bar's `fill="#8884d8"` prop is the default; entry.fill (Cell
		   override) wins via reactive setAttribute in FastBarPath createEffect. */
		delete out.x
		delete out.y
		delete out.width
		delete out.height
		delete out.radius
		delete out.class
		delete out.className
		return out
	})()
	const baseClassName = (props.allProps as { className?: string }).className
	const pathClass = () => clsx("recharts-rectangle", baseClassName)
	/* eslint-enable solid/reactivity */

	/* perf: <Index> over <For> — entries are NEW objects every animation frame
	   (stepData spreads `{...entry, height: …}`) so referential `<For>` would
	   tear down + remount the entire BarStackClipLayer/BarRectangle subtree per
	   tick. <Index> keeps slots stable and lets attribute bindings update in
	   place; ~10x cheaper per frame on 50-bar charts.

	   perf: don't spread the whole entry — only x/y/width/height/fill change
	   per frame. Spreading the full object retriggers Solid's `assign` for
	   every attribute (~30 svg keys each) every tick. Pass field-level
	   accessors via mergeProps so the component sees individual reactive
	   getters and only the live attrs touch the DOM. */
	/* eslint-disable solid/reactivity -- index is a plain number from <Index> (not a signal accessor); reads inside the Index callback ARE tracked */
	return (
		<Show when={props.data}>
			<Index each={props.data}>
				{(entry, index) => {
					const userOver = eventHandlers.onMouseOver
					const userOut = eventHandlers.onMouseOut
					const adapted: Record<string, (e: Event) => void> = {}
					for (const key in eventHandlers) {
						const handler = eventHandlers[key]
						if (handler) adapted[key] = (e: Event) => handler(entry(), index, e)
					}
					/* GOTCHA-016-C: dedupe user.hover paths so MouseEnter+MouseOver fires once. */
					let entered = false
					const fireEnter = (e: MouseEvent & { currentTarget: SVGElement }) => {
						if (entered) return
						entered = true
						userOver?.(entry(), index, e)
						onMouseEnterFromContext(entry(), index)(e)
					}
					const fireLeave = (e: MouseEvent & { currentTarget: SVGElement }) => {
						if (!entered) return
						entered = false
						userOut?.(entry(), index, e)
						onMouseLeaveFromContext(entry(), index)(e)
					}
					const handleClick = (e: MouseEvent & { currentTarget: SVGElement }) => {
						onClickFromContext(entry(), index)(e)
					}
					const stackEvents: Record<string, (e: Event) => void> = {
						...adapted,
						onMouseEnter: fireEnter as unknown as (e: Event) => void,
						onMouseOver: fireEnter as unknown as (e: Event) => void,
						onMouseLeave: fireLeave as unknown as (e: Event) => void,
						onMouseOut: fireLeave as unknown as (e: Event) => void,
						onClick: handleClick as unknown as (e: Event) => void,
					}
					if (useFastPath) {
						/* perf: snapshot entry-derived static svg attrs ONCE at mount.
						   `<path>` should carry `name`, `payload`, etc. from data row for
						   parity with React's spread of {...entry} to Rectangle. Geometry
						   attrs (x/y/width/height) overridden by reactive geomAttrs(). */
						const initialEntry = untrack(() => entry())
						const entryStatic: Record<string, unknown> = {
							...(initialEntry as unknown as Record<string, unknown>),
						}
						delete entryStatic.x
						delete entryStatic.y
						delete entryStatic.width
						delete entryStatic.height
						delete entryStatic.fill
						delete entryStatic.radius
						delete entryStatic.value
						delete entryStatic.background
						delete entryStatic.tooltipPosition
						delete entryStatic.parentViewBox
						delete entryStatic.payload
						delete entryStatic.stackedBarStart
						return (
							<FastBarPath
								entry={entry}
								index={index}
								staticAttrs={staticPathAttrs}
								entryStaticAttrs={entryStatic}
								stackEvents={stackEvents}
								pathClass={pathClass}
								radius={radius as RectRadius | undefined}
							/>
						)
					}
					/* perf: snapshot static fields once. fill/stroke etc. don't change
					   per animation frame, so reading them via reactive getters made the
					   downstream spread render effect re-tick uselessly. Only x/y/width/
					   height stay reactive via override getters. */
					const initialEntry = untrack(() => entry())
					const rectProps = mergeProps(baseProps, initialEntry, {
						get x() {
							return entry().x
						},
						get y() {
							return entry().y
						},
						get width() {
							return entry().width
						},
						get height() {
							return entry().height
						},
						isActive: false,
						option: props.allProps.shape,
						index,
						dataKey: props.allProps.dataKey,
					})
					return (
						<BarStackClipLayer
							index={index}
							class="recharts-bar-rectangle"
							{...adapted}
							onMouseEnter={fireEnter}
							onMouseOver={fireEnter}
							onMouseLeave={fireLeave}
							onMouseOut={fireLeave}
							onClick={handleClick}
						>
							<BarRectangle {...rectProps} />
						</BarStackClipLayer>
					)
				}}
			</Index>
		</Show>
	)
	/* eslint-enable solid/reactivity */
}

function RectanglesWithAnimation(props: {
	allProps: InternalProps
	previousRectanglesRef: { current: ReadonlyArray<BarRectangleItem> | null }
}) {
	const animationId = useAnimationId(() => props.allProps, "recharts-bar-")

	/* perf: snapshot rectangles at animationId flip — without this, every
	   per-frame `t()` tick reads `props.allProps.data` through the BarImpl
	   `mergeProps` getter, which calls `selectBarRectangles` again, rebuilding
	   axis scales + decimal math + a fresh array of rects. Selectors aren't
	   memoized; cost compounds across frames. Cache once per animation. */
	const dataSnapshot = createMemo(() => {
		animationId()
		return untrack(() => props.allProps.data)
	})
	const layoutSnapshot = createMemo(() => {
		animationId()
		return untrack(() => props.allProps.layout)
	})

	/* GOTCHA-014-G: snapshot prev rectangles at animationId flip; mirrors Radar. */
	const animationContext = createMemo(() => {
		animationId()
		return { prevRectangles: props.previousRectanglesRef.current }
	})

	/* default true — Solid's manager.start fires onAnimationStart on next frame
	   so initial render would paint labels before isAnimating flips. React batches
	   start+commit such that labels render with isAnimating already true. */
	/* eslint-disable-next-line solid/reactivity -- isAnimationActive seeds the signal once at setup; intentional snapshot */
	const [isAnimating, setIsAnimating] = createSignal(props.allProps.isAnimationActive !== false)
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
		<BarLabelListProvider showLabels={showLabels()} rects={props.allProps.data}>
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
					/* GOTCHA-014: thunk children — write prev via effect to avoid stale-memo drift.
					   When t=1 (animation off or complete), read props.allProps.data directly
					   so state mutations (domain change, maxBarSize) flow through reactively.
					   During animation (t<1), use the snapshot to avoid re-running the selector
					   chain per frame. */
					const stepData = createMemo(() => {
						const tValue = t()
						if (tValue === 1) return props.allProps.data
						const ctx = animationContext()
						const prevData = ctx.prevRectangles
						const data = dataSnapshot()
						const layout = layoutSnapshot()
						return data?.map(
									(entry: BarRectangleItem, index: number): BarRectangleItem => {
										const prev = prevData && prevData[index]
										if (prev) {
											return Object.assign({}, entry, {
												height: interpolate(prev.height, entry.height, tValue),
												width: interpolate(prev.width, entry.width, tValue),
												x: interpolate(prev.x, entry.x, tValue),
												y: interpolate(prev.y, entry.y, tValue),
											})
										}
										if (layout === "horizontal") {
											const height = interpolate(0, entry.height, tValue)
											const y = interpolate(entry.stackedBarStart, entry.y, tValue)
											return Object.assign({}, entry, { height, y })
										}
										const w = interpolate(0, entry.width, tValue)
										const x = interpolate(entry.stackedBarStart, entry.x, tValue)
										return Object.assign({}, entry, { width: w, x })
									},
								)
					})
					createEffect(() => {
						if (t() > 0) {
							props.previousRectanglesRef.current = stepData() ?? null
						}
					})
					return (
						<Show when={stepData() != null}>
							<Layer>
								<BarRectangles
									allProps={props.allProps}
									data={stepData() as ReadonlyArray<BarRectangleItem>}
								/>
							</Layer>
						</Show>
					)
				}}
			</JavascriptAnimate>
			<LabelListFromLabelProp label={props.allProps.label} />
			{props.allProps.children}
		</BarLabelListProvider>
	)
}

function RenderRectangles(props: { allProps: InternalProps }) {
	const previousRectanglesRef: { current: ReadonlyArray<BarRectangleItem> | null } = {
		current: null,
	}
	return (
		<RectanglesWithAnimation
			allProps={props.allProps}
			previousRectanglesRef={previousRectanglesRef}
		/>
	)
}

const defaultMinPointSize: number = 0

const errorBarDataPointFormatter: ErrorBarDataPointFormatter<BarRectangleItem> = (
	dataPoint: BarRectangleItem,
	dataKey,
): ErrorBarDataItem => {
	const value = Array.isArray(dataPoint.value) ? dataPoint.value[1] : dataPoint.value
	return {
		errorVal: getValueByDataKey(dataPoint, dataKey),
		value,
		x: dataPoint.x,
		y: dataPoint.y,
	}
}

function BarWithState(props: InternalProps) {
	return (
		<Show when={!props.hide && props.data != null}>
			{(() => {
				const layerClass = () => clsx("recharts-bar", props.className)
				const clipPathId = () => props.id

				return (
					<Layer class={layerClass()} id={props.id}>
						<Show when={props.needClip}>
							<defs>
								<GraphicalItemClipPath
									clipPathId={clipPathId()}
									xAxisId={props.xAxisId}
									yAxisId={props.yAxisId}
								/>
							</defs>
						</Show>
						<Layer
							class="recharts-bar-rectangles"
							clip-path={props.needClip ? `url(#clipPath-${clipPathId()})` : undefined}
						>
							<BarBackground
								data={props.data}
								dataKey={props.dataKey}
								background={props.background}
								allOtherBarProps={props}
							/>
							<RenderRectangles allProps={props} />
						</Layer>
					</Layer>
				)
			})()}
		</Show>
	)
}

export const defaultBarProps = {
	activeBar: false,
	animationBegin: 0,
	animationDuration: 400,
	animationEasing: "ease",
	background: false,
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "rect",
	minPointSize: defaultMinPointSize,
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.bar,
} as const satisfies Partial<Props>

function BarImpl(props: InternalBarProps & { children?: JSX.Element }) {
	const needClipResult = () => useNeedsClip(props.xAxisId, props.yAxisId)
	const layout = () => useChartLayout()

	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const stateCtx = useOptionalChartState()
	/* React parity for `<Cell/>` overrides: upstream walks props.children with
	   findAllByType(Cell) — impossible on Solid (opaque JSX). The registry is
	   provided ABOVE this scope (in Bar() before memoizedChildren) so the
	   memo's createComponent calls capture an owner that sees the Provider.
	   Reading `useCellsRegistry()` here returns that same registry. */
	const registry = useCellsRegistry()
	const cells = (): ReadonlyArray<JSX.Element> | undefined => {
		if (registry == null) return undefined
		const list = registry.cells()
		return list.length === 0 ? undefined : (list as unknown as ReadonlyArray<JSX.Element>)
	}

	/* perf: cache selector result; without memo every consumer read during animation
	   triggers a fresh selector chain (selectBarRectangles → axis recompute per frame).
	   Solid fires signals at the DEEPEST written key — reading only the container object
	   or .settings doesn't subscribe to nested writes like domain or maxBarSize.
	   Use void-reads to subscribe to each mutable field without branching the selector call. */
	const rects = createMemo(() => {
		const xAxisEntry = stateCtx?.state.cartesianAxes.xAxis[String(props.xAxisId)]
		const yAxisEntry = stateCtx?.state.cartesianAxes.yAxis[String(props.yAxisId)]
		/* Subscribe to domain changes — written as setState("cartesianAxes","yAxis","0","settings","domain",...) */
		void xAxisEntry?.settings?.domain
		void yAxisEntry?.settings?.domain
		const rawItem = stateCtx?.state.graphicalItems[props.id]
		/* Subscribe to maxBarSize — written as setState("graphicalItems",id,"settings","maxBarSize",...) */
		void (rawItem?.type === "bar" ? rawItem.settings?.maxBarSize : undefined)
		const itemSettings =
			rawItem != null && rawItem.type === "bar"
				? (rawItem as import("../state/_solid/chartState").BarState).settings
				: undefined
		return ctx
			? selectBarRectangles(
					ctx.store,
					props.id,
					isPanorama,
					cells(),
					xAxisEntry?.settings,
					yAxisEntry?.settings,
					itemSettings,
				)
			: undefined
	})

	return (
		<Show when={layout() === "vertical" || layout() === "horizontal"}>
			{(() => {
				const withState = mergeProps(props, {
					get layout() {
						return layout() as "horizontal" | "vertical"
					},
					get needClip() {
						return needClipResult()?.needClip()
					},
					get data() {
						return rects()
					},
				})
				/* GOTCHA-017 (session 34): SetErrorBarContext hoisted out of BarImpl
				   to Bar() outer scope (RegisterGraphicalItemId children-fn). Reason:
				   user JSX <ErrorBar/> evaluates eagerly when `children` getter is read
				   inside Bar's mergeProps literal — that scope is OUTSIDE BarImpl, so
				   ErrorBarImpl's useErrorBarContext returned the initial-default. With
				   the Provider hoisted, the children getter reads inside the Provider
				   owner. BarImpl now only computes/forwards rects; offset is computed
				   at the outer scope via the same store selector. */
				return <BarWithState {...(withState as unknown as InternalProps)} />
			})()}
		</Show>
	)
}

/* React parity for `<Cell/>` overrides: provide a CellsRegistry so that user
   `<For>{(row) => <Cell .../>}</For>` JSX evaluating inside `memoizedChildren`
   sees the Provider in its owner chain. The Provider wraps the inner JSX so
   the memoizedChildren memo created here has Provider as its enclosing owner,
   which means the For + Cell createComponent calls fire under the Provider. */
function BarChildrenScope(props: {
	childrenProps: { children?: JSX.Element }
	id: GraphicalItemId
	mergedBarProps: BarPropsWithDefaults
}) {
	const cellsRegistry = createCellsRegistry()
	return (
		<cellsRegistry.Provider value={cellsRegistry}>
			{(() => {
				/* GOTCHA-017: memoize children INSIDE Provider so that the For/Cell
				   createComponent calls fired by `childrenProps.children` access run
				   with Provider as a parent owner. Memo capture happens at memo-create
				   time — moving creation here is what makes context lookup find the
				   registry. Repeated reads return the same Node (no re-mint loop). */
				/* eslint-disable-next-line solid/reactivity -- props.childrenProps.children is read inside createMemo; this IS a tracked scope */
				const memoizedChildren = createMemo(() => props.childrenProps.children)
				/* eslint-disable-next-line solid/reactivity -- mergeProps result captured in variable per linter requirement; props.mergedBarProps is already a reactive proxy */
				const barImplProps = mergeProps(props.mergedBarProps, {
					id: props.id,
					get children() {
						return memoizedChildren()
					},
				}) as unknown as InternalBarProps
				return (
					<ZIndexLayer zIndex={props.mergedBarProps.zIndex}>
						<BarImpl {...barImplProps} />
					</ZIndexLayer>
				)
			})()}
		</cellsRegistry.Provider>
	)
}

export function computeBarRectangles({
	layout,
	barSettings: { dataKey, minPointSize: minPointSizeProp },
	pos,
	bandSize,
	xAxis,
	yAxis,
	xAxisTicks,
	yAxisTicks,
	stackedData,
	displayedData,
	offset,
	cells,
	parentViewBox,
	dataStartIndex,
}: {
	layout: "horizontal" | "vertical"
	barSettings: BarSettings
	pos: BarPositionPosition
	bandSize: number
	xAxis: BaseAxisWithScale
	yAxis: BaseAxisWithScale
	xAxisTicks: TickItem[]
	yAxisTicks: TickItem[]
	stackedData: StackSeries | undefined
	offset: ChartOffsetInternal
	displayedData: ChartData
	cells: ReadonlyArray<JSX.Element> | undefined
	parentViewBox: CartesianViewBoxRequired
	dataStartIndex: number
}): ReadonlyArray<BarRectangleItem> | undefined {
	const numericAxis = layout === "horizontal" ? yAxis : xAxis
	const rawDomain = stackedData ? numericAxis.scale.domain() : null
	const stackedDomain: ReadonlyArray<number> = rawDomain
		? rawDomain.map((d) => (typeof d === "number" ? d : Number(d)))
		: (null as unknown as ReadonlyArray<number>)
	const baseValue = getBaseValueOfBar({ numericAxis })
	const stackedBarStart: number | undefined = numericAxis.scale.map(baseValue)

	return displayedData
		.map((entry: unknown, index): BarRectangleItem | null => {
			let value: unknown
			let x: number | null
			let y: unknown
			let width: unknown
			let height: unknown
			let background: BarRectangleType

			if (stackedData) {
				const untruncatedValue = stackedData[index + dataStartIndex]
				if (untruncatedValue == null) {
					return null
				}
				value = truncateByDomain(untruncatedValue, stackedDomain)
			} else {
				value = getValueByDataKey(entry, dataKey)
				if (!Array.isArray(value)) {
					value = [baseValue, value]
				}
			}

			const minPointSize = minPointSizeCallback(minPointSizeProp, defaultMinPointSize)(
				(value as number[])[1],
				index,
			)

			if (layout === "horizontal") {
				const baseValueScale = yAxis.scale.map((value as number[])[0])
				const currentValueScale = yAxis.scale.map((value as number[])[1])
				if (baseValueScale == null || currentValueScale == null) {
					return null
				}
				x = getCateCoordinateOfBar({
					axis: xAxis,
					bandSize,
					entry,
					index,
					offset: pos.offset,
					ticks: xAxisTicks,
				})
				y = currentValueScale ?? baseValueScale ?? undefined
				width = pos.size
				const computedHeight = baseValueScale - currentValueScale
				height = isNan(computedHeight) ? 0 : computedHeight
				background = { height: offset.height, width: width as number, x, y: offset.top }

				if (Math.abs(minPointSize) > 0 && Math.abs(height as number) < Math.abs(minPointSize)) {
					const delta =
						mathSign((height as number) || minPointSize) *
						(Math.abs(minPointSize) - Math.abs(height as number))
					y = (y as number) - delta
					height = (height as number) + delta
				}
			} else {
				const baseValueScale = xAxis.scale.map((value as number[])[0])
				const currentValueScale = xAxis.scale.map((value as number[])[1])
				if (baseValueScale == null || currentValueScale == null) {
					return null
				}
				x = baseValueScale
				y = getCateCoordinateOfBar({
					axis: yAxis,
					bandSize,
					entry,
					index,
					offset: pos.offset,
					ticks: yAxisTicks,
				})
				width = currentValueScale - baseValueScale
				height = pos.size
				background = {
					height: height as number,
					width: offset.width,
					x: offset.left,
					y: y as number,
				}

				if (Math.abs(minPointSize) > 0 && Math.abs(width as number) < Math.abs(minPointSize)) {
					const delta =
						mathSign((width as number) || minPointSize) *
						(Math.abs(minPointSize) - Math.abs(width as number))
					width = (width as number) + delta
				}
			}

			if (x == null || y == null || width == null || height == null) {
				return null
			}

			const barRectangleItem: BarRectangleItem = {
				...(entry as Record<string, unknown>),
				background,
				height: height as number,
				parentViewBox,
				payload: entry,
				stackedBarStart: stackedBarStart as number,
				tooltipPosition: {
					x: (x as number) + (width as number) / 2,
					y: (y as number) + (height as number) / 2,
				},
				value: stackedData ? value : (value as number[])[1],
				width: width as number,
				x: x as number,
				y: y as number,
				...(cells && cells[index] && (cells[index] as { props?: Record<string, unknown> }).props),
			} as BarRectangleItem

			return barRectangleItem
		})
		.filter(Boolean) as ReadonlyArray<BarRectangleItem>
}

/**
 * @provides ErrorBarContext
 * @provides LabelListContext
 * @provides CellReader
 * @consumes CartesianChartContext
 * @consumes BarStackContext
 */
type BarPropsWithDefaults = Props & Required<Pick<BarProps, keyof typeof defaultBarProps>>

export function Bar(outsideProps: Props) {
	/* GOTCHA-013: split children BEFORE resolveDefaultProps. resolveDefaultProps does
	   `{...realProps}` which enumerates own keys of the Solid props proxy — reading the
	   `children` getter eagerly invokes createComponent on user JSX (ErrorBar, etc.) at
	   Bar's setup time, BEFORE RegisterGraphicalItemId installs its Provider. ErrorBar's
	   `useGraphicalItemId()` then resolves to undefined and `ReportErrorBarSettings`
	   bails out early — `errorBars` slice stays empty forever. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const rawProps = resolveDefaultProps(restProps, defaultBarProps)
	const props = rawProps as BarPropsWithDefaults
	const stackId = useStackId(props.stackId)
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	return (
		<RegisterGraphicalItemId id={props.id} type="bar">
			{(id) => {
				/* GOTCHA-017 (session 34): hoist SetErrorBarContext from BarImpl to here.
				   Reason: user JSX <ErrorBar/> in props.children evaluates eagerly when the
				   children getter is read by BarImpl's children flow — that read happens
				   at the closest Provider scope above the read site. By installing
				   SetErrorBarContext at the same level as RegisterGraphicalItemId children-fn
				   (i.e. directly above where `childrenProps.children` is consumed by JSX),
				   ErrorBar's useErrorBarContext resolves to the live Provider, not the
				   initial-default. rects/offset are computed via the same selector BarImpl
				   uses; redundant compute is fine because Solid memoizes selector results. */
				const rects = () =>
					ctx ? selectBarRectangles(ctx.store, id, isPanorama, undefined) : undefined
				const layoutForOffset = () => useChartLayout()
				const errorBarOffset = () => {
					const firstDataPoint = rects()?.[0]
					if (
						firstDataPoint == null ||
						firstDataPoint.height == null ||
						firstDataPoint.width == null
					) {
						return 0
					}
					return layoutForOffset() === "vertical"
						? firstDataPoint.height / 2
						: firstDataPoint.width / 2
				}
				return (
					<>
						<SetLegendPayload legendPayload={computeLegendPayloadFromBarData(props)} />
						<SetBarTooltipEntrySettings
							dataKey={props.dataKey}
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
							type="bar"
							id={id}
							data={undefined}
							xAxisId={props.xAxisId}
							yAxisId={props.yAxisId}
							zAxisId={0}
							dataKey={props.dataKey}
							stackId={stackId}
							hide={props.hide}
							barSize={props.barSize}
							minPointSize={props.minPointSize}
							maxBarSize={props.maxBarSize}
							isPanorama={isPanorama}
						/>
						<SetErrorBarContext
							xAxisId={props.xAxisId}
							yAxisId={props.yAxisId}
							data={rects()}
							dataPointFormatter={errorBarDataPointFormatter}
							errorBarOffset={errorBarOffset()}
						>
							<BarChildrenScope
								childrenProps={childrenProps}
								id={id}
								mergedBarProps={props}
							/>
						</SetErrorBarContext>
					</>
				)
			}}
		</RegisterGraphicalItemId>
	)
}

Bar.displayName = "Bar"
