/* eslint-disable import/no-cycle, sort-keys */
import type { JSX } from "solid-js"
import { createEffect, createMemo, createSignal, For, mergeProps, Show, splitProps, useContext } from "solid-js"
import get from "es-toolkit/compat/get"

import { clsx } from "clsx"
import { selectPieLegend, selectPieSectors } from "../state/selectors/pieSelectors"
import { useChartStore } from "../state/RechartsStoreContext"
import { CellsContextProvider, createCellsRegistry } from "../context/CellsContext"
import { Layer } from "../container/Layer"
import { Curve, Props as CurveProps } from "../shape/Curve"
import { Text } from "../component/Text"
import { getMaxRadius, polarToCartesian } from "../util/PolarUtils"
import { getPercentValue, interpolate, isNumber, mathSign } from "../util/DataUtils"
import { getTooltipNameProp, getValueByDataKey } from "../util/ChartUtils"
import {
	ActiveShape,
	adaptEventsOfChild,
	AnimationDuration,
	AnimationTiming,
	ChartOffsetInternal,
	Coordinate,
	DataConsumer,
	DataKey,
	DataProvider,
	GeometrySector,
	LegendType,
	PresentationAttributesAdaptChildEvent,
	TooltipType,
} from "../util/types"
import { Shape } from "../util/ActiveShapeUtils"
import {
	TooltipTriggerInfo,
	useMouseClickItemDispatch,
	useMouseEnterItemDispatch,
	useMouseLeaveItemDispatch,
} from "../context/tooltipContext"
import { TooltipPayload, TooltipPayloadConfiguration } from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import {
	selectActiveTooltipDataKey,
	selectActiveTooltipGraphicalItemId,
	selectActiveTooltipIndex,
} from "../state/selectors/tooltipSelectors"
import { SetPolarLegendPayload } from "../state/SetLegendPayload"
import {
	DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME,
	DATA_ITEM_INDEX_ATTRIBUTE_NAME,
} from "../util/Constants"
import { useAnimationId } from "../util/useAnimationId"
import { RequiresDefaultProps, resolveDefaultProps } from "../util/resolveDefaultProps"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { SetPolarGraphicalItem } from "../state/SetGraphicalItem"
import { RechartsStateContext } from "../state/_solid/RechartsStateContext"
import { PiePresentationProps, PieSettings } from "../state/types/PieSettings"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
	SVGPropsNoEvents,
} from "../util/svgPropertiesNoEvents"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import {
	LabelListFromLabelProp,
	PolarLabelListContextProvider,
	PolarLabelListEntry,
	Props as LabelListProps,
} from "../component/LabelList"
import { GraphicalItemId } from "../state/graphicalItemsSlice"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { ChartData } from "../state/chartDataSlice"
import { getClassNameFromUnknown } from "../util/getClassNameFromUnknown"
import { cloneJsxNodeWithProps, isJsxNode } from "../util/ReactUtils"

interface PieDef {
	/**
	 * The x-coordinate of center. If set a percentage, the final value is obtained by multiplying the percentage of container width.
	 */
	cx?: number | string
	/**
	 * The y-coordinate of center. If set a percentage, the final value is obtained by multiplying the percentage of container height.
	 */
	cy?: number | string
	/**
	 * Angle in degrees from which the chart should start.
	 */
	startAngle?: number
	/**
	 * Angle, in degrees, at which the chart should end.
	 */
	endAngle?: number
	/**
	 * The angle between two sectors.
	 *
	 * @example <Pie paddingAngle={5} />
	 * @example https://recharts.github.io/examples/PieChartWithPaddingAngle
	 */
	paddingAngle?: number
	/**
	 * The inner radius of the sectors.
	 * If set a percentage, the final value is obtained by multiplying the percentage of maxRadius which is calculated by the width, height, cx, cy.
	 */
	innerRadius?: number | string
	/**
	 * The outer radius of the sectors.
	 * If set a percentage, the final value is obtained by multiplying the percentage of maxRadius which is calculated by the width, height, cx, cy.
	 * Function should return a string percentage or number.
	 */
	outerRadius?: number | string | ((dataPoint: unknown) => number | string)
	cornerRadius?: number | string
}

type PieLabelLine =
	| ((props: Record<string, unknown>) => JSX.Element)
	| JSX.PathSVGAttributes<SVGPathElement>
	| boolean

interface PieLabelExtraProps {
	stroke: string
	index: number
	textAnchor: string
}

export type PieLabelRenderProps = Omit<SVGPropsNoEvents<PieSvgAttributes>, "offset"> &
	Omit<PieSectorDataItem, "offset"> &
	PieLabelExtraProps &
	Coordinate

export type LabelListPropsWithPosition = LabelListProps & { position: LabelListProps["position"] }

/**
 * The `label` prop in Pie accepts a variety of alternatives.
 */
export type PieLabel =
	| boolean
	| LabelListPropsWithPosition
	| Partial<PieLabelRenderProps>
	| ((props: PieLabelRenderProps) => JSX.Element)

