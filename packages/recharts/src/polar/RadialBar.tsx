/* eslint-disable import/no-cycle, sort-keys */
import type { JSX } from "solid-js"
import { createEffect, createMemo, createSignal, mergeProps, Show, splitProps, useContext } from "solid-js"
import { clsx } from "clsx"

import { Series } from "victory-vendor/d3-shape"
import { parseCornerRadius, RadialBarSector, RadialBarSectorProps } from "../util/RadialBarUtils"
import { Props as SectorProps } from "../shape/Sector"
import { Layer } from "../container/Layer"
import {
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
import { useAnimationId } from "../util/useAnimationId"
import { AxisId } from "../state/cartesianAxisSlice"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { RadialBarSettings } from "../state/types/RadialBarSettings"
import { SetPolarGraphicalItem } from "../state/SetGraphicalItem"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
} from "../util/svgPropertiesNoEvents"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import { RequiresDefaultProps, resolveDefaultProps } from "../util/resolveDefaultProps"
import { WithIdRequired } from "../util/useUniqueId"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { getZIndexFromUnknown } from "../zIndex/getZIndexFromUnknown"

const STABLE_EMPTY_ARRAY: readonly RadialBarDataItem[] = []

export type RadialBarDataItem = SectorProps &
	PolarViewBoxRequired &
	TooltipTriggerInfo & {
		value?: unknown
		payload?: unknown
		background?: SectorProps
	}

type RadialBarBackground = boolean | (ActiveShape<SectorProps> & ZIndexable)

