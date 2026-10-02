/* eslint-disable import/no-cycle, sort-keys */
import type { Formatter } from "../component/DefaultTooltipContent"
import { createMemo, For, Show, untrack } from 'solid-js';
import { createHoverDedupe } from "../util/hoverDedupe"
import type { JSX } from '@solidjs/web';
import omit from "es-toolkit/compat/omit"
import { clsx } from "clsx"
import { selectActiveIndex } from "../state/selectors/selectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { readChartState } from "../state/chartState"
import { Layer } from "../container/Layer"
import type { Props as TrapezoidProps } from "../shape/Trapezoid"
import {
	LabelListContextBridge,
	CartesianLabelListContextProvider,
	type CartesianLabelListEntry,
	type ImplicitLabelListType,
	LabelListFromLabelProp,
} from "../component/LabelList"
import { getPercentValue, interpolate } from "../util/DataUtils"
import { getValueByDataKey } from "../util/ChartUtils"
import {
	type ActiveShape,
	adaptEventsOfChild,
	type AnimationDuration,
	type AnimationTiming,
	type CartesianViewBoxRequired,
	type ChartOffsetInternal,
	type Coordinate,
	type DataConsumer,
	type DataKey,
	type DataProvider,
	type LegendType,
	type PresentationAttributesAdaptChildEvent,
	type TooltipType,
	type TrapezoidViewBox,
} from "../util/types"
import { FunnelTrapezoid, type FunnelTrapezoidProps } from "../util/FunnelUtils"
import {
	useMouseClickItemDispatch,
	useMouseEnterItemDispatch,
	useMouseLeaveItemDispatch,
} from "../context/tooltipContext"
import type { TooltipPayload, TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import {
	type ResolvedFunnelSettings,
	selectFunnelTrapezoids,
} from "../state/selectors/funnelSelectors"
import { CellsContextProvider, createCellsRegistry } from "../context/CellsContext"
import type { CellsRegistry } from "../context/CellsContext"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { usePlotArea } from "../hooks"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import type { AnimationInterpolateFn } from "../animation/AnimatedItems"
import { matchAppend } from "../animation/matchBy"
import type { AnimationMatchByProp } from "../animation/matchBy"
import { useCartesianChartLayout } from "../context/chartLayoutContext"
import type { CartesianLayout, ShapeAnimationProps } from "../util/types"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { WithIdRequired } from "../util/useUniqueId"

import { splitProps } from '../util/solid-1-compat';
export type FunnelTrapezoidItem = TrapezoidProps &
	TrapezoidViewBox & {
		value?: number | string
		payload?: unknown
		tooltipPosition: Coordinate
		name: string
		labelViewBox: TrapezoidViewBox
		parentViewBox: CartesianViewBoxRequired
		val: number | ReadonlyArray<number>
		tooltipPayload: TooltipPayload
	}

/**
 * Internal props, combination of external props + defaultProps + private Recharts state
 */
type InternalFunnelProps = RequiresDefaultProps<FunnelProps, typeof defaultFunnelProps> & {
	id: GraphicalItemId
	trapezoids: ReadonlyArray<FunnelTrapezoidItem>
}

/**
 * External props, intended for end users to fill in
 */
interface FunnelProps<DataPointType = unknown, DataValueType = unknown>
	extends DataProvider<DataPointType>, Required<DataConsumer<DataPointType, DataValueType>> {
	/**
	 * This component is rendered when this graphical item is activated
	 * (could be by mouse hover, touch, keyboard, programmatically).
	 */
	activeShape?: ActiveShape<FunnelTrapezoidItem, SVGPathElement>
	/**
	 * Specifies when the animation should begin, the unit of this option is ms.
	 * @defaultValue 400
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
	animationInterpolateFn?: AnimationInterpolateFn<FunnelTrapezoidItem, CartesianLayout>
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
	animationMatchBy?: AnimationMatchByProp<FunnelTrapezoidItem>
	className?: string
	/**
	 * Hides the whole graphical element when true.
	 *
	 * Hiding an element is different from removing it from the chart:
	 * Hidden graphical elements are still visible in Legend,
	 * and can be included in axis domain calculations,
	 * depending on `includeHidden` props of your XAxis/YAxis.
	 *
	 * @defaultValue false
	 */
	hide?: boolean
	/**
	 * Unique identifier of this component.
	 * Used as an HTML attribute `id`, and also to identify this element internally.
	 *
	 * If undefined, Recharts will generate a unique ID automatically.
	 */
	id?: string
	/**
	 * If set false, animation of funnel will be disabled.
	 * If set "auto", animation is disabled during SSR and when the user prefers reduced motion.
	 * @defaultValue auto
	 */
	isAnimationActive?: boolean | "auto"
	label?: ImplicitLabelListType
	/**
	 * @defaultValue triangle
	 */
	lastShapeType?: "triangle" | "rectangle"
	/**
	 * The type of icon in legend.  If set to 'none', no legend item will be rendered.
	 * @defaultValue rect
	 */
	legendType?: LegendType
	/**
	 * The name of this graphical item, used in tooltip and legend.
	 */
	name?: string | number
	/**
	 * Name represents each sector in the tooltip.
	 * This allows you to extract the name from the data:
	 *
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the name.
	 *
	 * @defaultValue name
	 */
	nameKey?: DataKey<DataPointType, DataValueType>
	/**
	 * The customized event handler of animation end
	 */
	onAnimationEnd?: () => void
	/**
	 * The customized event handler of animation start
	 */
	onAnimationStart?: () => void
	reversed?: boolean
	/**
	 * If set a ReactElement, the shape of funnel can be customized.
	 * If set a function, the function will be called to render customized shape.
	 */
	shape?: ActiveShape<FunnelTrapezoidItem, SVGPathElement>
	tooltipType?: TooltipType
	/**
	 * Formats the value displayed in the tooltip for this Funnel.
	 * When set, takes precedence over the `formatter` prop on the Tooltip component.
	 */
	formatter?: Formatter
	/**
	 * The customized event handler of click on the area in this group
	 */
	onClick?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mousedown on the area in this group
	 */
	onMouseDown?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseup on the area in this group
	 */
	onMouseUp?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mousemove on the area in this group
	 */
	onMouseMove?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseover on the area in this group
	 */
	onMouseOver?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseout on the area in this group
	 */
	onMouseOut?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseenter on the area in this group
	 */
	onMouseEnter?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseleave on the area in this group
	 */
	onMouseLeave?: (data: FunnelTrapezoidItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
}

type FunnelSvgProps = Omit<
	PresentationAttributesAdaptChildEvent<FunnelTrapezoidItem, SVGPathElement>,
	"ref"
>

type InternalProps = FunnelSvgProps & InternalFunnelProps

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type Props<DataPointType = any, DataValueType = any> = FunnelSvgProps & FunnelProps<DataPointType, DataValueType>

type RealFunnelData = unknown

type FunnelTrapezoidsProps = ShapeAnimationProps & {
	trapezoids: ReadonlyArray<FunnelTrapezoidItem>
	allOtherFunnelProps: InternalProps
}

function SetFunnelTooltipEntrySettings(props: {
	dataKey: InternalProps["dataKey"]
	nameKey: InternalProps["nameKey"]
	stroke: string | undefined
	strokeWidth: number | string | undefined
	fill: string | undefined
	name: string | number | undefined
	hide: boolean | undefined
	tooltipType: InternalProps["tooltipType"]
	formatter: Formatter | undefined
	data: InternalProps["data"]
	id: InternalProps["id"]
	trapezoids: ReadonlyArray<FunnelTrapezoidItem>
}) {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.data,
		getPosition: (index) => props.trapezoids[Number(index)]?.tooltipPosition,
		settings: {
			color: props.fill,
			dataKey: props.dataKey,
			fill: props.fill,
			formatter: props.formatter,
			graphicalItemId: props.id,
			hide: props.hide,
			name: props.name,
			nameKey: props.nameKey,
			stroke: props.stroke,
			strokeWidth: props.strokeWidth,
			type: props.tooltipType,
			unit: "",
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

function FunnelLabelListProvider(props: {
	showLabels: boolean
	trapezoids: ReadonlyArray<FunnelTrapezoidItem> | undefined
	children: JSX.Element
}) {
	const labelListEntries = createMemo((): ReadonlyArray<CartesianLabelListEntry> | undefined => {
		if (!props.showLabels) {
			return undefined
		}
		return props.trapezoids?.map((entry): CartesianLabelListEntry => {
			const viewBox: TrapezoidViewBox = entry.labelViewBox

			return {
				...viewBox,
				fill: entry.fill,
				parentViewBox: entry.parentViewBox,
				payload: entry.payload,
				value: entry.name,
				viewBox,
			}
		})
	})

	/* eslint-disable solid/reactivity -- labelListEntries() in JSX tracked scope; linter can't trace through Context.Provider value prop */
	return (
		<CartesianLabelListContextProvider value={labelListEntries()}>
			{props.children}
		</CartesianLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

function FunnelTrapezoids(funnelTrapProps: FunnelTrapezoidsProps) {
	/* GOTCHA-016-C: one entry per pointer move across both event pairs, shared by all items. */
	const hover = createHoverDedupe()
	const ctx = useChartStore()
	const activeItemIndex = createMemo(() =>
		ctx
			? selectActiveIndex(
					ctx.store,
					"item",
					readChartState(ctx.store).tooltip.settings.trigger,
					undefined,
				)
			: undefined,
	)

	/* eslint-disable solid/reactivity -- id is a stable identifier; handler and dataKey sources are accessors read at event time */
	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() => funnelTrapProps.allOtherFunnelProps.onMouseEnter,
		() => funnelTrapProps.allOtherFunnelProps.dataKey,
		funnelTrapProps.allOtherFunnelProps.id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() => funnelTrapProps.allOtherFunnelProps.onMouseLeave,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() => funnelTrapProps.allOtherFunnelProps.onClick,
		() => funnelTrapProps.allOtherFunnelProps.dataKey,
		funnelTrapProps.allOtherFunnelProps.id,
	)
	/* eslint-enable solid/reactivity */

	return (
		<For each={funnelTrapProps.trapezoids}>
			{(entry: FunnelTrapezoidItem, i) => {
				const isActiveIndex = () =>
					Boolean(funnelTrapProps.allOtherFunnelProps.activeShape) &&
					activeItemIndex() === String(i())
				const trapezoidOptions = () =>
					isActiveIndex()
						? funnelTrapProps.allOtherFunnelProps.activeShape
						: funnelTrapProps.allOtherFunnelProps.shape

				const trapezoidProps = (): Omit<FunnelTrapezoidProps, "id"> => ({
					...entry,
					animationElapsedTime: funnelTrapProps.animationElapsedTime,
					isActive: isActiveIndex(),
					isAnimating: funnelTrapProps.isAnimating,
					isEntrance: funnelTrapProps.isEntrance,
					/* read lazily where Shape renders it (an element option mints a shape per read) */
					get option() {
						return trapezoidOptions()
					},
					stroke: entry.stroke,
				})

				/* Event handlers bind once per item, like a keyed list. */
				const handlerIndex = untrack(i)
				/* GOTCHA-016-C: bind both pairs, dedupe per-instance. Compose adapted user handlers. */
				const adapted = untrack(
					() =>
						(adaptEventsOfChild(funnelTrapProps.allOtherFunnelProps, entry, handlerIndex) ??
							{}) as Record<string, ((e: Event) => void) | undefined>,
				)
				const enter = onMouseEnterFromContext(entry, handlerIndex)
				const leave = onMouseLeaveFromContext(entry, handlerIndex)
				const userOver = adapted.onMouseOver
				const userOut = adapted.onMouseOut
				const fireEnter = (e: MouseEvent & { currentTarget: SVGGraphicsElement }) => {
					if (!hover.enter(e)) return
					userOver?.(e)
					enter(e)
				}
				const fireLeave = (e: MouseEvent & { currentTarget: SVGGraphicsElement }) => {
					if (!hover.leave(e)) return
					userOut?.(e)
					leave(e)
				}
				return (
					<Layer
						class="recharts-funnel-trapezoid"
						{...adapted}
						onMouseEnter={fireEnter}
						onMouseOver={fireEnter}
						onMouseLeave={fireLeave}
						onMouseOut={fireLeave}
						onClick={onClickFromContext(entry, handlerIndex)}
					>
						<FunnelTrapezoid {...trapezoidProps()} />
					</Layer>
				)
			}}
		</For>
	)
}

const defaultFunnelAnimateItems: AnimationInterpolateFn<FunnelTrapezoidItem, CartesianLayout> = (
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
					height: interpolate(item.prev.height, item.next.height, animationElapsedTime),
					lowerWidth: interpolate(item.prev.lowerWidth, item.next.lowerWidth, animationElapsedTime),
					upperWidth: interpolate(item.prev.upperWidth, item.next.upperWidth, animationElapsedTime),
					x: interpolate(item.prev.x, item.next.x, animationElapsedTime),
					y: interpolate(item.prev.y, item.next.y, animationElapsedTime),
				},
			]
		}
		// added
		const { next } = item
		return [
			{
				...next,
				height: interpolate(0, next.height, animationElapsedTime),
				lowerWidth: interpolate(0, next.lowerWidth, animationElapsedTime),
				upperWidth: interpolate(0, next.upperWidth, animationElapsedTime),
				x: interpolate(next.x + next.upperWidth / 2, next.x, animationElapsedTime),
				y: interpolate(next.y + next.height / 2, next.y, animationElapsedTime),
			},
		]
	})
}