export type PieSectorData = GeometrySector &
	TooltipTriggerInfo & {
		dataKey?: DataKey<unknown>
		midAngle?: number
		middleRadius?: number
		name?: string | number
		paddingAngle?: number
		payload?: unknown
		percent?: number
		value: number
	}

/**
 * We spread the data object into the sector data item,
 * so we can't really know what is going to be inside.
 *
 * This type represents our best effort, but it all depends on the input data
 * and what is inside of it.
 *
 * https://github.com/recharts/recharts/issues/6380
 * https://github.com/recharts/recharts/discussions/6375
 */
export type PieSectorDataItem = PiePresentationProps &
	PieCoordinate &
	PieSectorData & {
		cornerRadius: number | undefined
	}

export type PieSectorShapeProps = PieSectorDataItem & { isActive: boolean; index: number }
export type PieShape = JSX.Element | ((props: PieSectorShapeProps, index: number) => JSX.Element)

interface PieEvents {
	/**
	 * The customized event handler of click on the sectors in this group.
	 */
	onClick?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mousedown on the sectors in this group.
	 */
	onMouseDown?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseup on the sectors in this group.
	 */
	onMouseUp?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mousemove on the sectors in this group.
	 */
	onMouseMove?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseover on the sectors in this group.
	 */
	onMouseOver?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseout on the sectors in this group.
	 */
	onMouseOut?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseenter on the sectors in this group.
	 */
	onMouseEnter?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave on the sectors in this group.
	 */
	onMouseLeave?: (data: PieSectorDataItem, index: number, e: MouseEvent) => void
	onTouchStart?: (data: PieSectorDataItem, index: number, e: TouchEvent) => void
	onTouchMove?: (data: PieSectorDataItem, index: number, e: TouchEvent) => void
	onTouchEnd?: (data: PieSectorDataItem, index: number, e: TouchEvent) => void
}

/**
 * Internal props, combination of external props + defaultProps + private Recharts state
 */
interface InternalPieProps<DataPointType = unknown>
	extends DataProvider<DataPointType>, PieDef, ZIndexable, PieEvents {
	id: GraphicalItemId
	className?: string
	name?: string | number
	dataKey: DataKey<DataPointType, unknown>
	nameKey?: DataKey<DataPointType, string>
	/** The minimum angle for no-zero element */
	minAngle?: number
	legendType?: LegendType
	tooltipType?: TooltipType
	/** the max radius of pie */
	maxRadius?: number
	hide?: boolean
	sectors: ReadonlyArray<PieSectorDataItem>
	/** @deprecated */
	activeShape?: ActiveShape<PieSectorDataItem>
	/** @deprecated */
	inactiveShape?: ActiveShape<PieSectorDataItem>
	shape?: PieShape
	labelLine?: PieLabelLine
	label?: PieLabel
	animationEasing?: AnimationTiming
	isAnimationActive?: boolean | "auto"
	animationBegin?: number
	animationDuration?: AnimationDuration
	onAnimationStart?: () => void
	onAnimationEnd?: () => void
	rootTabIndex?: number
}

interface PieProps<DataPointType = unknown, DataValueType = unknown>
	extends
		DataProvider<DataPointType>,
		DataConsumer<DataPointType, DataValueType>,
		PieDef,
		PieEvents,
		ZIndexable {
	/**
	 * This component is rendered when this graphical item is activated
	 * (could be by mouse hover, touch, keyboard, programmatically).
	 *
	 * @deprecated Use the `shape` prop to create each sector. `isActive` designates the "active" shape.
	 * @example <Pie activeShape={<CustomActiveShape />} />
	 * @example https://recharts.github.io/examples/CustomActiveShapePieChart
	 */
	activeShape?: ActiveShape<PieSectorDataItem>
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
	id?: string
	/**
	 * The shape of inactive sector.
	 * @deprecated Use the `shape` prop to modify each sector.
	 */
	inactiveShape?: ActiveShape<PieSectorDataItem>
	/**
	 * If set false, animation will be disabled.
	 * If set "auto", the animation will be disabled in SSR and enabled in browser.
	 * @defaultValue auto
	 */
	isAnimationActive?: boolean | "auto"
	/**
	 * Renders one label for each pie sector. Options:
	 * - `true`: renders default labels;
	 * - `false`: no labels are rendered;
	 * - `object` that has `position` prop: the props of LabelList component;
	 * - `object` that does not have `position` prop: the props of a custom Pie label (similar to Label with position "outside"); this variant supports `labelLine`
	 * - `Element`: a custom label element;
	 * - `function`: a render function of custom label.
	 *
	 * Also see the `labelLine` prop that draws a line connecting each label to the corresponding sector.
	 *
	 * @defaultValue false
	 * @example <Pie label={<CustomizedLabel />} />
	 * @example https://recharts.github.io/examples/PieChartWithCustomizedLabel
	 */
	label?: PieLabel
	/**
	 * If false set, label lines will not be drawn. If true set, label lines will be drawn which have the props calculated internally.
	 * If object set, label lines will be drawn which have the props merged by the internal calculated props and the option.
	 * If set a function, the function will be called to render customized label line.
	 * @defaultValue true
	 * @example <Pie labelLine={<CustomizedLabelLine />} />
	 * @example https://recharts.github.io/examples/PieChartWithCustomizedLabel
	 */
	labelLine?: PieLabelLine
	/**
	 * The type of icon in legend. If set to 'none', no legend item will be rendered.
	 * @defaultValue rect
	 */
	legendType?: LegendType
	/** the max radius of pie */
	maxRadius?: number
	/**
	 * The minimum angle of each unzero data.
	 * @defaultValue 0
	 */
	minAngle?: number
	/**
	 * The name of this graphical item, used in tooltip and legend.
	 */
	name?: string | number
	/**
	 * Name represents each sector in the tooltip, and legend.
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
	 * The customized event handler of animation end.
	 */
	onAnimationEnd?: () => void
	/**
	 * The customized event handler of animation start.
	 */
	onAnimationStart?: () => void
	/**
	 * The tabindex of wrapper surrounding the cells.
	 * @defaultValue 0
	 */
	rootTabIndex?: number
	/**
	 * The custom shape of a Pie Sector.
	 * Can also be used to render active sector by checking isActive.
	 * If undefined, renders Sector shape.
	 */
	shape?: PieShape
	tooltipType?: TooltipType
	/**
	 * @defaultValue 100
	 */
	zIndex?: number
}

