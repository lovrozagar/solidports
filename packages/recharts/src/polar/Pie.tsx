/* eslint-disable import/no-cycle, sort-keys */
import type { JSX } from '@solidjs/web';
import { createHoverDedupe } from "../util/hoverDedupe"
import { createMemo, For, Show, untrack, useContext } from 'solid-js';
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
import { RequiresDefaultProps, resolveDefaultProps } from "../util/resolveDefaultProps"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import { SetPolarGraphicalItem } from "../state/SetGraphicalItem"
import { RechartsStateContext } from "../state/RechartsStateContext"
import { PiePresentationProps, PieSettings } from "../state/types/PieSettings"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
	SVGPropsNoEvents,
} from "../util/svgPropertiesNoEvents"
import { AnimatedItems, useAnimationCallbacks } from "../animation/AnimatedItems"
import type { AnimationInterpolateFn } from "../animation/AnimatedItems"
import { matchAppend } from "../animation/matchBy"
import type { AnimationMatchByProp } from "../animation/matchBy"
import { usePolarChartLayout } from "../context/chartLayoutContext"
import type { PolarLayout, ShapeAnimationProps } from "../util/types"
import {
	LabelListContextBridge,
	LabelListFromLabelProp,
	PolarLabelListContextProvider,
	PolarLabelListEntry,
	Props as LabelListProps,
} from "../component/LabelList"
import { PolarLabelContextProvider } from "../component/Label"
import { GraphicalItemId } from "../state/graphicalItemsSlice"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { ChartData } from "../state/chartDataSlice"
import { getClassNameFromUnknown } from "../util/getClassNameFromUnknown"
import { cloneJsxNodeWithProps, isJsxNode } from "../util/ReactUtils"
import type { Formatter } from "../component/DefaultTooltipContent"

import { mergeProps, splitProps } from '../util/solid-1-compat';
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
	onClick?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mousedown on the sectors in this group.
	 */
	onMouseDown?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseup on the sectors in this group.
	 */
	onMouseUp?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mousemove on the sectors in this group.
	 */
	onMouseMove?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseover on the sectors in this group.
	 */
	onMouseOver?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseout on the sectors in this group.
	 */
	onMouseOut?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseenter on the sectors in this group.
	 */
	onMouseEnter?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	/**
	 * The customized event handler of mouseleave on the sectors in this group.
	 */
	onMouseLeave?: (data: PieSectorDataItem, index: number, e: MouseEvent & { currentTarget: SVGGraphicsElement }) => void
	onTouchStart?: (data: PieSectorDataItem, index: number, e: TouchEvent & { currentTarget: SVGGraphicsElement }) => void
	onTouchMove?: (data: PieSectorDataItem, index: number, e: TouchEvent & { currentTarget: SVGGraphicsElement }) => void
	onTouchEnd?: (data: PieSectorDataItem, index: number, e: TouchEvent & { currentTarget: SVGGraphicsElement }) => void
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
	formatter?: Formatter
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
	animationEasing: AnimationTiming
	animationInterpolateFn: AnimationInterpolateFn<PieSectorDataItem, PolarLayout>
	animationMatchBy: AnimationMatchByProp<PieSectorDataItem>
	isAnimationActive: boolean | "auto"
	animationBegin: number
	animationDuration: AnimationDuration
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
	/**
	 * Custom animation function for interpolating data items.
	 * When provided, this replaces the default animation interpolation.
	 *
	 * @since 3.9
	 * @see {@link https://recharts.github.io/en-US/guide/animations/ Animations guide}
	 */
	animationInterpolateFn?: AnimationInterpolateFn<PieSectorDataItem, PolarLayout>
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
	animationMatchBy?: AnimationMatchByProp<PieSectorDataItem>
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
	 * If set "auto", animation is disabled during SSR and when the user prefers reduced motion.
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
	 * Formats the value displayed in the tooltip for this Pie.
	 * When set, takes precedence over the `formatter` prop on the Tooltip component.
	 */
	formatter?: Formatter
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

/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped items accept any data */
export type Props<DataPointType = any, DataValueType = any> = PieSvgAttributes & PieProps<DataPointType, DataValueType>

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