function TrapezoidsWithAnimation(animProps: {
	props: InternalProps
	previousTrapezoidsRef: { current: ReadonlyArray<FunnelTrapezoidItem> | undefined }
}) {
	const layout = createMemo(() => useCartesianChartLayout())
	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks(
		() => animProps.props.onAnimationStart,
		() => animProps.props.onAnimationEnd,
	)

	return (
		<Show when={layout()}>
			{(cartesianLayout) => (
				<FunnelLabelListProvider showLabels={!isAnimating()} trapezoids={animProps.props.trapezoids}>
					<AnimatedItems
						animationInput={animProps.props.trapezoids}
						animationIdPrefix="recharts-funnel-"
						items={animProps.props.trapezoids}
						previousItemsRef={animProps.previousTrapezoidsRef}
						isAnimationActive={animProps.props.isAnimationActive}
						animationBegin={animProps.props.animationBegin}
						animationDuration={animProps.props.animationDuration}
						animationEasing={animProps.props.animationEasing}
						onAnimationStart={handleAnimationStart}
						onAnimationEnd={handleAnimationEnd}
						animationInterpolateFn={animProps.props.animationInterpolateFn}
						animationMatchBy={animProps.props.animationMatchBy}
						layout={cartesianLayout()}
					>
						{(stepData, animationElapsedTime, isEntrance) => (
							<Layer>
								<FunnelTrapezoids
									trapezoids={stepData()}
									allOtherFunnelProps={animProps.props}
									animationElapsedTime={animationElapsedTime()}
									isAnimating={isAnimating() || animationElapsedTime() < 1}
									isEntrance={isEntrance()}
								/>
							</Layer>
						)}
					</AnimatedItems>
					<LabelListFromLabelProp label={animProps.props.label} />
					{animProps.props.children}
				</FunnelLabelListProvider>
			)}
		</Show>
	)
}