type PieSvgAttributes = Omit<
	PresentationAttributesAdaptChildEvent<unknown, SVGElement>,
	"ref" | keyof PieEvents
>

type InternalProps = PieSvgAttributes & InternalPieProps

export type Props = PieSvgAttributes & PieProps

type RealPieData = Record<string, unknown>

export type PieCoordinate = {
	cx: number
	cy: number
	innerRadius: number
	outerRadius: number
	maxRadius: number
}

function SetPiePayloadLegend(props: { children?: JSX.Element; id: GraphicalItemId }): JSX.Element {
	const ctx = useChartStore()
	/* Solid does not support React.Children iteration; cells passed as undefined */
	const legendPayload = createMemo(() =>
		ctx ? selectPieLegend(ctx.store, props.id, undefined) : undefined,
	)
	return (
		<Show when={legendPayload()}>
			{(payload) => <SetPolarLegendPayload legendPayload={payload()} />}
		</Show>
	)
}

type PieSectorsProps = {
	sectors: Readonly<PieSectorDataItem[]>
	/**
	 * @deprecated
	 */
	activeShape: ActiveShape<Readonly<PieSectorDataItem>> | undefined
	/**
	 * @deprecated
	 */
	inactiveShape: ActiveShape<Readonly<PieSectorDataItem>> | undefined
	shape: PieShape
	allOtherPieProps: WithoutId<InternalProps>
	id: GraphicalItemId
}