type PieSectorsProps = ShapeAnimationProps & {
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

function getActiveShapeFill(
	activeShape: ActiveShape<Readonly<PieSectorDataItem>> | undefined,
): string | undefined {
	/* activeShape can be boolean/function/element/object; only element/object can carry a static fill value. */
	if (activeShape == null || typeof activeShape === "boolean" || typeof activeShape === "function") {
		return undefined
	}
	if (isJsxNode(activeShape)) {
		/* Solid element form: the evaluated node carries `fill` as an attribute. */
		const fill = activeShape instanceof Element ? activeShape.getAttribute("fill") : null
		return fill ?? undefined
	}
	const { fill } = activeShape as { fill?: unknown }
	return typeof fill === "string" ? fill : undefined
}

function SetPieTooltipEntrySettings(
	props: Pick<
		InternalProps,
		| "activeShape"
		| "dataKey"
		| "nameKey"
		| "sectors"
		| "stroke"
		| "strokeWidth"
		| "fill"
		| "name"
		| "hide"
		| "tooltipType"
		| "formatter"
		| "id"
	>,
): JSX.Element {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => {
		const activeShapeFill = getActiveShapeFill(props.activeShape)
		return {
			dataDefinedOnItem: props.sectors.map((sector: PieSectorDataItem) => {
				const sectorTooltipPayload = sector.tooltipPayload
				if (activeShapeFill == null || sectorTooltipPayload == null) {
					return sectorTooltipPayload
				}
				return sectorTooltipPayload.map((item) => ({
					...item,
					color: activeShapeFill,
					fill: activeShapeFill,
				}))
			}),
			getPosition: (index) => props.sectors[Number(index)]?.tooltipPosition,
			settings: {
				color: props.fill,
				dataKey: props.dataKey,
				fill: props.fill,
				formatter: props.formatter,
				graphicalItemId: props.id,
				hide: props.hide,
				name: getTooltipNameProp(props.name, props.dataKey),
				nameKey: props.nameKey,
				stroke: props.stroke,
				strokeWidth: props.strokeWidth,
				type: props.tooltipType,
				unit: "",
			},
		}
	})
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
			className={className}
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
	return (
		<Show when={!!props.showLabels && !!props.pieProps.label && props.sectors != null}>
			<PieLabelsBody pieProps={props.pieProps} sectors={props.sectors} />
		</Show>
	)
}