function RenderTrapezoids(props: InternalProps) {
	const previousTrapezoidsRef: { current: ReadonlyArray<FunnelTrapezoidItem> | undefined } = {
		current: undefined,
	}
	return <TrapezoidsWithAnimation props={props} previousTrapezoidsRef={previousTrapezoidsRef} />
}

const getRealWidthHeight = (
	customWidth: number | string | undefined,
	offset: ChartOffsetInternal,
) => {
	const realWidth: number = getPercentValue(customWidth, offset.width, offset.width)

	return {
		offsetX: offset.left,
		offsetY: offset.top,
		realHeight: offset.height,
		realWidth,
	}
}

export const defaultFunnelProps = {
	animationBegin: 400,
	animationDuration: 1500,
	animationEasing: "ease",
	animationInterpolateFn: defaultFunnelAnimateItems,
	animationMatchBy: matchAppend,
	fill: "#808080",
	hide: false,
	isAnimationActive: "auto",
	lastShapeType: "triangle",
	legendType: "rect",
	nameKey: "name",
	reversed: false,
	stroke: "#fff",
} as const satisfies Partial<Props>

function FunnelImpl(
	props: WithIdRequired<RequiresDefaultProps<Props, typeof defaultFunnelProps>> & { cellsRegistry: CellsRegistry },
) {
	const plotArea = createMemo(() => usePlotArea())
	const ctx = useChartStore()

	/* The graphical item id identifies the Funnel, not each trapezoid; keep it out
	   of the per-entry presentation props so trapezoids carry no duplicate `id`. */
	const presentationProps = (() => {
		const { id: _id, ...rest } = svgPropertiesNoEvents(props) as Record<string, unknown>
		return rest
	})()
	const cells = createMemo(() => {
		const list = props.cellsRegistry.cells()
		return list.map((cell) => cell.props)
	})

	const funnelSettings = createMemo(
		(): ResolvedFunnelSettings => ({
			cells: cells(),
			customWidth: props.width,
			data: props.data,
			dataKey: props.dataKey,
			id: props.id,
			lastShapeType: props.lastShapeType,
			nameKey: props.nameKey,
			presentationProps,
			reversed: props.reversed,
			tooltipType: props.tooltipType,
		}),
	)

	const trapezoids = () =>
		ctx ? selectFunnelTrapezoids(ctx.store, funnelSettings()) : undefined

	return (
		<Show
			when={!props.hide && (trapezoids()?.length ?? 0) > 0 && plotArea()}
			fallback={null}
		>
			{(() => {
				const viewBox = plotArea()
				const { height, width } = viewBox as { height: number; width: number }
				const layerClass = () => clsx("recharts-trapezoids", props.className)
				const tz = (): ReadonlyArray<FunnelTrapezoidItem> => trapezoids() ?? []

				return (
					<>
						<SetFunnelTooltipEntrySettings
							dataKey={props.dataKey}
							nameKey={props.nameKey}
							stroke={props.stroke}
							strokeWidth={props["stroke-width"]}
							fill={props.fill}
							name={props.name}
							hide={props.hide}
							tooltipType={props.tooltipType}
							formatter={props.formatter}
							data={props.data}
							trapezoids={tz()}
							id={props.id}
						/>
						<Layer class={layerClass()}>
							<RenderTrapezoids
								{...props}
								height={height}
								width={width}
								trapezoids={tz()}
							/>
						</Layer>
					</>
				)
			})()}
		</Show>
	)
}