function SetPieTooltipEntrySettings(
	props: Pick<
		InternalProps,
		| "dataKey"
		| "nameKey"
		| "sectors"
		| "stroke"
		| "strokeWidth"
		| "fill"
		| "name"
		| "hide"
		| "tooltipType"
		| "id"
	>,
): JSX.Element {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.sectors.map((p: PieSectorDataItem) => p.tooltipPayload),
		getPosition: (index) => props.sectors[Number(index)]?.tooltipPosition,
		settings: {
			color: props.fill,
			dataKey: props.dataKey,
			fill: props.fill,
			graphicalItemId: props.id,
			hide: props.hide,
			name: getTooltipNameProp(props.name, props.dataKey),
			nameKey: props.nameKey,
			stroke: props.stroke,
			strokeWidth: props.strokeWidth,
			type: props.tooltipType,
			unit: "",
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

const getTextAnchor = (x: number, cx: number) => {
	if (x > cx) {
		return "start"
	}
	if (x < cx) {
		return "end"
	}

	return "middle"
}

const getOuterRadius = (
	dataPoint: unknown,
	outerRadius: number | string | ((element: unknown) => number | string),
	maxPieRadius: number,
) => {
	if (typeof outerRadius === "function") {
		return getPercentValue(outerRadius(dataPoint), maxPieRadius, maxPieRadius * 0.8)
	}
	return getPercentValue(outerRadius, maxPieRadius, maxPieRadius * 0.8)
}

const parseCoordinateOfPie = (
	pieSettings: PieSettings,
	offset: ChartOffsetInternal,
	dataPoint: unknown,
): PieCoordinate => {
	const { top, left, width, height } = offset
	const maxPieRadius = getMaxRadius(width, height)
	const cx = left + getPercentValue(pieSettings.cx, width, width / 2)
	const cy = top + getPercentValue(pieSettings.cy, height, height / 2)
	const innerRadius = getPercentValue(pieSettings.innerRadius, maxPieRadius, 0)

	const outerRadius = getOuterRadius(dataPoint, pieSettings.outerRadius, maxPieRadius)

	const maxRadius = pieSettings.maxRadius || Math.sqrt(width * width + height * height) / 2

	return { cx, cy, innerRadius, maxRadius, outerRadius }
}

const parseDeltaAngle = (startAngle: number, endAngle: number) => {
	const sign = mathSign(endAngle - startAngle)
	const deltaAngle = Math.min(Math.abs(endAngle - startAngle), 360)

	return sign * deltaAngle
}

function renderLabelLineItem(option: PieLabelLine, lineProps: CurveProps): JSX.Element {
	if (typeof option === "function") {
		return option(lineProps as Record<string, unknown>)
	}

	if (isJsxNode(option)) {
		return <>{cloneJsxNodeWithProps(option, lineProps as unknown as Record<string, unknown>) as unknown as JSX.Element}</>
	}

	const className = clsx(
		"recharts-pie-label-line",
		typeof option !== "boolean"
			? String((option as unknown as Record<string, unknown>).className ?? "")
			: "",
	)
	return <Curve {...lineProps} type="linear" class={className} />
}

function renderLabelItem(
	option: PieLabel,
	labelProps: PieLabelRenderProps,
	value: unknown,
): JSX.Element {
	let label: unknown = value
	if (typeof option === "function") {
		label = option(labelProps)
		/* if the function returned a JSX element, use it directly */
		if (label != null && typeof label === "object") {
			return label as JSX.Element
		}
	}

	if (isJsxNode(option)) {
		return <>{cloneJsxNodeWithProps(option, labelProps as unknown as Record<string, unknown>) as unknown as JSX.Element}</>
	}

	const className = clsx("recharts-pie-label-text", getClassNameFromUnknown(option))
	const { style: labelStyle, ref: _labelRef, ...restLabelProps } = labelProps
	return (
		<Text
			{...restLabelProps}
			style={typeof labelStyle === "string" ? undefined : labelStyle}
			textAnchor={labelProps.textAnchor as import("../component/Text").TextAnchor}
			alignmentBaseline="middle"
			class={className}
		>
			{label as string | number}
		</Text>
	)
}

/* eslint-disable solid/reactivity -- PieLabels reads are structural checks + map at setup; called from reactive JSX so props are stable per render */
function PieLabels(props: {
	sectors: ReadonlyArray<PieSectorDataItem>
	pieProps: WithoutId<InternalProps>
	showLabels: boolean
}): JSX.Element {
	if (!props.showLabels || !props.pieProps.label || !props.sectors) {
		return null
	}
	const pieProps = svgPropertiesNoEvents(props.pieProps)
	const customLabelProps = svgPropertiesNoEventsFromUnknown(props.pieProps.label)
	const customLabelLineProps = svgPropertiesNoEventsFromUnknown(props.pieProps.labelLine)
	const offsetRadius =
		(typeof props.pieProps.label === "object" &&
			"offsetRadius" in props.pieProps.label &&
			typeof props.pieProps.label.offsetRadius === "number" &&
			props.pieProps.label.offsetRadius) ||
		20

	const labels = props.sectors.map((entry, i) => {
		const midAngle = (entry.startAngle + entry.endAngle) / 2
		const endPoint = polarToCartesian(
			entry.cx,
			entry.cy,
			entry.outerRadius + offsetRadius,
			midAngle,
		)
		const labelItemProps: PieLabelRenderProps = {
			...pieProps,
			...entry,
			stroke: "none",
			...customLabelProps,
			index: i,
			textAnchor: getTextAnchor(endPoint.x, entry.cx),
			...endPoint,
		} as PieLabelRenderProps
		const lineProps: CurveProps = {
			...pieProps,
			...entry,
			fill: "none",
			stroke: entry.fill,
			...customLabelLineProps,
			index: i,
			points: [polarToCartesian(entry.cx, entry.cy, entry.outerRadius, midAngle), endPoint],
		} as CurveProps

		return (
			<ZIndexLayer zIndex={DefaultZIndexes.label}>
				<Layer>
					<Show when={props.pieProps.labelLine}>
						{renderLabelLineItem(props.pieProps.labelLine as PieLabelLine, lineProps)}
					</Show>
					{renderLabelItem(
						props.pieProps.label as PieLabel,
						labelItemProps,
						getValueByDataKey(entry, props.pieProps.dataKey as DataKey<PieSectorDataItem>),
					)}
				</Layer>
			</ZIndexLayer>
		)
	})

	return <Layer class="recharts-pie-labels">{labels}</Layer>
}
/* eslint-enable solid/reactivity */

/* eslint-disable solid/reactivity -- PieLabelList reads are structural type checks at setup; called from reactive JSX, stable per render */
function PieLabelList(props: {
	sectors: ReadonlyArray<PieSectorDataItem>
	pieProps: WithoutId<InternalProps>
	showLabels: boolean
}): JSX.Element {
	if (
		typeof props.pieProps.label === "object" &&
		props.pieProps.label != null &&
		"position" in props.pieProps.label
	) {
		return <LabelListFromLabelProp label={props.pieProps.label} />
	}
	return (
		<PieLabels sectors={props.sectors} pieProps={props.pieProps} showLabels={props.showLabels} />
	)
}
/* eslint-enable solid/reactivity */

function PieSectors(props: PieSectorsProps): JSX.Element {
	const ctx = useChartStore()
	const activeIndex = createMemo(() =>
		ctx ? selectActiveTooltipIndex(ctx.store) : undefined,
	)
	const activeDataKey = createMemo(() =>
		ctx ? selectActiveTooltipDataKey(ctx.store) : undefined,
	)
	const activeGraphicalItemId = createMemo(() =>
		ctx ? selectActiveTooltipGraphicalItemId(ctx.store) : undefined,
	)

	/* eslint-disable solid/reactivity -- dataKey/id are stable identifiers captured once at setup; dispatch hooks take static config; sectors null check is structural */
	/* GOTCHA-005-D: pass live accessors — dot-access at hook setup snapshots the value. */
	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() => props.allOtherPieProps.onMouseEnter as never,
		props.allOtherPieProps.dataKey,
		props.id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() => props.allOtherPieProps.onMouseLeave as never,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() => props.allOtherPieProps.onClick as never,
		props.allOtherPieProps.dataKey,
		props.id,
	)
	const restOfAllOtherProps = (): Record<string, unknown> => {
		const { onMouseEnter, onClick, onMouseLeave, ...rest } =
			props.allOtherPieProps as unknown as Record<string, unknown>
		void onMouseEnter
		void onClick
		void onMouseLeave
		return rest
	}

	if (props.sectors == null || props.sectors.length === 0) {
		return null
	}
	/* eslint-enable solid/reactivity */

	return (
		<For each={props.sectors}>
			{(entry: PieSectorDataItem, iAccessor) => {
				/* eslint-disable-next-line solid/reactivity -- iAccessor() snapshotted intentionally; i is used as a static index, not a reactive signal, per GOTCHA-014-H */
				const i = iAccessor()
				/* GOTCHA-014-H: per-sector reactive snapshots live INSIDE For's child fn so
				   activeIndex/activeDataKey changes do NOT re-run the outer JSX expression
				   that holds the For. Solid's plain `arr.map` inside JSX wraps the whole
				   map in one memo — any reactive read in the body re-creates every DOM
				   node, dropping `$$click` event delegation bindings between the
				   pointermove/pointerdown of `userEvent.click`. */
				const isHidden = createMemo(
					() =>
						entry?.startAngle === 0 &&
						entry?.endAngle === 0 &&
						props.sectors.length !== 1,
				)
				const graphicalItemMatches = createMemo(
					() => activeGraphicalItemId() == null || activeGraphicalItemId() === props.id,
				)
				const isActive = createMemo(
					() =>
						String(i) === activeIndex() &&
						(activeDataKey() == null || props.allOtherPieProps.dataKey === activeDataKey()) &&
						graphicalItemMatches(),
				)
				const sectorOptions = createMemo(() => {
					const inactiveShape = activeIndex() ? props.inactiveShape : null
					return props.activeShape && isActive() ? props.activeShape : inactiveShape
				})
				const sectorProps = {
					...entry,
					stroke: entry.stroke,
					tabIndex: -1,
					[DATA_ITEM_INDEX_ATTRIBUTE_NAME]: i,
					[DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME]: props.id,
				}

				/* GOTCHA-016-C: React's synthetic onMouseEnter/Leave fired on native mouseover/mouseout. Solid binds 1:1 — bind both pairs so fireEvent.mouseEnter, fireEvent.mouseOver, and user.hover all dispatch; dedupe via per-instance entry flag. Compose adapted user onMouseOver/Out handlers ahead of context dispatch. */
				const adapted = (adaptEventsOfChild(restOfAllOtherProps(), entry, i) ?? {}) as Record<
					string,
					((e: Event) => void) | undefined
				>
				const enterHandler = onMouseEnterFromContext(entry, i)
				const leaveHandler = onMouseLeaveFromContext(entry, i)
				const userOver = adapted.onMouseOver
				const userOut = adapted.onMouseOut
				let entered = false
				const fireEnter = (e: MouseEvent & { currentTarget: SVGElement }) => {
					if (entered) return
					entered = true
					userOver?.(e)
					enterHandler(e)
				}
				const fireLeave = (e: MouseEvent & { currentTarget: SVGElement }) => {
					if (!entered) return
					entered = false
					userOut?.(e)
					leaveHandler(e)
				}
				const clickHandler = onClickFromContext(entry, i)
				return (
					<Show when={!isHidden()}>
						<Layer
							tabIndex={-1}
							class="recharts-pie-sector"
							{...adapted}
							onMouseEnter={fireEnter}
							onMouseOver={fireEnter}
							onMouseLeave={fireLeave}
							onMouseOut={fireLeave}
							onClick={clickHandler}
						>
							<Shape
								option={props.shape ?? sectorOptions()}
								index={i}
								shapeType="sector"
								isActive={isActive()}
								{...sectorProps}
							/>
						</Layer>
					</Show>
				)
			}}
		</For>
	)
}

export function computePieSectors({
	pieSettings,
	displayedData,
	cells,
	offset,
}: {
	pieSettings: PieSettings
	displayedData: ChartData
	cells: ReadonlyArray<JSX.Element> | undefined
	offset: ChartOffsetInternal
}): ReadonlyArray<PieSectorDataItem> | undefined {
	const { cornerRadius, startAngle, endAngle, dataKey, nameKey, tooltipType } = pieSettings
	const minAngle = Math.abs(pieSettings.minAngle)
	const deltaAngle = parseDeltaAngle(startAngle, endAngle)
	const absDeltaAngle = Math.abs(deltaAngle)
	const paddingAngle = displayedData.length <= 1 ? 0 : (pieSettings.paddingAngle ?? 0)

	const notZeroItemCount = displayedData.filter(
		(entry) => getValueByDataKey(entry, dataKey, 0) !== 0,
	).length
	const totalPaddingAngle =
		(absDeltaAngle >= 360 ? notZeroItemCount : notZeroItemCount - 1) * paddingAngle
	const realTotalAngle = absDeltaAngle - notZeroItemCount * minAngle - totalPaddingAngle

	const sum = displayedData.reduce((result: number, entry: unknown) => {
		const val = getValueByDataKey(entry, dataKey, 0)
		return result + (isNumber(val) ? val : 0)
	}, 0)
	let sectors: PieSectorDataItem[] | undefined

	if (sum > 0) {
		let prev: PieSectorDataItem
		sectors = displayedData.map((entry: unknown, i: number) => {
			const val: number = getValueByDataKey(entry, dataKey, 0)
			const name: string = getValueByDataKey(entry, nameKey, i)
			const coordinate: PieCoordinate = parseCoordinateOfPie(pieSettings, offset, entry)
			const percent = (isNumber(val) ? val : 0) / sum
			let tempStartAngle: number

			const entryWithCellInfo: RealPieData = {
				...(entry as Record<string, unknown>),
				...(cells && cells[i] && (cells[i] as unknown as { props: Record<string, unknown> }).props),
			}

			if (i) {
				tempStartAngle = prev.endAngle + mathSign(deltaAngle) * paddingAngle * (val !== 0 ? 1 : 0)
			} else {
				tempStartAngle = startAngle
			}

			const tempEndAngle =
				tempStartAngle +
				mathSign(deltaAngle) * ((val !== 0 ? minAngle : 0) + percent * realTotalAngle)
			const midAngle = (tempStartAngle + tempEndAngle) / 2
			const middleRadius = (coordinate.innerRadius + coordinate.outerRadius) / 2

			const tooltipPayload: TooltipPayload = [
				{
					dataKey,
					graphicalItemId: pieSettings.id,
					name,
					payload: entryWithCellInfo,
					type: tooltipType,
					value: val,
				},
			]
			const tooltipPosition = polarToCartesian(coordinate.cx, coordinate.cy, middleRadius, midAngle)

			prev = {
				...pieSettings.presentationProps,
				percent,
				cornerRadius: typeof cornerRadius === "string" ? parseFloat(cornerRadius) : cornerRadius,
				name,
				tooltipPayload,
				midAngle,
				middleRadius,
				tooltipPosition,
				...entryWithCellInfo,
				...coordinate,
				value: val,
				dataKey,
				startAngle: tempStartAngle,
				endAngle: tempEndAngle,
				payload: entryWithCellInfo,
				paddingAngle: mathSign(deltaAngle) * paddingAngle,
			} as PieSectorDataItem
			return prev
		})
	}
	return sectors
}

function PieLabelListProvider(props: {
	showLabels: boolean
	sectors: ReadonlyArray<PieSectorDataItem>
	children: JSX.Element
}): JSX.Element {
	const labelListEntries = createMemo((): ReadonlyArray<PolarLabelListEntry> => {
		if (!props.showLabels || !props.sectors) {
			return []
		}
		return props.sectors.map(
			(entry): PolarLabelListEntry => ({
				clockWise: false,
				fill: entry.fill,
				parentViewBox: undefined,
				payload: entry.payload,
				value: entry.value,
				viewBox: {
					clockWise: false,
					cx: entry.cx,
					cy: entry.cy,
					endAngle: entry.endAngle,
					innerRadius: entry.innerRadius,
					outerRadius: entry.outerRadius,
					startAngle: entry.startAngle,
				},
			}),
		)
	})
	/* eslint-disable solid/reactivity -- Provider value reads labelListEntries() and props.showLabels inside JSX attribute; both are reactive */
	return (
		<PolarLabelListContextProvider value={props.showLabels ? labelListEntries() : undefined}>
			{props.children}
		</PolarLabelListContextProvider>
	)
	/* eslint-enable solid/reactivity */
}

type WithoutId<T> = Omit<T, "id">

function SectorsWithAnimation(props: {
	pieProps: WithoutId<InternalProps>
	id: GraphicalItemId
	previousSectorsRef: { current: ReadonlyArray<PieSectorDataItem> | null }
}): JSX.Element {
	const animationId = useAnimationId(() => props.pieProps, "recharts-pie-")

	/* GOTCHA-014-G: keyed snapshot of prevSectors at animationId flip. */
	const animationContext = createMemo(() => {
		animationId()
		return { prevSectors: props.previousSectorsRef.current }
	})

	const [isAnimating, setIsAnimating] = createSignal(false)

	const handleAnimationEnd = () => {
		if (typeof props.pieProps.onAnimationEnd === "function") {
			props.pieProps.onAnimationEnd()
		}
		setIsAnimating(false)
	}

	const handleAnimationStart = () => {
		if (typeof props.pieProps.onAnimationStart === "function") {
			props.pieProps.onAnimationStart()
		}
		setIsAnimating(true)
	}

	return (
		<PieLabelListProvider showLabels={!isAnimating()} sectors={props.pieProps.sectors}>
			<JavascriptAnimate
				animationId={animationId()}
				begin={props.pieProps.animationBegin}
				duration={props.pieProps.animationDuration}
				isActive={props.pieProps.isAnimationActive}
				easing={props.pieProps.animationEasing}
				onAnimationStart={handleAnimationStart}
				onAnimationEnd={handleAnimationEnd}
			>
				{(t: () => number) => {
					/* GOTCHA-014: thunk children — prev via effect. */
					const stepData = createMemo(() => {
						const ctx = animationContext()
						const tValue = t()
						const computed: PieSectorDataItem[] = []
						const first: PieSectorDataItem | undefined =
							props.pieProps.sectors && props.pieProps.sectors[0]
						let curAngle: number = first?.startAngle ?? 0
						props.pieProps.sectors?.forEach((entry, index) => {
							const prev = ctx.prevSectors && ctx.prevSectors[index]
							const paddingAngle = index > 0 ? get(entry, "paddingAngle", 0) : 0
							if (prev) {
								const angle = interpolate(
									prev.endAngle - prev.startAngle,
									entry.endAngle - entry.startAngle,
									tValue,
								)
								const latest = {
									...entry,
									endAngle: curAngle + angle + paddingAngle,
									startAngle: curAngle + paddingAngle,
								}
								computed.push(latest)
								curAngle = latest.endAngle
							} else {
								const { endAngle, startAngle } = entry
								const deltaAngle = interpolate(0, endAngle - startAngle, tValue)
								const latest = {
									...entry,
									endAngle: curAngle + deltaAngle + paddingAngle,
									startAngle: curAngle + paddingAngle,
								}
								computed.push(latest)
								curAngle = latest.endAngle
							}
						})
						return computed
					})
					createEffect(() => {
						if (t() > 0) {
							props.previousSectorsRef.current = stepData()
						}
					})
					return (
						<Layer>
							<PieSectors
								sectors={stepData()}
								activeShape={props.pieProps.activeShape}
								inactiveShape={props.pieProps.inactiveShape}
								allOtherPieProps={props.pieProps}
								shape={props.pieProps.shape}
								id={props.id}
							/>
						</Layer>
					)
				}}
			</JavascriptAnimate>
			<PieLabelList
				showLabels={!isAnimating()}
				sectors={props.pieProps.sectors}
				pieProps={props.pieProps}
			/>
			{props.pieProps.children}
		</PieLabelListProvider>
	)
}

function RenderSectors(props: {
	pieProps: WithoutId<InternalProps>
	id: GraphicalItemId
}): JSX.Element {
	const previousSectorsRef: { current: ReadonlyArray<PieSectorDataItem> | null } = {
		current: null,
	}
	return (
		<SectorsWithAnimation
			pieProps={props.pieProps}
			id={props.id}
			previousSectorsRef={previousSectorsRef}
		/>
	)
}

export const defaultPieProps = {
	animationBegin: 400,
	animationDuration: 1500,
	animationEasing: "ease",
	cx: "50%",
	cy: "50%",
	dataKey: "value",
	endAngle: 360,
	fill: "#808080",
	hide: false,
	innerRadius: 0,
	isAnimationActive: "auto",
	label: false,
	labelLine: true,
	legendType: "rect",
	minAngle: 0,
	nameKey: "name",
	outerRadius: "80%",
	paddingAngle: 0,
	rootTabIndex: 0,
	startAngle: 0,
	stroke: "#fff",
	zIndex: DefaultZIndexes.area,
} as const satisfies Partial<Props>

function PieImpl(props: Omit<InternalProps, "sectors">): JSX.Element {
	/* keep `props` reactive end-to-end. destructuring/spreading freezes the Solid
	   props proxy at this scope and downstream sectors/animation lose live updates. */
	const [idProps, propsWithoutId] = splitProps(props, ["id"])
	const id = (): GraphicalItemId => idProps.id
	const ctx = useChartStore()
	const stateCtx = useContext(RechartsStateContext)

	/* GOTCHA-013/017: Cell children register into this registry from inside the
	   Provider scope; cells() returns insertion-ordered { props } records that
	   selectPieSectors merges into per-sector data (fill/stroke/etc). */
	const cellsRegistry = createCellsRegistry()
	/* perf: memo so downstream selectors don't re-derive on every registry signal write
	   that doesn't change the resolved array reference (e.g. no-op Cell re-renders). */
	const cells = createMemo((): ReadonlyArray<Record<string, unknown>> | undefined => {
		const list = cellsRegistry.cells()
		return list.length === 0 ? undefined : (list as unknown as ReadonlyArray<Record<string, unknown>>)
	})

	const sectors = createMemo(() => {
		/* When new chartState has a settings entry, pass it as override so mutations
		   to graphicalItems[id].settings (fine-grained Solid store) invalidate this
		   memo and drive re-derivation without touching the legacy store. */
		const solidEntry = stateCtx?.state.graphicalItems[id()]
		const pieOverride =
			solidEntry != null && solidEntry.type === "pie"
				? (solidEntry.settings as PieSettings)
				: undefined
		return ctx ? selectPieSectors(ctx.store, id(), cells(), pieOverride) : undefined
	})

	const layerClass = (): string => clsx("recharts-pie", props.className)

	return (
		<>
			<CellsContextProvider value={cellsRegistry}>{props.children}</CellsContextProvider>
			<Show
				when={!props.hide && sectors() != null}
				fallback={<Layer tabIndex={props.rootTabIndex} class={layerClass()} />}
			>
				{(() => {
					const sx = (): Readonly<PieSectorDataItem[]> => sectors() ?? []
					const renderProps = mergeProps(propsWithoutId, {
						get sectors() {
							return sx()
						},
					}) as WithoutId<InternalProps>
					return (
						<ZIndexLayer zIndex={props.zIndex}>
							<SetPieTooltipEntrySettings
								dataKey={props.dataKey}
								nameKey={props.nameKey}
								sectors={sx()}
								stroke={props.stroke}
								strokeWidth={props.strokeWidth}
								fill={props.fill}
								name={props.name}
								hide={props.hide}
								tooltipType={props.tooltipType}
								id={id()}
							/>
							<Layer tabIndex={props.rootTabIndex} class={layerClass()}>
								<RenderSectors pieProps={renderProps} id={id()} />
							</Layer>
						</ZIndexLayer>
					)
				})()}
			</Show>
		</>
	)
}

type PropsWithResolvedDefaults = RequiresDefaultProps<Props, typeof defaultPieProps>

/**
 * @consumes PolarChartContext
 * @provides LabelListContext
 * @provides CellReader
 */
export function Pie(outsideProps: Props): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps. The destructure
	   `{ id, ...propsWithoutId } = resolveDefaultProps(...)` and the subsequent
	   `{...propsWithoutId}` spreads enumerate the props proxy and read `children`
	   eagerly — Cell/etc. children invoke before RegisterGraphicalItemId installs
	   its Provider. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props: PropsWithResolvedDefaults = resolveDefaultProps(restProps, defaultPieProps)
	const { id: externalId, ...propsWithoutId } = props
	const presentationProps: PiePresentationProps | null = svgPropertiesNoEvents(propsWithoutId)

	return (
		<RegisterGraphicalItemId id={externalId} type="pie">
			{(id: GraphicalItemId) => {
				/* GOTCHA-017: do NOT evaluate childrenProps.children here — Cell
				   createComponent calls would fire BEFORE PieImpl mounts its
				   cellsRegistry Provider. Pass `childrenProps` reference; PieImpl
				   memoizes inside its own Provider scope. */
				return (
					<>
						<SetPolarGraphicalItem
							type="pie"
							id={id}
							data={propsWithoutId.data}
							dataKey={propsWithoutId.dataKey}
							hide={propsWithoutId.hide}
							angleAxisId={0}
							radiusAxisId={0}
							name={propsWithoutId.name}
							nameKey={propsWithoutId.nameKey}
							tooltipType={propsWithoutId.tooltipType}
							legendType={propsWithoutId.legendType}
							fill={propsWithoutId.fill}
							cx={propsWithoutId.cx}
							cy={propsWithoutId.cy}
							startAngle={propsWithoutId.startAngle}
							endAngle={propsWithoutId.endAngle}
							paddingAngle={propsWithoutId.paddingAngle}
							minAngle={propsWithoutId.minAngle}
							innerRadius={propsWithoutId.innerRadius}
							outerRadius={propsWithoutId.outerRadius}
							cornerRadius={propsWithoutId.cornerRadius}
							presentationProps={presentationProps}
							maxRadius={props.maxRadius}
						/>
						<SetPiePayloadLegend {...propsWithoutId} id={id} />
						<PieImpl {...(propsWithoutId as Omit<InternalProps, "sectors" | "id">)} id={id}>
							{childrenProps.children}
						</PieImpl>
					</>
				)
			}}
		</RegisterGraphicalItemId>
	)
}
