/* eslint-disable import/no-cycle, sort-keys */
import { createMemo, Show, untrack } from 'solid-js';
import { createHoverDedupe } from "../util/hoverDedupe"
import type { JSX } from '@solidjs/web';
import { scaleLinear } from "victory-vendor/d3-scale"
import { clsx } from "clsx"
import get from "es-toolkit/compat/get"
import { Surface } from "../container/Surface"
import { Layer } from "../container/Layer"
import { Sector } from "../shape/Sector"
import { Text } from "../component/Text"
import type { Props as TextProps } from "../component/Text"
import { polarToCartesian } from "../util/PolarUtils"
import {
	ReportChartMargin,
	ReportChartSize,
	useChartHeight,
	useChartWidth,
} from "../context/chartLayoutContext"
import { RechartsWrapper } from "./RechartsWrapper"
import type {
	TooltipIndex,
	TooltipPayloadConfiguration,
	TooltipPayloadSearcher,
} from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import { RechartsStateProvider } from "../state/RechartsStateProvider"
import { createInitialLayoutState } from "../state/chartState"
import { ReportEventSettings } from "../state/ReportEventSettings"
import type { ChartCoordinate, DataKey, EventThrottlingProps, Margin, Percent } from "../util/types"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/useChartState"
import type { ChartState } from "../state/chartState"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { WithIdRequired } from "../util/useUniqueId"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { initialEventSettingsState } from "../state/eventSettingsSlice"

import { splitProps } from '../util/solid-1-compat';
import { setTooltipInteraction } from "../state/tooltipInteraction"
export interface SunburstData {
	[key: string]: unknown
	name: string
	value?: number
	fill?: string
	tooltipIndex?: TooltipIndex
	children?: SunburstData[]
}

/**
 * We require tooltipIndex on each node internally to track which node is active in the tooltip.
 * This is not required from the outside user - we can calculate it as we traverse the tree.
 */
interface SunburstNode extends SunburstData {
	tooltipIndex: TooltipIndex
}

export interface SunburstChartProps extends EventThrottlingProps {
	class?: string
	/**
	 * The source data. Each element should be an object.
	 * The properties of each object represent the values of different data dimensions.
	 *
	 * Use the `dataKey` prop to specify which properties to use.
	 *
	 * @example data={[{ name: 'a', value: 12, fill: '#8884d8' }, { name: 'b', value: 5, fill: '#83a6ed' }]}
	 */
	data: SunburstData
	/**
	 * The width of chart container.
	 * Can be a number or a percent string like "100%".
	 *
	 * @see {@link https://recharts.github.io/en-US/guide/sizes/ Chart sizing guide}
	 */
	width?: number | Percent
	/**
	 * The height of chart container.
	 * Can be a number or a percent string like "100%".
	 *
	 * @see {@link https://recharts.github.io/en-US/guide/sizes/ Chart sizing guide}
	 */
	height?: number | Percent
	/**
	 * If true, then it will listen to container size changes and adapt the SVG chart accordingly.
	 * If false, then it renders the chart at the specified width and height and will stay that way
	 * even if the container size changes.
	 *
	 * This is similar to ResponsiveContainer but without the need for an extra wrapper component.
	 * The `responsive` prop also uses standard CSS sizing rules, instead of custom resolution logic (like ResponsiveContainer does).
	 * @default false
	 */
	responsive?: boolean
	/**
	 * Distance between sectors.
	 *
	 * @defaultValue 2
	 */
	padding?: number
	/**
	 * Decides how to extract value from the data.
	 *
	 * @defaultValue value
	 */
	dataKey?: string
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
	nameKey?: DataKey<unknown>
	/**
	 * Padding between each hierarchical level.
	 */
	ringPadding?: number
	/**
	 * The radius of the inner circle at the center of the chart.
	 *
	 * @defaultValue 50
	 */
	innerRadius?: number
	/**
	 * Outermost edge of the chart.
	 * Defaults to the max possible radius for a circle inscribed in the chart container
	 */
	outerRadius?: number
	/**
	 * The x-coordinate of center in pixels.
	 * If undefined, it will be set to half of the chart width.
	 */
	cx?: number
	/**
	 * The y-coordinate of center in pixels.
	 * If undefined, it will be set to half of the chart height.
	 */
	cy?: number
	/** Angle in degrees from which the chart should start. */
	startAngle?: number
	/** Angle, in degrees, at which the chart should end. */
	endAngle?: number
	children?: JSX.Element
	fill?: string
	stroke?: string
	/**
	 * An object with svg text options to control the appearance of the chart labels.
	 */
	textOptions?: TextProps
	onMouseEnter?: (node: SunburstData, e: MouseEvent) => void
	onMouseLeave?: (node: SunburstData, e: MouseEvent) => void
	onClick?: (node: SunburstData) => void
	style?: JSX.CSSProperties
	id?: string
}