export function computeFunnelTrapezoids({
	dataKey,
	nameKey,
	displayedData,
	tooltipType,
	lastShapeType,
	reversed,
	offset,
	customWidth,
	graphicalItemId,
}: {
	dataKey: Props["dataKey"]
	nameKey: Props["nameKey"]
	offset: ChartOffsetInternal
	displayedData: ReadonlyArray<RealFunnelData>
	tooltipType?: TooltipType
	lastShapeType?: Props["lastShapeType"]
	reversed?: boolean
	customWidth: number | string | undefined
	graphicalItemId: GraphicalItemId
}): ReadonlyArray<FunnelTrapezoidItem> {
	const { realHeight, realWidth, offsetX, offsetY } = getRealWidthHeight(customWidth, offset)
	const values = displayedData.map((entry: unknown) => {
		const val = getValueByDataKey(entry, dataKey, 0)
		return typeof val === "number" ? val : 0
	})
	const maxValue = Math.max.apply(null, values)
	const len = displayedData.length
	const rowHeight = realHeight / len
	const parentViewBox = {
		height: offset.height,
		width: offset.width,
		x: offset.left,
		y: offset.top,
	}

	let trapezoids: ReadonlyArray<FunnelTrapezoidItem> = displayedData.map(
		(entry: unknown, i: number): FunnelTrapezoidItem => {
			const rawVal = getValueByDataKey(entry, dataKey, 0) as number | ReadonlyArray<number>
			const name: string = String(getValueByDataKey(entry, nameKey, i))
			let val = rawVal
			let nextVal: number | ReadonlyArray<number> | undefined

			if (i !== len - 1) {
				const nextDataValue = getValueByDataKey(displayedData[i + 1], dataKey, 0)
				if (typeof nextDataValue === "number") {
					nextVal = nextDataValue
				} else if (Array.isArray(nextDataValue)) {
					const [first, second] = nextDataValue
					if (typeof first === "number") {
						val = first
					}
					if (typeof second === "number") {
						nextVal = second
					}
				}
			} else if (Array.isArray(rawVal) && rawVal.length === 2) {
				const [first, second] = rawVal
				if (typeof first === "number") {
					val = first
				}
				if (typeof second === "number") {
					nextVal = second
				}
			} else if (lastShapeType === "rectangle") {
				nextVal = val
			} else {
				nextVal = 0
			}

			/* val and nextVal may be arrays for ranged values; numeric coercion handles the math */
			/* maxValue 0 (all values zero) would divide by zero: collapse to zero width (#7184) */
			const x = maxValue === 0 ? offsetX : ((maxValue - (val as number)) * realWidth) / (2 * maxValue) + offsetX
			const y = rowHeight * i + offsetY
			const upperWidth = maxValue === 0 ? 0 : ((val as number) / maxValue) * realWidth
			const lowerWidth = maxValue === 0 ? 0 : ((nextVal as number) / maxValue) * realWidth

			const tooltipPayload: TooltipPayload = [
				{ dataKey, graphicalItemId, name, payload: entry, type: tooltipType, value: val },
			]
			const tooltipPosition: Coordinate = {
				x: x + upperWidth / 2,
				y: y + rowHeight / 2,
			}

			const trapezoidViewBox: TrapezoidViewBox = {
				height: rowHeight,
				lowerWidth,
				upperWidth,
				width: Math.max(upperWidth, lowerWidth),
				x,
				y,
			}

			return {
				...trapezoidViewBox,
				name,
				val: val as number | ReadonlyArray<number>,
				tooltipPayload,
				tooltipPosition,
				...(entry != null && typeof entry === "object"
					? omit(entry as Record<string, unknown>, ["width"])
					: {}),
				payload: entry,
				parentViewBox,
				labelViewBox: trapezoidViewBox,
			}
		},
	)

	if (reversed) {
		trapezoids = trapezoids.map(
			(entry: FunnelTrapezoidItem, index: number): FunnelTrapezoidItem => {
				const reversedViewBox: TrapezoidViewBox = {
					height: rowHeight,
					lowerWidth: entry.upperWidth,
					upperWidth: entry.lowerWidth,
					width: Math.max(entry.lowerWidth, entry.upperWidth),
					x: entry.x - (entry.lowerWidth - entry.upperWidth) / 2,
					y: entry.y - index * rowHeight + (len - 1 - index) * rowHeight,
				}

				return {
					...entry,
					...reversedViewBox,
					labelViewBox: reversedViewBox,
					tooltipPosition: {
						...entry.tooltipPosition,
						y: entry.y - index * rowHeight + (len - 1 - index) * rowHeight + rowHeight / 2,
					},
				}
			},
		)
	}

	return trapezoids
}

