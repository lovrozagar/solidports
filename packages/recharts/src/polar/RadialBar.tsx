/* eslint-disable import/no-cycle, sort-keys */
import type { Formatter } from "../component/DefaultTooltipContent"
import type { JSX } from '@solidjs/web';
import { CellsContextProvider, createCellsRegistry } from "../context/CellsContext"
import type { CellsRegistry } from "../context/CellsContext"
import { createHoverDedupe } from "../util/hoverDedupe"
import { createMemo, Show, useContext } from 'solid-js';
import { clsx } from "clsx"

import { Series } from "victory-vendor/d3-shape"
import { parseCornerRadius, RadialBarSector, RadialBarSectorProps } from "../util/RadialBarUtils"
import { Props as SectorProps } from "../shape/Sector"
import { Layer } from "../container/Layer"
import {
	LabelListContextBridge,
	ImplicitLabelListType,
	LabelListFromLabelProp,
	PolarLabelListContextProvider,
	PolarLabelListEntry,
} from "../component/LabelList"
import { interpolate, mathSign, noop } from "../util/DataUtils"
import {
	BarPositionPosition,
	getCateCoordinateOfBar,
	getNormalizedStackId,
	getTooltipNameProp,
	getValueByDataKey,
	truncateByDomain,
} from "../util/ChartUtils"
import {
	ActiveShape,
	adaptEventsOfChild,
	AnimationDuration,
	AnimationTiming,
	DataConsumer,
	DataKey,
	LayoutType,
	LegendType,
	PolarViewBoxRequired,
	PresentationAttributesAdaptChildEvent,
	TickItem,
	TooltipType,
} from "../util/types"
import {
	TooltipTriggerInfo,
	useMouseClickItemDispatch,
	useMouseEnterItemDispatch,
	useMouseLeaveItemDispatch,
} from "../context/tooltipContext"
import { TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { BaseAxisWithScale } from "../state/selectors/axisSelectors"
import { ChartData } from "../state/chartDataSlice"
import {
	selectRadialBarLegendPayload,
	selectRadialBarSectors,
} from "../state/selectors/radialBarSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { RechartsStateContext } from "../state/RechartsStateContext"
import type { AngleAxisSettings, RadiusAxisSettings } from "../state/polarAxisSlice"
import { selectActiveTooltipIndex } from "../state/selectors/tooltipSelectors"
import { SetPolarLegendPayload } from "../state/SetLegendPayload"
import { AxisId } from "../state/cartesianAxisSlice"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { RadialBarSettings } from "../state/types/RadialBarSettings"
import { SetPolarGraphicalItem } from "../state/SetGraphicalItem"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
} from "../util/svgPropertiesNoEvents"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import type { AnimationInterpolateFn } from "../animation/AnimatedItems"
import { matchAppend } from "../animation/matchBy"
import type { AnimationMatchByProp } from "../animation/matchBy"
import { usePolarChartLayout } from "../context/chartLayoutContext"
import type { PolarLayout, ShapeAnimationProps } from "../util/types"
import { RequiresDefaultProps, resolveDefaultProps } from "../util/resolveDefaultProps"
import { WithIdRequired } from "../util/useUniqueId"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { getZIndexFromUnknown } from "../zIndex/getZIndexFromUnknown"

import { mergeProps, splitProps } from '../util/solid-1-compat';
const STABLE_EMPTY_ARRAY: readonly RadialBarDataItem[] = []

export type RadialBarDataItem = SectorProps &
	PolarViewBoxRequired &
	TooltipTriggerInfo & {
		value?: unknown
		payload?: unknown
		background?: SectorProps
	}

type RadialBarBackground = boolean | (ActiveShape<SectorProps> & ZIndexable)

type RadialBarSectorsProps = ShapeAnimationProps & {
	sectors: ReadonlyArray<RadialBarDataItem>
	allOtherRadialBarProps: InternalProps
	showLabels: boolean
}