function PieLabelsBody(props: {
	sectors: ReadonlyArray<PieSectorDataItem>
	pieProps: WithoutId<InternalProps>
}): JSX.Element {
	const pieProps = createMemo(() => svgPropertiesNoEvents(props.pieProps))
	const customLabelProps = createMemo(() =>
		svgPropertiesNoEventsFromUnknown(props.pieProps.label),
	)
	const customLabelLineProps = createMemo(() =>
		svgPropertiesNoEventsFromUnknown(props.pieProps.labelLine),
	)
	const offsetRadius = createMemo(() => {
		const label = props.pieProps.label
		if (
			typeof label === "object" &&
			label != null &&
			"offsetRadius" in label &&
			typeof label.offsetRadius === "number"
		) {
			return label.offsetRadius
		}
		return 20
	})

	return (
		<Layer class="recharts-pie-labels">
			<For each={props.sectors}>
				{(entry: PieSectorDataItem, iAccessor) => {
					const i = untrack(() => iAccessor())
					const node = createMemo(() => {
						const midAngle = (entry.startAngle + entry.endAngle) / 2
						const endPoint = polarToCartesian(
							entry.cx,
							entry.cy,
							entry.outerRadius + offsetRadius(),
							midAngle,
						)
						const labelItemProps: PieLabelRenderProps = {
							...pieProps(),
							...entry,
							stroke: "none",
							...customLabelProps(),
							index: i,
							textAnchor: getTextAnchor(endPoint.x, entry.cx),
							...endPoint,
						} as PieLabelRenderProps
						const lineProps: CurveProps = {
							...pieProps(),
							...entry,
							fill: "none",
							stroke: entry.fill,
							...customLabelLineProps(),
							index: i,
							points: [
								polarToCartesian(entry.cx, entry.cy, entry.outerRadius, midAngle),
								endPoint,
							],
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
										getValueByDataKey(
											entry,
											props.pieProps.dataKey as DataKey<PieSectorDataItem>,
										),
									)}
								</Layer>
							</ZIndexLayer>
						)
					})
					return node as unknown as JSX.Element
				}}
			</For>
		</Layer>
	)
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
	/* GOTCHA-016-C: one entry per pointer move across both event pairs, shared by all sectors. */
	const hover = createHoverDedupe()
	const activeIndex = createMemo(() =>
		ctx ? selectActiveTooltipIndex(ctx.store) : undefined,
	)
	const activeDataKey = createMemo(() =>
		ctx ? selectActiveTooltipDataKey(ctx.store) : undefined,
	)
	const activeGraphicalItemId = createMemo(() =>
		ctx ? selectActiveTooltipGraphicalItemId(ctx.store) : undefined,
	)

	/* eslint-disable solid/reactivity -- id is a stable identifier; handler and dataKey sources are accessors read at event time; sectors null check is structural */
	/* GOTCHA-005-D: pass live accessors — dot-access at hook setup snapshots the value. */
	const onMouseEnterFromContext = useMouseEnterItemDispatch(
		() => props.allOtherPieProps.onMouseEnter as never,
		() => props.allOtherPieProps.dataKey,
		props.id,
	)
	const onMouseLeaveFromContext = useMouseLeaveItemDispatch(
		() => props.allOtherPieProps.onMouseLeave as never,
	)
	const onClickFromContext = useMouseClickItemDispatch(
		() => props.allOtherPieProps.onClick as never,
		() => props.allOtherPieProps.dataKey,
		props.id,
	)
	/* Once per series, not per sector: the rest-spread copies every Pie prop. */
	const restOfAllOtherProps = createMemo((): Record<string, unknown> => {
		const { onMouseEnter, onClick, onMouseLeave, ...rest } =
			props.allOtherPieProps as unknown as Record<string, unknown>
		void onMouseEnter
		void onClick
		void onMouseLeave
		return rest
	})

	/* eslint-enable solid/reactivity */

	return (
		<Show when={props.sectors != null && props.sectors.length > 0}>
		<For each={props.sectors}>
			{(entry: PieSectorDataItem, iAccessor) => {
				/* eslint-disable-next-line solid/reactivity -- iAccessor() snapshotted intentionally; i is used as a static index, not a reactive signal, per GOTCHA-014-H */
				const i = untrack(() => iAccessor())
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
				/* Not memoized: an element option must be evaluated where Shape reads it, inside
				   its ShapeElementPropsProvider (each read of an element prop mints a new shape). */
				const sectorOptions = () => {
					if (isActive()) {
						const activeShape = props.activeShape
						if (activeShape) {
							return activeShape
						}
					}
					return activeIndex() ? props.inactiveShape : null
				}
				const sectorProps = {
					...entry,
					/* Getters: the spread into <Shape> reads these inside its tracked props. */
					get animationElapsedTime() {
						return props.animationElapsedTime
					},
					get isAnimating() {
						return props.isAnimating
					},
					get isEntrance() {
						return props.isEntrance
					},
					stroke: entry.stroke,
					tabindex: -1,
					[DATA_ITEM_INDEX_ATTRIBUTE_NAME]: i,
					[DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME]: props.id,
				}

				/* GOTCHA-016-C: React's synthetic onMouseEnter/Leave fired on native mouseover/mouseout. Solid binds 1:1 — bind both pairs so fireEvent.mouseEnter, fireEvent.mouseOver, and user.hover all dispatch; dedupe via per-instance entry flag. Compose adapted user onMouseOver/Out handlers ahead of context dispatch. */
				const adapted = (adaptEventsOfChild(untrack(() => restOfAllOtherProps()), entry, i) ?? {}) as Record<
					string,
					((e: Event) => void) | undefined
				>
				const enterHandler = onMouseEnterFromContext(entry, i)
				const leaveHandler = onMouseLeaveFromContext(entry, i)
				const userOver = adapted.onMouseOver
				const userOut = adapted.onMouseOut
				const fireEnter = (e: MouseEvent & { currentTarget: SVGElement }) => {
					if (!hover.enter(e)) return
					userOver?.(e)
					enterHandler(e)
				}
				const fireLeave = (e: MouseEvent & { currentTarget: SVGElement }) => {
					if (!hover.leave(e)) return
					userOut?.(e)
					leaveHandler(e)
				}
				const clickHandler = onClickFromContext(entry, i)
				return (
					<Show when={!isHidden()}>
						<Layer
							tabindex={-1}
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
		</Show>
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

	const sum = displayedData.reduce((result: number, entry: unknown) => {
		const val = getValueByDataKey(entry, dataKey, 0)
		return result + (isNumber(val) ? val : 0)
	}, 0)

	/*
	 * Only apply minAngle redistribution when at least one non-zero segment's
	 * natural angle falls below the minAngle threshold. Otherwise, minAngle
	 * unnecessarily shifts all segments even when none need the boost.
	 * See: https://github.com/recharts/recharts/issues/6814
	 */
	const needsMinAngleAdjustment =
		minAngle > 0 &&
		sum > 0 &&
		displayedData.some((entry) => {
			const val = getValueByDataKey(entry, dataKey, 0)
			const percent = (isNumber(val) ? val : 0) / sum
			return val !== 0 && percent * absDeltaAngle < minAngle
		})
	const effectiveMinAngle = needsMinAngleAdjustment ? minAngle : 0

	const realTotalAngle = absDeltaAngle - notZeroItemCount * effectiveMinAngle - totalPaddingAngle
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
			const sectorColor =
				entryWithCellInfo != null && "fill" in entryWithCellInfo && typeof entryWithCellInfo.fill === "string"
					? entryWithCellInfo.fill
					: pieSettings.fill

			if (i) {
				tempStartAngle = prev.endAngle + mathSign(deltaAngle) * paddingAngle * (val !== 0 ? 1 : 0)
			} else {
				tempStartAngle = startAngle
			}

			const tempEndAngle =
				tempStartAngle +
				mathSign(deltaAngle) * ((val !== 0 ? effectiveMinAngle : 0) + percent * realTotalAngle)
			const midAngle = (tempStartAngle + tempEndAngle) / 2
			const middleRadius = (coordinate.innerRadius + coordinate.outerRadius) / 2

			const tooltipPayload: TooltipPayload = [
				{
					color: sectorColor,
					dataKey,
					fill: sectorColor,
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
				paddingAngle: val !== 0 ? mathSign(deltaAngle) * paddingAngle : 0,
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

const defaultPieAnimateItems: AnimationInterpolateFn<PieSectorDataItem, PolarLayout> = (
	items,
	animationElapsedTime,
) => {
	if (items == null) return []
	const stepData: PieSectorDataItem[] = []
	const firstNonRemoved = items.find((item) => item.status !== "removed")
	let curAngle: number = firstNonRemoved ? firstNonRemoved.next.startAngle : 0

	items.forEach((item, index) => {
		if (item.status === "removed") return
		const paddingAngle = index > 0 ? get(item.next, "paddingAngle", 0) : 0

		if (item.status === "matched") {
			const angle = interpolate(
				item.prev.endAngle - item.prev.startAngle,
				item.next.endAngle - item.next.startAngle,
				animationElapsedTime,
			)
			const latest = {
				...item.next,
				endAngle: curAngle + angle + paddingAngle,
				startAngle: curAngle + paddingAngle,
			}
			stepData.push(latest)
			curAngle = latest.endAngle
		} else {
			// added
			const deltaAngle = interpolate(0, item.next.endAngle - item.next.startAngle, animationElapsedTime)
			const latest = {
				...item.next,
				endAngle: curAngle + deltaAngle + paddingAngle,
				startAngle: curAngle + paddingAngle,
			}
			stepData.push(latest)
			curAngle = latest.endAngle
		}
	})
	return stepData
}

function SectorsWithAnimation(props: {
	pieProps: WithoutId<InternalProps>
	id: GraphicalItemId
	previousSectorsRef: { current: ReadonlyArray<PieSectorDataItem> | null }
}): JSX.Element {
	const { isAnimating, handleAnimationStart, handleAnimationEnd } = useAnimationCallbacks(
		() => props.pieProps.onAnimationStart,
		() => props.pieProps.onAnimationEnd,
	)
	const layout = createMemo(() => usePolarChartLayout())

	return (
		<Show when={layout()}>
			{(polarLayout) => (
				<PieLabelListProvider showLabels={!isAnimating()} sectors={props.pieProps.sectors}>
					<AnimatedItems
						animationInput={props.pieProps.sectors}
						animationIdPrefix="recharts-pie-"
						items={props.pieProps.sectors}
						previousItemsRef={props.previousSectorsRef}
						isAnimationActive={props.pieProps.isAnimationActive}
						animationBegin={props.pieProps.animationBegin}
						animationDuration={props.pieProps.animationDuration}
						animationEasing={props.pieProps.animationEasing}
						onAnimationStart={handleAnimationStart}
						onAnimationEnd={handleAnimationEnd}
						animationInterpolateFn={props.pieProps.animationInterpolateFn}
						animationMatchBy={props.pieProps.animationMatchBy}
						layout={polarLayout()}
					>
						{(stepData, animationElapsedTime, isEntrance) => (
							<Layer>
								<PieSectors
									sectors={stepData()}
									activeShape={props.pieProps.activeShape}
									inactiveShape={props.pieProps.inactiveShape}
									allOtherPieProps={props.pieProps}
									shape={props.pieProps.shape}
									id={props.id}
									animationElapsedTime={animationElapsedTime()}
									isAnimating={isAnimating() || animationElapsedTime() < 1}
									isEntrance={isEntrance()}
								/>
							</Layer>
						)}
					</AnimatedItems>
					<PieLabelList
						showLabels={!isAnimating()}
						sectors={props.pieProps.sectors}
						pieProps={props.pieProps}
					/>
				</PieLabelListProvider>
			)}
		</Show>
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
	animationInterpolateFn: defaultPieAnimateItems,
	animationMatchBy: matchAppend,
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

function PieChildrenScope(props: { childrenProps: { children?: JSX.Element } }): JSX.Element {
	/* GOTCHA-017: memoize children INSIDE PolarLabelContext + CellsContext so
	   Label/Cell createComponent runs with those providers as owner. Reading
	   `children` as a JSX child of PieImpl mints Label outside polar context. */
	const memoizedChildren = createMemo(() => props.childrenProps.children)
	return <>{memoizedChildren()}</>
}

function PieImpl(
	props: Omit<InternalProps, "sectors"> & { childrenProps: { children?: JSX.Element } },
): JSX.Element {
	/* keep `props` reactive end-to-end. destructuring/spreading freezes the Solid
	   props proxy at this scope and downstream sectors/animation lose live updates. */
	const [idProps, rest] = splitProps(props, ["id"])
	const [childrenBag, propsWithoutId] = splitProps(rest, ["childrenProps"])
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
	const firstSector = createMemo(() => sectors()?.[0])

	return (
		<LabelListContextBridge>
			{/* Children always mount so <Cell/>s register even before any sector exists (they
			   can be the only data source); polar labels wait until the first sector. */}
			<PolarLabelContextProvider
					pending={firstSector() == null}
					cx={firstSector()?.cx ?? 0}
					cy={firstSector()?.cy ?? 0}
					innerRadius={firstSector()?.innerRadius ?? 0}
					outerRadius={firstSector()?.outerRadius ?? 0}
					startAngle={props.startAngle ?? 0}
					endAngle={props.endAngle ?? 0}
					clockWise={false}
				>
					<CellsContextProvider value={cellsRegistry}>
						<PieChildrenScope childrenProps={childrenBag.childrenProps} />
					</CellsContextProvider>
				</PolarLabelContextProvider>
			<Show
				when={!props.hide && sectors() != null}
				fallback={<Layer tabindex={props.rootTabIndex} class={layerClass()} />}
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
								activeShape={props.activeShape}
								dataKey={props.dataKey}
								nameKey={props.nameKey}
								sectors={sx()}
								stroke={props.stroke}
								strokeWidth={props.strokeWidth}
								fill={props.fill}
								name={props.name}
								hide={props.hide}
								tooltipType={props.tooltipType}
								formatter={props.formatter}
								id={id()}
							/>
							<Layer tabindex={props.rootTabIndex} class={layerClass()}>
								<RenderSectors pieProps={renderProps} id={id()} />
							</Layer>
						</ZIndexLayer>
					)
				})()}
			</Show>
		</LabelListContextBridge>
	)
}

type PropsWithResolvedDefaults = RequiresDefaultProps<Props, typeof defaultPieProps>

/**
 * @consumes PolarChartContext
 * @provides LabelListContext
 * @provides CellReader
 */
function PieFn(outsideProps: Props): JSX.Element {
	/* GOTCHA-013: split children before resolveDefaultProps. The destructure
	   `{ id, ...propsWithoutId } = resolveDefaultProps(...)` and the subsequent
	   `{...propsWithoutId}` spreads enumerate the props proxy and read `children`
	   eagerly — Cell/etc. children invoke before RegisterGraphicalItemId installs
	   its Provider. */
	const [childrenProps, restProps] = splitProps(outsideProps, ["children"])
	const props: PropsWithResolvedDefaults = resolveDefaultProps(restProps, defaultPieProps)
	const [idProps, propsWithoutId] = splitProps(props, ["id"])
	const presentationProps = createMemo(
		(): PiePresentationProps | null => svgPropertiesNoEvents(propsWithoutId),
	)

	return (
		<RegisterGraphicalItemId id={idProps.id} type="pie">
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
							presentationProps={presentationProps()}
							maxRadius={props.maxRadius}
						/>
						<SetPiePayloadLegend {...propsWithoutId} id={id} />
						<PieImpl
							{...(propsWithoutId as Omit<InternalProps, "sectors" | "id">)}
							id={id}
							childrenProps={childrenProps}
						/>
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
export const Pie = PieFn as {
	<DataPointType = any, DataValueType = any>(props: Props<DataPointType, DataValueType>): JSX.Element
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream fallback overload for mismatched data/dataKey */
	(props: Props<any, any>): JSX.Element
	displayName?: string
}