/**
 * @consumes CartesianViewBoxContext
 * @provides LabelListContext
 * @provides CellReader
 */
function FunnelFn(outsideProps: Props): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps. The destructure spread
	   reads the `children` getter on the props proxy, eagerly evaluating user JSX
	   (Cell, etc.) before RegisterGraphicalItemId installs its Provider.
	   Memoize once — the `get children()` getter on user JSX re-creates components on
	   every read. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const [idProps, props] = splitProps(resolveDefaultProps(restProps, defaultFunnelProps), ["id"])
	return (
		<RegisterGraphicalItemId id={idProps.id} type="funnel">
			{(id) => (
				<LabelListContextBridge>
					{(() => {
						/* <Cell/> children register here; upstream reads them with findAllByType. */
						const cellsRegistry = createCellsRegistry()
						return (
							<CellsContextProvider value={cellsRegistry}>
								{(() => {
									/* Memoize children inside Provider scope (GOTCHA-013). */
									const memoizedChildren = createMemo(() => childrenProps.children)
									return (
										<FunnelImpl {...props} id={id} cellsRegistry={cellsRegistry}>
											{memoizedChildren()}
										</FunnelImpl>
									)
								})()}
							</CellsContextProvider>
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
export const Funnel = FunnelFn as {
	<DataPointType = any, DataValueType = any>(props: Props<DataPointType, DataValueType>): JSX.Element
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream fallback overload for mismatched data/dataKey */
	(props: Props<any, any>): JSX.Element
	displayName?: string
}
Funnel.displayName = "Funnel"