function RadialBarLabelListProvider(props: {
	showLabels: boolean
	sectors: ReadonlyArray<RadialBarDataItem>
	children: JSX.Element
}): JSX.Element {
	const labelListEntries = createMemo((): ReadonlyArray<PolarLabelListEntry> =>
		props.sectors.map(
			(sector: RadialBarDataItem): PolarLabelListEntry => ({
				clockWise: false,
				fill: sector.fill,
				parentViewBox: undefined,
				payload: sector.payload,
				value: sector.value,
				viewBox: {
					clockWise: false,
					cx: sector.cx,
					cy: sector.cy,
					endAngle: sector.endAngle,
					innerRadius: sector.innerRadius,
					outerRadius: sector.outerRadius,
					startAngle: sector.startAngle,
				},
			}),
		),
	)

	/* eslint-disable solid/reactivity -- showLabels and labelListEntries() in JSX; reactive via Solid's JSX transform */
	return (
		<PolarLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</PolarLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

function RadialBarSectorsComponent(props: RadialBarSectorsProps): JSX.Element {
	/* GOTCHA-016-C: one entry per pointer move across both event pairs, shared by all items. */
	const hover = createHoverDedupe()
	const [local, others] = splitProps(props.allOtherRadialBarProps, [
		"shape",
		"activeShape",
		"cornerRadius",
		"id",
		"children",
	])
	const id = local.id
	const baseProps = createMemo(() => svgPropertiesNoEvents(others))
	const ctx = useChartStore()

	const activeIndex = createMemo(() =>
		ctx ? selectActiveTooltipIndex(ctx.store) : undefined,
	)
	/* GOTCHA-005-D: destructuring froze handlers at setup; rebuild restOfAllOtherProps
	   on each access and pass live accessors to event-dispatch hooks. */
	const restOfAllOtherProps = (): Record<string, unknown> => {
		const { onMouseEnter, onClick, onMouseLeave, ...rest } =
			props.allOtherRadialBarProps as unknown as Record<string, unknown>
		void onMouseEnter
		void onClick
		void onMouseLeave
		return rest
	}

	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() => props.allOtherRadialBarProps.onMouseEnter,
		() => props.allOtherRadialBarProps.dataKey,
		id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() => props.allOtherRadialBarProps.onMouseLeave,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() => props.allOtherRadialBarProps.onClick,
		() => props.allOtherRadialBarProps.dataKey,
		id,
	)

	/* eslint-disable solid/prefer-for -- map() is required here; <For keyed={false}> loses reactivity for activeShape changes since entry is snapshotted per slot */
	return (
		<Show when={props.sectors != null}>
		<RadialBarLabelListProvider showLabels={props.showLabels} sectors={props.sectors ?? []}>
			{(props.sectors ?? []).map((entry: RadialBarDataItem, i: number) => {
				const isActive: boolean = Boolean(local.activeShape && activeIndex() === String(i))
				const onMouseEnter = onMouseEnterFromContext(entry, i)
				const onMouseLeave = onMouseLeaveFromContext(entry, i)
				const onClick = onClickFromContext(entry, i)

				/* GOTCHA-016-C: bind both enter/leave AND over/out, dedupe per-instance so user.hover (fires both) only dispatches once. */
				const fireEnter = (e: MouseEvent) => {
					if (!hover.enter(e)) return
					onMouseEnter(e as MouseEvent & { currentTarget: SVGGraphicsElement })
				}
				const fireLeave = (e: MouseEvent) => {
					if (!hover.leave(e)) return
					onMouseLeave(e as MouseEvent & { currentTarget: SVGGraphicsElement })
				}
				const radialBarSectorProps: RadialBarSectorProps = {
					...baseProps(),
					cornerRadius: parseCornerRadius(local.cornerRadius),
					...entry,
					...adaptEventsOfChild(restOfAllOtherProps(), entry, i),
					onMouseEnter: fireEnter,
					onMouseOver: fireEnter,
					onMouseLeave: fireLeave,
					onMouseOut: fireLeave,
					onClick: (e: MouseEvent) => onClick(e as MouseEvent & { currentTarget: SVGGraphicsElement }),
					className: `recharts-radial-bar-sector ${(entry as { className?: string }).className ?? ""}`.trim(),
					forceCornerRadius: others.forceCornerRadius,
					cornerIsExternal: others.cornerIsExternal,
					isActive,
					/* read lazily where Shape renders it (an element option mints a shape per read) */
					get option() {
						return isActive ? local.activeShape : local.shape
					},
					index: i,
					animationElapsedTime: props.animationElapsedTime,
					isAnimating: props.isAnimating,
					isEntrance: props.isEntrance,
				}

				if (isActive) {
					return (
						<ZIndexLayer zIndex={DefaultZIndexes.activeBar}>
							<RadialBarSector {...radialBarSectorProps} />
						</ZIndexLayer>
					)
				}

				return <RadialBarSector {...radialBarSectorProps} />
			})}
			<LabelListFromLabelProp label={props.allOtherRadialBarProps.label} />
			{local.children}
		</RadialBarLabelListProvider>
		</Show>
	)
	/* eslint-enable solid/prefer-for */
}

const defaultRadialBarAnimateItems: AnimationInterpolateFn<RadialBarDataItem, PolarLayout> = (
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
					endAngle: interpolate(item.prev.endAngle, item.next.endAngle, animationElapsedTime),
					startAngle: interpolate(item.prev.startAngle, item.next.startAngle, animationElapsedTime),
				},
			]
		}
		// added
		return [
			{
				...item.next,
				endAngle: interpolate(item.next.startAngle, item.next.endAngle, animationElapsedTime),
			},
		]
	})
}