interface DrawArcOptions {
	radius: number
	innerR: number
	initialAngle: number
	childColor?: string
	nestedActiveTooltipIndex?: TooltipIndex | undefined
}

const defaultTextProps = {
	fill: "black",
	fontSize: ".75rem",
	fontWeight: "bold",
	paintOrder: "stroke fill",
	pointerEvents: "none",
	stroke: "#FFF",
}

function getMaxDepthOf(node: SunburstData): number {
	if (node.children == null || node.children.length === 0) return 1

	/* Calculate depth for each child and find the maximum */
	const childDepths = node.children.map((d) => getMaxDepthOf(d))
	return 1 + Math.max(...childDepths)
}

function SetSunburstTooltipEntrySettings(props: {
	dataKey: string | undefined
	data: SunburstData
	stroke: string | undefined
	fill: string | undefined
	nameKey: DataKey<unknown> | undefined
	id: string
	positions: SunburstPositionMap
}): JSX.Element {
	const tooltipEntrySettings = createMemo((): TooltipPayloadConfiguration => ({
		dataDefinedOnItem: props.data.children,
		getPosition: (index) => props.positions.get(index),
		/* Sunburst does not support many of the properties as other charts do so there's plenty of defaults here */
		settings: {
			stroke: props.stroke,
			strokeWidth: undefined,
			fill: props.fill,
			nameKey: props.nameKey,
			dataKey: props.dataKey,
			/* if there is a nameKey use it, otherwise make the name of the tooltip the dataKey itself */
			name: props.nameKey ? undefined : props.dataKey,
			hide: false,
			type: undefined,
			color: props.fill,
			unit: "",
			graphicalItemId: props.id,
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

/* Why is margin not a sunburst prop? No clue. Probably it should be */
const defaultSunburstMargin: Margin = {
	bottom: 0,
	left: 0,
	right: 0,
	top: 0,
}

export const payloadSearcher: TooltipPayloadSearcher = (
	data: unknown,
	activeIndex: TooltipIndex,
): unknown => {
	if (activeIndex == null) {
		return undefined
	}
	return get(data, activeIndex)
}

const addToSunburstNodeIndex = (
	indexInChildrenArr: number,
	activeTooltipIndexSoFar: TooltipIndex | undefined = "",
): TooltipIndex => {
	return `${activeTooltipIndexSoFar}children[${indexInChildrenArr}]`
}

const preloadedState: Partial<ChartState> = {
	options: {
		chartName: "Sunburst",
		defaultTooltipEventType: "item",
		eventEmitter: undefined,
		tooltipPayloadSearcher: payloadSearcher,
		validateTooltipEventTypes: ["item"],
	},
}

type SunburstPositionMap = Map<string, ChartCoordinate>

export const defaultSunburstChartProps = {
	dataKey: "value",
	endAngle: 360,
	fill: "#333",
	innerRadius: 50,
	nameKey: "name",
	padding: 2,
	responsive: false,
	ringPadding: 2,
	startAngle: 0,
	stroke: "#FFF",
	textOptions: defaultTextProps,
	...initialEventSettingsState,
} as const satisfies Partial<SunburstChartProps>

type InternalSunburstChartProps = WithIdRequired<
	RequiresDefaultProps<SunburstChartProps, typeof defaultSunburstChartProps>
>

function SunburstChartImpl(props: InternalSunburstChartProps): JSX.Element | null {
	/* GOTCHA-016-C: one entry per pointer move across both event pairs, shared by all items. */
	const hover = createHoverDedupe()
	const ctx = useChartStore()
	const newCtx = useOptionalChartState()

	/* width/height arrive after layout; gate body on Show so it re-evaluates
	   once dimensions populate. Setup-time snapshot would freeze at undefined.
	   See GOTCHA-011. */
	const width = createMemo(() => useChartWidth())
	const height = createMemo(() => useChartHeight())

	return (
		<Show when={width() != null && height() != null}>
			{(() => {
				const w = width() as number
				const h = height() as number
				const outerRadius = props.outerRadius ?? Math.min(w, h) / 2
	const cx = props.cx ?? w / 2
	const cy = props.cy ?? h / 2

	const rScale = scaleLinear(
		[0, (props.data as Record<string, unknown>)[props.dataKey] as number],
		[0, props.endAngle],
	)
	const treeDepth = getMaxDepthOf(props.data)
	const thickness = (outerRadius - props.innerRadius) / treeDepth

	const sectors: JSX.Element[] = []
	const positions: SunburstPositionMap = new Map<string, ChartCoordinate>([])

	/* event handlers */
	function handleMouseEnter(node: SunburstNode, e: MouseEvent) {
		if (props.onMouseEnter) props.onMouseEnter(node, e)

		const hoverPayload = {
			active: true,
			coordinate: positions.get(node.name),
			dataKey: props.dataKey,
			graphicalItemId: props.id,
			index: node.tooltipIndex,
		}
		if (newCtx != null) setTooltipInteraction(newCtx.setState, "itemInteraction", "hover", hoverPayload)
	}

	function handleMouseLeave(node: SunburstNode, e: MouseEvent) {
		if (props.onMouseLeave) props.onMouseLeave(node, e)

		newCtx?.setState("tooltip", "itemInteraction", "hover", "active", false)
	}

	function handleClick(node: SunburstNode) {
		if (props.onClick) props.onClick(node)

		const clickPayload = {
			active: true,
			coordinate: positions.get(node.name),
			dataKey: props.dataKey,
			graphicalItemId: props.id,
			index: node.tooltipIndex,
		}
		if (newCtx != null) setTooltipInteraction(newCtx.setState, "itemInteraction", "click", clickPayload)
	}

	/* recursively add nodes for each data point and its children */
	function drawArcs(
		childNodes: SunburstData[] | undefined,
		arcOptions: DrawArcOptions,
		depth: number = 1,
	): void {
		const { radius, innerR, initialAngle, childColor, nestedActiveTooltipIndex } = arcOptions

		let currentAngle = initialAngle

		if (childNodes == null) return

		childNodes.forEach((d, i) => {
			const currentTooltipIndex =
				depth === 1 ? `[${i}]` : addToSunburstNodeIndex(i, nestedActiveTooltipIndex)
			const nodeWithIndex: SunburstNode = { ...d, tooltipIndex: currentTooltipIndex }

			const arcLength = rScale((d as Record<string, unknown>)[props.dataKey] as number)
			const start = currentAngle
			/* color priority - if there's a color on the individual point use that, otherwise use parent color or default */
			const fillColor = d?.fill ?? childColor ?? props.fill
			const { x: textX, y: textY } = polarToCartesian(
				0,
				0,
				innerR + radius / 2,
				-(start + arcLength - arcLength / 2),
			)
			currentAngle += arcLength
			/* GOTCHA-016-C: bind both enter/leave AND over/out, dedupe per-instance. */
			const fireEnter = (e: MouseEvent) => {
				if (!hover.enter(e)) return
				handleMouseEnter(nodeWithIndex, e)
			}
			const fireLeave = (e: MouseEvent) => {
				if (!hover.leave(e)) return
				handleMouseLeave(nodeWithIndex, e)
			}
			sectors.push(
				<g>
					<Sector
						onClick={() => handleClick(nodeWithIndex)}
						onMouseEnter={fireEnter}
						onMouseOver={fireEnter}
						onMouseLeave={fireLeave}
						onMouseOut={fireLeave}
						fill={fillColor}
						stroke={props.stroke}
						stroke-width={props.padding}
						startAngle={start}
						endAngle={start + arcLength}
						innerRadius={innerR}
						outerRadius={innerR + radius}
						cx={cx}
						cy={cy}
					/>
					<Text
						{...props.textOptions}
						alignment-baseline="middle"
						text-anchor="middle"
						x={textX + cx}
						y={cy - textY}
					>
						{String((d as Record<string, unknown>)[props.dataKey])}
					</Text>
				</g>,
			)

			const { x: tooltipX, y: tooltipY } = polarToCartesian(cx, cy, innerR + radius / 2, start)
			positions.set(d.name, { x: tooltipX, y: tooltipY })

			return drawArcs(
				d.children,
				{
					childColor: fillColor,
					initialAngle: start,
					innerR: innerR + radius + props.ringPadding,
					nestedActiveTooltipIndex: currentTooltipIndex,
					radius,
				},
				depth + 1,
			)
		})
	}

	drawArcs(props.data.children, {
		initialAngle: props.startAngle,
		innerR: props.innerRadius,
		radius: thickness,
	})

	const layerClass = clsx("recharts-sunburst", props.class)
	return (
		<Surface width={w} height={h}>
			<Layer class={layerClass}>{sectors}</Layer>
			<SetSunburstTooltipEntrySettings
				dataKey={props.dataKey}
				nameKey={props.nameKey}
				data={props.data}
				stroke={props.stroke}
				fill={props.fill}
				positions={positions}
				id={props.id}
			/>
			{props.children}
		</Surface>
	)
			})()}
		</Show>
	)
}

/**
 * The sunburst is a hierarchical chart, similar to a Treemap, plotted in polar coordinates.
 * Sunburst charts effectively convey the hierarchical relationships and proportions within each level.
 * It is easy to see all the middle layers in the hierarchy, which might get lost in other visualizations.
 * For some datasets, the radial layout may be more visually appealing and intuitive than a traditional Treemap.
 *
 * @consumes ResponsiveContainerContext
 * @provides TooltipEntrySettings
 */
export function SunburstChart(outsideProps: SunburstChartProps): JSX.Element {
	/* GOTCHA-005-B: split children before resolveDefaultProps spread + before child spread,
	   so user JSX (Tooltip, Customized, etc.) gets instantiated inside RechartsWrapper. */
	const [childrenSplit, restProps] = splitProps(outsideProps, ["children"])
	const props = resolveDefaultProps(restProps, defaultSunburstChartProps)
	return (
		<RechartsStateProvider
			preloadedState={{
				...preloadedState,
				layout: untrack(() =>
					createInitialLayoutState({ height: props.height, margin: defaultSunburstMargin, width: props.width }),
				),
			}}
		>
			<ReportChartSize width={props.width} height={props.height} />
			<ReportChartMargin margin={defaultSunburstMargin} />
			<ReportEventSettings
				throttleDelay={props.throttleDelay}
				throttledEvents={props.throttledEvents}
			/>
			<RechartsWrapper
				class={props.class}
				width={props.width}
				height={props.height}
				responsive={props.responsive}
				style={props.style}
				onMouseEnter={undefined}
				onMouseLeave={undefined}
				onClick={undefined}
				onMouseMove={undefined}
				onMouseDown={undefined}
				onMouseUp={undefined}
				onContextMenu={undefined}
				onDoubleClick={undefined}
				onTouchStart={undefined}
				onTouchMove={undefined}
				onTouchEnd={undefined}
			>
				<RegisterGraphicalItemId id={props.id} type="sunburst">
					{(id) => (
						<SunburstChartImpl {...props} id={id}>
							{childrenSplit.children}
						</SunburstChartImpl>
					)}
				</RegisterGraphicalItemId>
			</RechartsWrapper>
		</RechartsStateProvider>
	)
}