type RadialBarSectorsProps = {
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
	/* eslint-disable-next-line solid/reactivity -- allOtherRadialBarProps destructure at setup; shape/id are stable structural props */
	const { shape, activeShape, cornerRadius, id, ...others } = props.allOtherRadialBarProps
	const baseProps = svgPropertiesNoEvents(others)
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
		/* eslint-disable-next-line solid/reactivity -- dataKey/id are stable identifiers; passed once to dispatch hooks */
		props.allOtherRadialBarProps.dataKey,
		id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() => props.allOtherRadialBarProps.onMouseLeave,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() => props.allOtherRadialBarProps.onClick,
		/* eslint-disable-next-line solid/reactivity -- dataKey/id are stable identifiers; passed once to dispatch hooks */
		props.allOtherRadialBarProps.dataKey,
		id,
	)

	/* eslint-disable-next-line solid/reactivity -- sectors null-guard at setup; null → sectors become available on first store update which triggers parent re-render */
	if (props.sectors == null) {
		return null
	}

	/* eslint-disable solid/prefer-for -- map() is required here; <Index> loses reactivity for activeShape changes since entry is snapshotted per slot */
	return (
		<RadialBarLabelListProvider showLabels={props.showLabels} sectors={props.sectors}>
			{props.sectors.map((entry: RadialBarDataItem, i: number) => {
				const isActive: boolean = Boolean(activeShape && activeIndex() === String(i))
				const onMouseEnter = onMouseEnterFromContext(entry, i)
				const onMouseLeave = onMouseLeaveFromContext(entry, i)
				const onClick = onClickFromContext(entry, i)

				/* GOTCHA-016-C: bind both enter/leave AND over/out, dedupe per-instance so user.hover (fires both) only dispatches once. */
				let entered = false
				const fireEnter = (e: MouseEvent) => {
					if (entered) return
					entered = true
					onMouseEnter(e as MouseEvent & { currentTarget: SVGElement })
				}
				const fireLeave = (e: MouseEvent) => {
					if (!entered) return
					entered = false
					onMouseLeave(e as MouseEvent & { currentTarget: SVGElement })
				}
				const radialBarSectorProps: RadialBarSectorProps = {
					...baseProps,
					cornerRadius: parseCornerRadius(cornerRadius),
					...entry,
					...adaptEventsOfChild(restOfAllOtherProps(), entry, i),
					onMouseEnter: fireEnter,
					onMouseOver: fireEnter,
					onMouseLeave: fireLeave,
					onMouseOut: fireLeave,
					onClick: (e: MouseEvent) => onClick(e as MouseEvent & { currentTarget: SVGElement }),
					className: `recharts-radial-bar-sector ${(entry as { className?: string }).className ?? ""}`.trim(),
					forceCornerRadius: others.forceCornerRadius,
					cornerIsExternal: others.cornerIsExternal,
					isActive,
					option: isActive ? activeShape : shape,
					index: i,
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
			{props.allOtherRadialBarProps.children}
		</RadialBarLabelListProvider>
	)
	/* eslint-enable solid/prefer-for */
}

function SectorsWithAnimation(props: {
	radialBarProps: InternalProps
	previousSectorsRef: { current: ReadonlyArray<RadialBarDataItem> | null }
}): JSX.Element {
	const animationId = useAnimationId(() => props.radialBarProps, "recharts-radialbar-")

	/* GOTCHA-014-G: keyed snapshot at animationId flip. */
	const animationContext = createMemo(() => {
		animationId()
		return { prevSectors: props.previousSectorsRef.current }
	})

	const [isAnimating, setIsAnimating] = createSignal(false)

	const handleAnimationEnd = () => {
		if (typeof props.radialBarProps.onAnimationEnd === "function") {
			props.radialBarProps.onAnimationEnd()
		}
		setIsAnimating(false)
	}

	const handleAnimationStart = () => {
		if (typeof props.radialBarProps.onAnimationStart === "function") {
			props.radialBarProps.onAnimationStart()
		}
		setIsAnimating(true)
	}

	return (
		<JavascriptAnimate
			animationId={animationId()}
			begin={props.radialBarProps.animationBegin}
			duration={props.radialBarProps.animationDuration}
			isActive={props.radialBarProps.isAnimationActive}
			easing={props.radialBarProps.animationEasing}
			onAnimationStart={handleAnimationStart}
			onAnimationEnd={handleAnimationEnd}
		>
			{(t: () => number) => {
				/* GOTCHA-014: thunk children — prev via effect. */
				const stepData = createMemo<ReadonlyArray<RadialBarDataItem> | undefined>(() => {
					const ctx = animationContext()
					const prevData = ctx.prevSectors
					const tValue = t()
					return tValue === 1
						? props.radialBarProps.sectors
						: (props.radialBarProps.sectors ?? STABLE_EMPTY_ARRAY).map(
								(entry: RadialBarDataItem, index: number): RadialBarDataItem => {
									const prev = prevData && prevData[index]
									if (prev) {
										return Object.assign({}, entry, {
											endAngle: interpolate(prev.endAngle, entry.endAngle, tValue),
											startAngle: interpolate(prev.startAngle, entry.startAngle, tValue),
										})
									}
									const { endAngle, startAngle } = entry
									return Object.assign({}, entry, {
										endAngle: interpolate(startAngle, endAngle, tValue),
									})
								},
							)
				})
				createEffect(() => {
					if (t() > 0) {
						props.previousSectorsRef.current = stepData() ?? null
					}
				})

				return (
					<RadialBarSectorsComponent
						sectors={stepData() ?? STABLE_EMPTY_ARRAY}
						allOtherRadialBarProps={props.radialBarProps}
						showLabels={!isAnimating()}
					/>
				)
			}}
		</JavascriptAnimate>
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
	 * If set "auto", the animation will be disabled in SSR and enabled in browser.
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
	onClick?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mousedown in this chart.
	 */
	onMouseDown?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseup in this chart.
	 */
	onMouseUp?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mousemove in this chart.
	 */
	onMouseMove?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseover in this chart.
	 */
	onMouseOver?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseout in this chart.
	 */
	onMouseOut?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseenter in this chart.
	 */
	onMouseEnter?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave in this chart.
	 */
	onMouseLeave?: (data: RadialBarDataItem, index: number, e: MouseEvent) => void
	onTouchStart?: (data: RadialBarDataItem, index: number, e: TouchEvent) => void
	onTouchMove?: (data: RadialBarDataItem, index: number, e: TouchEvent) => void
	onTouchEnd?: (data: RadialBarDataItem, index: number, e: TouchEvent) => void
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
	 * @defaultValue 300
	 */
	zIndex?: number
}

export type RadialBarProps = Omit<
	PresentationAttributesAdaptChildEvent<RadialBarDataItem, SVGElement>,
	"ref" | keyof InternalRadialBarProps
> &
	Omit<InternalRadialBarProps, "sectors">

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
	/* eslint-disable-next-line solid/reactivity -- hide is a stable boolean prop set once at mount */
	if (props.hide) {
		return null
	}

	const renderBackground = (sectors?: ReadonlyArray<RadialBarDataItem>): JSX.Element => {
		if (sectors == null) {
			return null
		}
		const backgroundSvgProps = svgPropertiesNoEventsFromUnknown(props.background)
		/* eslint-disable solid/prefer-for -- map() preserves per-entry reactivity; <Index> snapshots entry at slot creation */
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

	/* eslint-disable-next-line solid/reactivity -- className rarely changes; clsx result used in Layer class prop */
	const layerClass = clsx("recharts-area", props.className)

	return (
		<ZIndexLayer zIndex={props.zIndex}>
			<Layer class={layerClass}>
				<Show when={props.background}>
					<Layer class="recharts-radial-bar-background">{renderBackground(props.sectors)}</Layer>
				</Show>
				<Layer class="recharts-radial-bar-sectors">
					<RenderSectors {...props} />
				</Layer>
			</Layer>
		</ZIndexLayer>
	)
}

function RadialBarImpl(props: WithIdRequired<PropsWithDefaults>): JSX.Element {
	/* Solid does not support React.Children iteration; cells passed as undefined */
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
				undefined,
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
export function RadialBar(outsideProps: RadialBarProps): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps. The spread enumerates
	   the props proxy and reads `children` eagerly, instantiating user JSX before
	   RegisterGraphicalItemId installs its Provider. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props: PropsWithDefaults = resolveDefaultProps(restProps, defaultRadialBarProps)
	return (
		<RegisterGraphicalItemId id={props.id} type="radialBar">
			{(id: string) => {
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
						<RadialBarImpl {...props} id={id}>
							{memoizedChildren()}
						</RadialBarImpl>
					</>
				)
			}}
		</RegisterGraphicalItemId>
	)
}