function SectorsWithAnimation(props: {
	radialBarProps: InternalProps
	previousSectorsRef: { current: ReadonlyArray<RadialBarDataItem> | null }
}): JSX.Element {
	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks(
		() => props.radialBarProps.onAnimationStart,
		() => props.radialBarProps.onAnimationEnd,
	)
	const layout = createMemo(() => usePolarChartLayout())

	return (
		<Show when={layout()}>
			{(polarLayout) => (
				<AnimatedItems
					animationInput={props.radialBarProps.sectors}
					animationIdPrefix="recharts-radialbar-"
					items={props.radialBarProps.sectors}
					previousItemsRef={props.previousSectorsRef}
					isAnimationActive={props.radialBarProps.isAnimationActive}
					animationBegin={props.radialBarProps.animationBegin}
					animationDuration={props.radialBarProps.animationDuration}
					animationEasing={props.radialBarProps.animationEasing}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationInterpolateFn={props.radialBarProps.animationInterpolateFn}
					animationMatchBy={props.radialBarProps.animationMatchBy}
					layout={polarLayout()}
				>
					{(stepData, animationElapsedTime, isEntrance) => (
						<RadialBarSectorsComponent
							sectors={stepData()}
							allOtherRadialBarProps={props.radialBarProps}
							showLabels={!isAnimating()}
							animationElapsedTime={animationElapsedTime()}
							isAnimating={isAnimating() || animationElapsedTime() < 1}
							isEntrance={isEntrance()}
						/>
					)}
				</AnimatedItems>
			)}
		</Show>
	)
}

function RenderSectors(props: InternalProps): JSX.Element {
	const previousSectorsRef: { current: ReadonlyArray<RadialBarDataItem> | null } = {
		current: null,
	}
	return <SectorsWithAnimation radialBarProps={props} previousSectorsRef={previousSectorsRef} />
}

interface InternalRadialBarProps<DataPointType = unknown, DataValueType = unknown>
	extends DataConsumer<DataPointType, DataValueType>, ZIndexable {
	activeShape?: ActiveShape<RadialBarSectorProps, SVGPathElement>
	/**
	 * @defaultValue 0
	 */
	angleAxisId?: AxisId
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
	animationInterpolateFn?: AnimationInterpolateFn<RadialBarDataItem, PolarLayout>
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
	animationMatchBy?: AnimationMatchByProp<RadialBarDataItem>
	/**
	 * Renders a background for each bar. Options:
	 *  - `false`: no background;
	 *  - `true`: renders default background;
	 *  - `object`: the props of background rectangle;
	 *  - `Element`: a custom background element;
	 *  - `function`: a render function of custom background.
	 *
	 * @defaultValue false
	 */
	background?: RadialBarBackground
	/**
	 * The width or height of each bar. If the barSize is not specified,
	 * the size of the bar will be calculated by the barCategoryGap, barGap and the quantity of bar groups.
	 */
	barSize?: number
	className?: string
	/**
	 * @defaultValue false
	 */
	cornerIsExternal?: boolean
	/**
	 * @defaultValue 0
	 */
	cornerRadius?: string | number
	/**
	 * Calculated radial bar sectors
	 */
	sectors: ReadonlyArray<RadialBarDataItem>
	/**
	 * @defaultValue false
	 */
	forceCornerRadius?: boolean
	/**
	 * @defaultValue false
	 */
	hide?: boolean
	/**
	 * If set false, animation of radial bars will be disabled.
	 * If set "auto", animation is disabled during SSR and when the user prefers reduced motion.
	 * @defaultValue auto
	 */
	isAnimationActive?: boolean | "auto"
	/**
	 * Renders one label for each data point. Options:
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
	maxBarSize?: number
	/**
	 * @defaultValue 0
	 */
	minPointSize?: number
	/**
	 * The customized event handler of animation end
	 */
	onAnimationEnd?: () => void
	/**
	 * The customized event handler of animation start
	 */
	onAnimationStart?: () => void
	/**
	 * The customized event handler of click in this chart.
	 */
	onClick?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mousedown in this chart.
	 */
	onMouseDown?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseup in this chart.
	 */
	onMouseUp?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mousemove in this chart.
	 */
	onMouseMove?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseover in this chart.
	 */
	onMouseOver?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseout in this chart.
	 */
	onMouseOut?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseenter in this chart.
	 */
	onMouseEnter?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseleave in this chart.
	 */
	onMouseLeave?: (data: RadialBarDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	onTouchStart?: (data: RadialBarDataItem, index: number, e: TouchEvent & { currentTarget: SVGGraphicsElement }) => void
	onTouchMove?: (data: RadialBarDataItem, index: number, e: TouchEvent & { currentTarget: SVGGraphicsElement }) => void
	onTouchEnd?: (data: RadialBarDataItem, index: number, e: TouchEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * @defaultValue 0
	 */
	radiusAxisId?: AxisId
	/**
	 * The name of this graphical item, used in tooltip and legend.
	 */
	name?: string | number
	shape?: ActiveShape<RadialBarSectorProps, SVGPathElement>
	stackId?: string | number
	tooltipType?: TooltipType
	/**
	 * Formats the value displayed in the tooltip for this RadialBar.
	 * When set, takes precedence over the `formatter` prop on the Tooltip component.
	 */
	formatter?: Formatter
	/**
	 * @defaultValue 300
	 */
	zIndex?: number
}

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type RadialBarProps<DataPointType = any, DataValueType = any> = Omit<
	PresentationAttributesAdaptChildEvent<RadialBarDataItem, SVGElement>,
	"ref" | keyof InternalRadialBarProps
> &
	Omit<InternalRadialBarProps<DataPointType, DataValueType>, "sectors">

type InternalProps = WithIdRequired<PropsWithDefaults> & Pick<InternalRadialBarProps, "sectors">

function SetRadialBarPayloadLegend(props: RadialBarProps): JSX.Element {
	const ctx = useChartStore()
	const legendPayload = createMemo(() =>
		ctx ? selectRadialBarLegendPayload(ctx.store, props.legendType) : undefined,
	)
	return <SetPolarLegendPayload legendPayload={legendPayload() ?? []} />
}

function SetRadialBarTooltipEntrySettings(
	props: Pick<
		InternalProps,
		| "dataKey"
		| "sectors"
		| "stroke"
		| "stroke-width"
		| "name"
		| "hide"
		| "fill"
		| "tooltipType"
		| "formatter"
		| "id"
	>,
): JSX.Element {
	/* GOTCHA-005: object literal in component body runs once at setup. React's
	   upstream rebuilds it every render via PureComponent re-eval; here we must
	   memoize so `props.sectors` updates flow through to dataDefinedOnItem and
	   SetTooltipEntrySettings observes a new identity to refresh the store. */
	const tooltipEntrySettings = createMemo(
		(): TooltipPayloadConfiguration => ({
			dataDefinedOnItem: props.sectors,
			getPosition: noop,
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
				strokeWidth: props["stroke-width"],
				type: props.tooltipType,
				unit: "",
			},
		}),
	)
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

function RadialBarWithState(props: InternalProps): JSX.Element {
	const renderBackground = (sectors?: ReadonlyArray<RadialBarDataItem>): JSX.Element => {
		if (sectors == null) {
			return null
		}
		const backgroundSvgProps = svgPropertiesNoEventsFromUnknown(props.background)
		/* eslint-disable solid/prefer-for -- map() preserves per-entry reactivity; <For keyed={false}> snapshots entry at slot creation */
		return (
			<ZIndexLayer zIndex={getZIndexFromUnknown(props.background, DefaultZIndexes.barBackground)}>
				{sectors.map((entry, i) => {
					const { value: _value, background, ...rest } = entry

					if (!background) {
						return null
					}

					const bgProps: RadialBarSectorProps = {
						cornerRadius: parseCornerRadius(props.cornerRadius),
						...rest,
						fill: "#eee",
						...background,
						...backgroundSvgProps,
						...adaptEventsOfChild(props, entry, i),
						index: i,
						className: clsx(
							"recharts-radial-bar-background-sector",
							String(backgroundSvgProps?.className),
						),
						option: background,
						isActive: false,
					} as RadialBarSectorProps

					return <RadialBarSector {...bgProps} />
				})}
			</ZIndexLayer>
		)
		/* eslint-enable solid/prefer-for */
	}

	return (
		<Show when={!props.hide}>
			<ZIndexLayer zIndex={props.zIndex}>
				<Layer class={clsx("recharts-area", props.className)}>
					<Show when={props.background}>
						<Layer class="recharts-radial-bar-background">{renderBackground(props.sectors)}</Layer>
					</Show>
					<Layer class="recharts-radial-bar-sectors">
						<RenderSectors {...props} />
					</Layer>
				</Layer>
			</ZIndexLayer>
		</Show>
	)
}

function RadialBarImpl(props: WithIdRequired<PropsWithDefaults> & { cellsRegistry: CellsRegistry }): JSX.Element {
	const cells = createMemo((): ReadonlyArray<Record<string, unknown>> | undefined => {
		const list = props.cellsRegistry.cells()
		return list.length === 0 ? undefined : (list as unknown as ReadonlyArray<Record<string, unknown>>)
	})
	const ctx = useChartStore()
	const stateCtx = useContext(RechartsStateContext)

	const radialBarSettings = createMemo(
		(): RadialBarSettings => ({
			angleAxisId: props.angleAxisId,
			barSize: props.barSize,
			data: undefined,
			dataKey: props.dataKey,
			hide: false,
			id: props.id,
			maxBarSize: props.maxBarSize,
			minPointSize: props.minPointSize,
			radiusAxisId: props.radiusAxisId,
			stackId: getNormalizedStackId(props.stackId),
			type: "radialBar",
		}),
	)
	const sectors = createMemo(
		(): ReadonlyArray<RadialBarDataItem> => {
			/* Read angle/radius/item from Solid chartState so mutations invalidate this
			   memo. Pass as overrides so selector recomputes scale from override domain. */
			const angleId = String(props.angleAxisId ?? 0)
			const radiusId = String(props.radiusAxisId ?? 0)
			const solidState = stateCtx?.state
			const angleEntry = solidState?.polarAxes.angleAxis[angleId]
			/* perf: keep proxy reference rather than spreading — spread allocates a new
			   object every memo run and forces every field subscription at once.
			   Explicit void-reads subscribe only to the mutable fields we care about. */
			const solidAngle = angleEntry?.settings as AngleAxisSettings | undefined
			void solidAngle?.domain
			void solidAngle?.type
			void solidAngle?.scale
			const radiusEntry = solidState?.polarAxes.radiusAxis[radiusId]
			const solidRadius = radiusEntry?.settings as RadiusAxisSettings | undefined
			void solidRadius?.domain
			void solidRadius?.type
			void solidRadius?.scale
			const solidItem = solidState?.graphicalItems[props.id]
			/* Read maxBarSize from item settings to track graphicalItems mutations. */
			const itemMaxBarSize = solidItem?.type === "radialBar"
				? (solidItem.settings as RadialBarSettings).maxBarSize
				: undefined
			void itemMaxBarSize

			if (!ctx) {
				return STABLE_EMPTY_ARRAY
			}
			const settings = itemMaxBarSize !== undefined
				? { ...radialBarSettings(), maxBarSize: itemMaxBarSize }
				: radialBarSettings()
			const result = selectRadialBarSectors(
				ctx.store,
				props.radiusAxisId,
				props.angleAxisId,
				settings,
				cells(),
				solidRadius,
				solidAngle,
			) ?? STABLE_EMPTY_ARRAY
			return result
		},
	)
	/* mergeProps preserves the getter so RadialBarWithState reads sectors reactively
	   on every re-render — static sectors={sectors()} would snapshot at setup. */
	const radialBarWithStateProps = mergeProps(props, { get sectors() { return sectors() } })
	return (
		<>
			<SetRadialBarTooltipEntrySettings
				dataKey={props.dataKey}
				sectors={sectors()}
				stroke={props.stroke}
				stroke-width={props["stroke-width"]}
				name={props.name}
				hide={props.hide}
				fill={props.fill}
				tooltipType={props.tooltipType}
				formatter={props.formatter}
				id={props.id}
			/>
			<RadialBarWithState {...radialBarWithStateProps} />
		</>
	)
}

export const defaultRadialBarProps = {
	angleAxisId: 0,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	animationInterpolateFn: defaultRadialBarAnimateItems,
	animationMatchBy: matchAppend,
	background: false,
	cornerIsExternal: false,
	cornerRadius: 0,
	forceCornerRadius: false,
	hide: false,
	isAnimationActive: "auto",
	label: false,
	legendType: "rect",
	minPointSize: 0,
	radiusAxisId: 0,
	zIndex: DefaultZIndexes.bar,
} as const satisfies Partial<RadialBarProps>

type PropsWithDefaults = RequiresDefaultProps<RadialBarProps, typeof defaultRadialBarProps>

export function computeRadialBarDataItems({
	displayedData,
	stackedData,
	dataStartIndex,
	stackedDomain,
	dataKey,
	baseValue,
	layout,
	radiusAxis,
	radiusAxisTicks,
	bandSize,
	pos,
	angleAxis,
	minPointSize,
	cx,
	cy,
	angleAxisTicks,
	cells,
	startAngle: rootStartAngle,
	endAngle: rootEndAngle,
}: {
	displayedData: ChartData
	stackedData:
		| Series<Record<string, unknown>, string | number | ((obj: unknown) => unknown)>
		| undefined
	dataStartIndex: number
	stackedDomain: ReadonlyArray<unknown> | null
	dataKey: DataKey<unknown> | undefined
	baseValue: number | unknown
	layout: LayoutType
	radiusAxis: BaseAxisWithScale
	radiusAxisTicks: ReadonlyArray<TickItem> | undefined
	bandSize: number
	pos: BarPositionPosition
	angleAxis: BaseAxisWithScale
	minPointSize: number
	cx: number
	cy: number
	angleAxisTicks: ReadonlyArray<TickItem> | undefined
	cells: ReadonlyArray<JSX.Element> | undefined
	startAngle: number
	endAngle: number
}): ReadonlyArray<RadialBarDataItem> {
	if (angleAxisTicks == null || radiusAxisTicks == null) {
		return STABLE_EMPTY_ARRAY
	}

	return (displayedData ?? []).map((entry: unknown, index: number) => {
		let value: unknown
		let innerRadius: number | null | undefined
		let outerRadius: number | undefined
		let startAngle: number | null
		let endAngle: number = 0
		let backgroundSector: Record<string, unknown> | undefined

		if (stackedData) {
			const stackEntry = stackedData[dataStartIndex + index]
			if (stackEntry != null) {
				value = truncateByDomain(stackEntry, stackedDomain as number[])
			}
		} else {
			value = getValueByDataKey(entry, dataKey)
			if (!Array.isArray(value)) {
				value = [baseValue, value]
			}
		}

		if (layout === "radial") {
			startAngle = angleAxis.scale.map((value as number[])[0]) ?? rootStartAngle
			endAngle = angleAxis.scale.map((value as number[])[1]) ?? rootEndAngle
			innerRadius = getCateCoordinateOfBar({
				axis: radiusAxis,
				bandSize,
				entry,
				index,
				offset: pos.offset,
				ticks: radiusAxisTicks,
			})
			if (innerRadius != null && endAngle != null && startAngle != null) {
				outerRadius = innerRadius + pos.size
				const deltaAngle = endAngle - startAngle

				if (Math.abs(minPointSize) > 0 && Math.abs(deltaAngle) < Math.abs(minPointSize)) {
					const delta =
						mathSign(deltaAngle || minPointSize) * (Math.abs(minPointSize) - Math.abs(deltaAngle))

					endAngle += delta
				}
				backgroundSector = {
					background: {
						cx,
						cy,
						endAngle: rootEndAngle,
						innerRadius,
						outerRadius,
						startAngle: rootStartAngle,
					},
				}
			}
		} else {
			innerRadius = radiusAxis.scale.map((value as number[])[0])
			outerRadius = radiusAxis.scale.map((value as number[])[1])
			startAngle = getCateCoordinateOfBar({
				axis: angleAxis,
				bandSize,
				entry,
				index,
				offset: pos.offset,
				ticks: angleAxisTicks,
			})
			if (innerRadius != null && outerRadius != null && startAngle != null) {
				endAngle = startAngle + pos.size
				const deltaRadius = outerRadius - innerRadius

				if (Math.abs(minPointSize) > 0 && Math.abs(deltaRadius) < Math.abs(minPointSize)) {
					const delta =
						mathSign(deltaRadius || minPointSize) * (Math.abs(minPointSize) - Math.abs(deltaRadius))
					outerRadius += delta
				}
			}
		}

		return Object.assign(
			{},
			entry as Record<string, unknown>,
			backgroundSector,
			{
				cx,
				cy,
				endAngle,
				innerRadius,
				outerRadius,
				payload: entry,
				startAngle,
				value: stackedData ? value : (value as number[])[1],
			},
			cells && cells[index] && (cells[index] as unknown as { props: Record<string, unknown> }).props,
		) as RadialBarDataItem
	})
}

/**
 * @consumes PolarChartContext
 * @provides LabelListContext
 * @provides CellReader
 */
function RadialBarFn(outsideProps: RadialBarProps): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps. The spread enumerates
	   the props proxy and reads `children` eagerly, instantiating user JSX before
	   RegisterGraphicalItemId installs its Provider. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props: PropsWithDefaults = resolveDefaultProps(restProps, defaultRadialBarProps)
	return (
		<RegisterGraphicalItemId id={props.id} type="radialBar">
			{(id: string) => (
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
									<>
										<SetPolarGraphicalItem
											type="radialBar"
											id={id}
											data={undefined}
											dataKey={props.dataKey}
											hide={props.hide ?? defaultRadialBarProps.hide}
											angleAxisId={props.angleAxisId ?? defaultRadialBarProps.angleAxisId}
											radiusAxisId={props.radiusAxisId ?? defaultRadialBarProps.radiusAxisId}
											stackId={getNormalizedStackId(props.stackId)}
											barSize={props.barSize}
											minPointSize={props.minPointSize}
											maxBarSize={props.maxBarSize}
										/>
										<SetRadialBarPayloadLegend {...props} />
										<RadialBarImpl {...props} id={id} cellsRegistry={cellsRegistry}>
											{memoizedChildren()}
										</RadialBarImpl>
									</>
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
export const RadialBar = RadialBarFn as (<DataPointType = any, DataValueType = any>(
	props: RadialBarProps<DataPointType, DataValueType>,
) => JSX.Element) & { displayName?: string }
