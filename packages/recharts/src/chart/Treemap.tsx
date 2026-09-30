/* eslint-disable import/no-cycle, sort-keys */
import { createMemo, createSignal, For, Show, splitProps, type JSX } from "solid-js"
import omit from "es-toolkit/compat/omit"
import get from "es-toolkit/compat/get"

import { Layer } from "../container/Layer"
import { Surface } from "../container/Surface"
import { Polygon } from "../shape/Polygon"
import { Rectangle } from "../shape/Rectangle"
import { getValueByDataKey } from "../util/ChartUtils"
import { COLOR_PANEL } from "../util/Constants"
import { isNan, noop } from "../util/DataUtils"
import { getStringSize } from "../util/DOMUtils"
import type {
	AnimationDuration,
	AnimationTiming,
	Coordinate,
	DataConsumer,
	DataKey,
	EventThrottlingProps,
	Margin,
	Percent,
	RectanglePosition,
} from "../util/types"
import { ReportChartMargin, useChartHeight, useChartWidth } from "../context/chartLayoutContext"
import { RechartsWrapper } from "./RechartsWrapper"
import type {
	TooltipIndex,
	TooltipPayloadConfiguration,
	TooltipPayloadSearcher,
} from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import type { ChartOptions } from "../state/optionsSlice"
import { RechartsStateProvider } from "../state/_solid/RechartsStateProvider"
import { RechartsStoreProvider } from "../state/RechartsStoreProvider"
import { ReportEventSettings } from "../state/ReportEventSettings"
import { useOptionalChartState } from "../state/_solid/useChartState"
import { isPositiveNumber } from "../util/isWellBehavedNumber"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { CSSTransitionAnimate } from "../animation/CSSTransitionAnimate"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import { initialEventSettingsState } from "../state/eventSettingsSlice"

const NODE_VALUE_KEY = "value"

/**
 * This is what end users defines as `data` on Treemap.
 */
export interface TreemapDataType {
	children?: ReadonlyArray<TreemapDataType>

	[key: string]: unknown
}

/**
 * This is what is returned from `squarify`, the final treemap data structure
 * that gets rendered and is stored in
 */
export interface TreemapNode {
	children: ReadonlyArray<TreemapNode> | null
	value: number
	depth: number
	index: number
	x: number
	y: number
	width: number
	height: number
	name: string
	tooltipIndex: TooltipIndex
	root?: TreemapNode

	[k: string]: unknown
}

function isTreemapNode(value: unknown): value is TreemapNode {
	return (
		value != null &&
		typeof value === "object" &&
		"x" in value &&
		"y" in value &&
		"width" in value &&
		"height" in value &&
		typeof value.x === "number" &&
		typeof value.y === "number" &&
		typeof value.width === "number" &&
		typeof value.height === "number"
	)
}

export const treemapPayloadSearcher: TooltipPayloadSearcher = (
	data: unknown,
	activeIndex: TooltipIndex,
): TreemapNode | undefined => {
	if (data == null || activeIndex == null) {
		return undefined
	}
	return get(data, activeIndex)
}

export const addToTreemapNodeIndex = (
	indexInChildrenArr: number,
	activeTooltipIndexSoFar: TooltipIndex | undefined = "",
): TooltipIndex => {
	return `${activeTooltipIndexSoFar}children[${indexInChildrenArr}]`
}

const chartOptions: ChartOptions = {
	chartName: "Treemap",
	defaultTooltipEventType: "item",
	eventEmitter: undefined,
	tooltipPayloadSearcher: treemapPayloadSearcher,
	validateTooltipEventTypes: ["item"],
}

export const computeNode = <DataPointType extends TreemapDataType, DataValueType>({
	depth,
	node,
	index,
	dataKey,
	nameKey,
	nestedActiveTooltipIndex,
}: {
	depth: number
	node: TreemapNode
	index: number
	dataKey: DataKey<DataPointType, DataValueType>
	nameKey: DataKey<DataPointType, DataValueType>
	nestedActiveTooltipIndex?: TooltipIndex | undefined
}): TreemapNode => {
	const currentTooltipIndex =
		depth === 0 ? "" : addToTreemapNodeIndex(index, nestedActiveTooltipIndex)
	const { children } = node
	const childDepth = depth + 1
	const computedChildren =
		children && children.length
			? children.map((child: TreemapNode, i: number) =>
					computeNode({
						dataKey,
						depth: childDepth,
						index: i,
						nameKey,
						nestedActiveTooltipIndex: currentTooltipIndex,
						node: child,
					}),
				)
			: null
	let nodeValue: number

	if (computedChildren && computedChildren.length) {
		nodeValue = computedChildren.reduce(
			(result: number, child: TreemapNode) => result + child.value,
			0,
		)
	} else {
		/* TODO need to verify dataKey */
		const rawNodeValue = node[dataKey as string]
		const numericValue = typeof rawNodeValue === "number" ? rawNodeValue : 0
		nodeValue = isNan(numericValue) || numericValue <= 0 ? 0 : numericValue
	}

	return {
		...node,
		children: computedChildren,
		name: getValueByDataKey(
			node as Record<string, unknown>,
			nameKey as DataKey<unknown>,
			"",
		) as string,
		[NODE_VALUE_KEY]: nodeValue,
		depth,
		index,
		tooltipIndex: currentTooltipIndex,
	}
}

const filterRect = (node: TreemapNode): RectanglePosition => ({
	height: node.height,
	width: node.width,
	x: node.x,
	y: node.y,
})

type TreemapNodeWithArea = TreemapNode & { area: number }

/* Compute the area for each child based on value & scale. */
const getAreaOfChildren = (
	children: ReadonlyArray<TreemapNode>,
	areaValueRatio: number,
): ReadonlyArray<TreemapNodeWithArea> => {
	const ratio = areaValueRatio < 0 ? 0 : areaValueRatio

	return children.map((child: TreemapNode) => {
		const area = child[NODE_VALUE_KEY] * ratio

		return {
			...child,
			area: isNan(area) || area <= 0 ? 0 : area,
		}
	})
}

/* Computes the score for the specified row, as the worst aspect ratio. */
const getWorstScore = (
	row: AreaArray<TreemapNodeWithArea>,
	parentSize: number,
	aspectRatio: number,
): number => {
	const parentArea = parentSize * parentSize
	const rowArea = row.area * row.area
	const { min, max } = row.reduce(
		(result: { min: number; max: number }, child: TreemapNodeWithArea) => ({
			max: Math.max(result.max, child.area),
			min: Math.min(result.min, child.area),
		}),
		{ max: 0, min: Infinity },
	)

	return rowArea
		? Math.max(
				(parentArea * max * aspectRatio) / rowArea,
				rowArea / (parentArea * min * aspectRatio),
			)
		: Infinity
}

const horizontalPosition = (
	row: AreaArray<TreemapNodeWithArea>,
	parentSize: number,
	parentRect: RectanglePosition,
	isFlush: boolean,
): RectanglePosition => {
	let rowHeight = parentSize ? Math.round(row.area / parentSize) : 0

	if (isFlush || rowHeight > parentRect.height) {
		rowHeight = parentRect.height
	}

	let curX = parentRect.x
	let child
	for (let i = 0, len = row.length; i < len; i++) {
		child = row[i]
		if (child == null) {
			continue
		}
		child.x = curX
		child.y = parentRect.y
		child.height = rowHeight
		child.width = Math.min(
			rowHeight ? Math.round(child.area / rowHeight) : 0,
			parentRect.x + parentRect.width - curX,
		)
		curX += child.width
	}
	/* add the remain x to the last one of row */
	if (child != null) {
		child.width += parentRect.x + parentRect.width - curX
	}

	return {
		...parentRect,
		height: parentRect.height - rowHeight,
		y: parentRect.y + rowHeight,
	}
}

const verticalPosition = (
	row: AreaArray<TreemapNodeWithArea>,
	parentSize: number,
	parentRect: RectanglePosition,
	isFlush: boolean,
): RectanglePosition => {
	let rowWidth = parentSize ? Math.round(row.area / parentSize) : 0

	if (isFlush || rowWidth > parentRect.width) {
		rowWidth = parentRect.width
	}

	let curY = parentRect.y
	let child
	for (let i = 0, len = row.length; i < len; i++) {
		child = row[i]
		if (child == null) {
			continue
		}
		child.x = parentRect.x
		child.y = curY
		child.width = rowWidth
		child.height = Math.min(
			rowWidth ? Math.round(child.area / rowWidth) : 0,
			parentRect.y + parentRect.height - curY,
		)
		curY += child.height
	}
	if (child) {
		child.height += parentRect.y + parentRect.height - curY
	}

	return {
		...parentRect,
		width: parentRect.width - rowWidth,
		x: parentRect.x + rowWidth,
	}
}

const position = (
	row: AreaArray<TreemapNodeWithArea>,
	parentSize: number,
	parentRect: RectanglePosition,
	isFlush: boolean,
): RectanglePosition => {
	if (parentSize === parentRect.width) {
		return horizontalPosition(row, parentSize, parentRect, isFlush)
	}

	return verticalPosition(row, parentSize, parentRect, isFlush)
}

type AreaArray<T> = Array<T> & { area: number }

/* Recursively arranges the specified node's children into squarified rows. */
const squarify = (node: TreemapNode, aspectRatio: number): TreemapNode => {
	const { children } = node

	if (children && children.length) {
		let rect: RectanglePosition = filterRect(node)
		const row = [] as unknown as AreaArray<TreemapNodeWithArea>
		let best = Infinity
		let child, score
		let size = Math.min(rect.width, rect.height)
		const scaleChildren = getAreaOfChildren(
			children,
			(rect.width * rect.height) / node[NODE_VALUE_KEY],
		)
		const tempChildren = scaleChildren.slice()

		/* why are we setting static properties on an array? */
		row.area = 0

		while (tempChildren.length > 0) {
			;[child] = tempChildren
			if (child == null) {
				continue
			}
			/* row first */
			row.push(child)
			row.area += child.area

			score = getWorstScore(row, size, aspectRatio)
			if (score <= best) {
				/* continue with this orientation */
				tempChildren.shift()
				best = score
			} else {
				/* abort, and try a different orientation */
				row.area -= row.pop()?.area ?? 0
				rect = position(row, size, rect, false)
				size = Math.min(rect.width, rect.height)
				row.length = row.area = 0
				best = Infinity
			}
		}

		if (row.length) {
			rect = position(row, size, rect, true)
			row.length = row.area = 0
		}

		return {
			...node,
			children: scaleChildren.map((c) => squarify(c, aspectRatio)),
		}
	}

	return node
}

export type TreemapContentType = JSX.Element | ((props: TreemapNode) => JSX.Element)

export interface Props<
	DataPointType extends TreemapDataType = TreemapDataType,
	DataValueType = unknown,
>
	extends DataConsumer<DataPointType, DataValueType>, EventThrottlingProps {
	/**
	 * The width of chart container.
	 * Can be a number or a percent string like "100%".
	 */
	width?: number | Percent

	/**
	 * The height of chart container.
	 * Can be a number or a percent string like "100%".
	 */
	height?: number | Percent

	/**
	 * The source data. Each element should be an object.
	 * The properties of each object represent the values of different data dimensions.
	 *
	 * Use the `dataKey` prop to specify which properties to use.
	 *
	 * If the `children` property is present on an element, it will be treated as a nested treemap.
	 */
	data?: ReadonlyArray<DataPointType>

	/**
	 * @deprecated unused prop, doesn't do anything, use `key` instead
	 */
	animationId?: number

	style?: JSX.CSSProperties

	/**
	 * The treemap will try to keep every single rectangle's aspect ratio near the aspectRatio given.
	 * @default 1.618033988749895
	 */
	aspectRatio?: number

	/**
	 * If set to a function, the function will be called to render the content.
	 */
	content?: TreemapContentType

	fill?: string

	stroke?: string

	class?: string

	/**
	 * Name represents each sector in the tooltip.
	 * This allows you to extract the name from the data:
	 *
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the name.
	 *
	 * @defaultValue 'name'
	 */
	nameKey?: DataKey<DataPointType, DataValueType>

	/**
	 * Decides how to extract the value of this Treemap from the data:
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the value of this Treemap.
	 *
	 * @defaultValue 'value'
	 */
	dataKey?: DataKey<DataPointType, DataValueType>

	children?: JSX.Element

	/**
	 * The type of treemap to render.
	 *
	 * - 'flat': Renders the entire treemap at once, with all leaf nodes visible.
	 * - 'nest': Renders an interactive, nested treemap. Clicking on a parent node will "zoom in" to show its children,
	 *   and a breadcrumb navigation will be displayed to allow navigating back up the hierarchy.
	 *
	 * @default 'flat'
	 */
	type?: "flat" | "nest"

	colorPanel?: ReadonlyArray<string>

	/* customize nest index content */
	nestIndexContent?: (item: TreemapNode, i: number) => JSX.Element

	/**
	 * The customized event handler of animation start
	 */
	onAnimationStart?: () => void

	/**
	 * The customized event handler of animation end
	 */
	onAnimationEnd?: () => void

	onMouseEnter?: (node: TreemapNode, e: MouseEvent) => void

	onMouseLeave?: (node: TreemapNode, e: MouseEvent) => void

	onClick?: (node: TreemapNode) => void

	/**
	 * If set false, animation of treemap will be disabled.
	 * If set "auto", the animation will be disabled in SSR and enabled in browser.
	 * @default 'auto'
	 */
	isAnimationActive?: boolean | "auto"

	isUpdateAnimationActive?: boolean | "auto"

	/**
	 * Specifies when the animation should begin, the unit of this option is ms.
	 * @default 0
	 */
	animationBegin?: number

	/**
	 * Specifies the duration of animation, the unit of this option is ms.
	 * @default 1500
	 */
	animationDuration?: AnimationDuration

	/**
	 * The type of easing function.
	 * @default 'linear'
	 */
	animationEasing?: AnimationTiming

	id?: string
}

type ContentItemProps = {
	id: GraphicalItemId
	content: TreemapContentType | undefined
	nodeProps: TreemapNode
	type: string
	colorPanel: ReadonlyArray<string> | undefined
	dataKey: DataKey<unknown>
	onClick?: (e: MouseEvent) => void
	onMouseEnter?: (e: MouseEvent) => void
	onMouseLeave?: (e: MouseEvent) => void
	onMouseOver?: (e: MouseEvent) => void
	onMouseOut?: (e: MouseEvent) => void
}

/* eslint-disable solid/reactivity -- ContentItem reads are structural checks at setup; props are stable per render since component is created fresh per node */
function ContentItem(props: ContentItemProps): JSX.Element {
	if (typeof props.content === "function") {
		return (
			<Layer
				onMouseEnter={props.onMouseEnter}
				onMouseOver={props.onMouseOver}
				onMouseLeave={props.onMouseLeave}
				onMouseOut={props.onMouseOut}
				onClick={props.onClick}
			>
				{(props.content as (p: TreemapNode) => JSX.Element)(props.nodeProps)}
			</Layer>
		)
	}
	/* optimize default shape */
	const { x, y, width, height, index } = props.nodeProps
	let arrow: JSX.Element | null = null
	if (width > 10 && height > 10 && props.nodeProps.children && props.type === "nest") {
		arrow = (
			<Polygon
				points={[
					{ x: x + 2, y: y + height / 2 },
					{ x: x + 6, y: y + height / 2 + 3 },
					{ x: x + 2, y: y + height / 2 + 6 },
				]}
			/>
		)
	}
	let text: JSX.Element | null = null
	const nameSize = getStringSize(props.nodeProps.name)
	if (width > 20 && height > 20 && nameSize.width < width && nameSize.height < height) {
		text = (
			<text x={x + 8} y={y + height / 2 + 7} font-size={String(14)}>
				{props.nodeProps.name}
			</text>
		)
	}

	const colors = props.colorPanel || COLOR_PANEL
	return (
		<g>
			<Rectangle
				fill={props.nodeProps.depth < 2 ? colors[index % colors.length] : "rgba(255,255,255,0)"}
				stroke="#fff"
				{...omit(props.nodeProps, ["children"])}
				onMouseEnter={props.onMouseEnter}
				onMouseOver={props.onMouseOver}
				onMouseLeave={props.onMouseLeave}
				onMouseOut={props.onMouseOut}
				onClick={props.onClick}
				data-recharts-item-index={props.nodeProps.tooltipIndex}
			/>
			{arrow}
			{text}
		</g>
	)
}
/* eslint-enable solid/reactivity */

function ContentItemWithEvents(props: ContentItemProps): JSX.Element {
	const newCtx = useOptionalChartState()
	/* GOTCHA-005: createMemo so reactive nodeProps flow into coordinate. */
	const activeCoordinate = createMemo<Coordinate>(() => ({
		x: props.nodeProps.x + props.nodeProps.width / 2,
		y: props.nodeProps.y + props.nodeProps.height / 2,
	}))

	/* GOTCHA-016-C: dedupe enter/over so user.hover only fires dispatch once. */
	let entered = false
	const fireEnter = () => {
		if (entered) return
		entered = true
		const hoverPayload = {
			active: true,
			coordinate: activeCoordinate(),
			dataKey: props.dataKey,
			graphicalItemId: props.id,
			index: props.nodeProps.tooltipIndex,
		}
		newCtx?.setState("tooltip", "itemInteraction", "hover", hoverPayload)
	}
	const fireLeave = () => {
		if (!entered) return
		entered = false
		/*
		 * clearing state on mouseLeaveItem causes re-rendering issues
		 * we don't actually want to do this for TreeMap - we clear state when we leave the entire chart instead
		 */
	}
	const onClick = () => {
		const clickPayload = {
			active: true,
			coordinate: activeCoordinate(),
			dataKey: props.dataKey,
			graphicalItemId: props.id,
			index: props.nodeProps.tooltipIndex,
		}
		newCtx?.setState("tooltip", "itemInteraction", "click", clickPayload)
	}
	return (
		<ContentItem
			{...props}
			onMouseEnter={fireEnter}
			onMouseOver={fireEnter}
			onMouseLeave={fireLeave}
			onMouseOut={fireLeave}
			onClick={onClick}
		/>
	)
}

function SetTreemapTooltipEntrySettings(props: {
	dataKey: DataKey<unknown>
	nameKey: DataKey<unknown>
	stroke: string | undefined
	fill: string | undefined
	currentRoot: TreemapNode | undefined
	id: GraphicalItemId
}): JSX.Element {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.currentRoot,
		getPosition: noop,
		settings: {
			color: props.fill,
			dataKey: props.dataKey,
			fill: props.fill,
			graphicalItemId: props.id,
			hide: false,
			name: undefined,
			nameKey: props.nameKey,
			stroke: props.stroke,
			strokeWidth: undefined,
			type: undefined,
			unit: "",
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

/* Why is margin not a treemap prop? No clue. Probably it should be */
const defaultTreemapMargin: Margin = {
	bottom: 0,
	left: 0,
	right: 0,
	top: 0,
}

export const defaultTreeMapProps = {
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "linear",
	aspectRatio: 0.5 * (1 + Math.sqrt(5)),
	dataKey: "value",
	isAnimationActive: "auto",
	isUpdateAnimationActive: "auto",
	nameKey: "name",
	type: "flat",
	...initialEventSettingsState,
} as const satisfies Partial<Props>

type InternalTreemapProps = RequiresDefaultProps<Props, typeof defaultTreeMapProps> & {
	width: number
	height: number
	id: GraphicalItemId
}

/* eslint-disable solid/reactivity -- itemProps.nodeProps destructure and treemapProps reads are stable at component setup; TreemapItem is created fresh per node */
function TreemapItem(itemProps: {
	content: TreemapContentType | undefined
	nodeProps: TreemapNode
	isLeaf: boolean
	treemapProps: InternalTreemapProps
	onNestClick: (node: TreemapNode) => void
}): JSX.Element {
	const { width, height, x, y } = itemProps.nodeProps
	const translateX = -x - width
	const translateY = 0

	const onMouseEnter = (e: MouseEvent) => {
		if (
			(itemProps.isLeaf || itemProps.treemapProps.type === "nest") &&
			typeof itemProps.treemapProps.onMouseEnter === "function"
		) {
			itemProps.treemapProps.onMouseEnter(itemProps.nodeProps, e)
		}
	}

	const onMouseLeave = (e: MouseEvent) => {
		if (
			(itemProps.isLeaf || itemProps.treemapProps.type === "nest") &&
			typeof itemProps.treemapProps.onMouseLeave === "function"
		) {
			itemProps.treemapProps.onMouseLeave(itemProps.nodeProps, e)
		}
	}

	const onClick = () => {
		if (itemProps.treemapProps.type === "nest") {
			itemProps.onNestClick(itemProps.nodeProps)
		}
		if (
			(itemProps.isLeaf || itemProps.treemapProps.type === "nest") &&
			typeof itemProps.treemapProps.onClick === "function"
		) {
			itemProps.treemapProps.onClick(itemProps.nodeProps)
		}
	}

	function handleAnimationEnd() {
		if (typeof itemProps.treemapProps.onAnimationEnd === "function") {
			itemProps.treemapProps.onAnimationEnd()
		}
	}

	function handleAnimationStart() {
		if (typeof itemProps.treemapProps.onAnimationStart === "function") {
			itemProps.treemapProps.onAnimationStart()
		}
	}

	return (
		<CSSTransitionAnimate
			animationId={`treemap-${itemProps.nodeProps.tooltipIndex}`}
			from={`translate(${translateX}px, ${translateY}px)`}
			to="translate(0, 0)"
			attributeName="transform"
			begin={itemProps.treemapProps.animationBegin}
			easing={itemProps.treemapProps.animationEasing}
			isActive={itemProps.treemapProps.isAnimationActive}
			duration={itemProps.treemapProps.animationDuration}
			onAnimationStart={handleAnimationStart}
			onAnimationEnd={handleAnimationEnd}
		>
			{(style) => (
				<Layer
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
					onClick={onClick}
					style={{ ...style, "transform-origin": `${x} ${y}` }}
				>
					<ContentItemWithEvents
						id={itemProps.treemapProps.id}
						content={itemProps.content}
						dataKey={itemProps.treemapProps.dataKey as DataKey<unknown>}
						nodeProps={{
							...itemProps.nodeProps,
							height,
							isAnimationActive: itemProps.treemapProps.isAnimationActive,
							isUpdateAnimationActive:
								itemProps.treemapProps.isUpdateAnimationActive === false ||
								itemProps.treemapProps.isUpdateAnimationActive === "auto",
							width,
							x,
							y,
						}}
						type={itemProps.treemapProps.type}
						colorPanel={itemProps.treemapProps.colorPanel}
					/>
				</Layer>
			)}
		</CSSTransitionAnimate>
	)
}
/* eslint-enable solid/reactivity */

function TreemapWithState(props: InternalTreemapProps): JSX.Element {
	const newCtx = useOptionalChartState()

	const [formatRoot, setFormatRoot] = createSignal<TreemapNode | null>(null)
	const [currentRoot, setCurrentRoot] = createSignal<TreemapNode | undefined>(undefined)
	const [nestIndex, setNestIndex] = createSignal<Array<TreemapNode>>([])

	/* Derived state: compute on data/type/width/height/dataKey/aspectRatio changes */
	const computed = createMemo(() => {
		const root: TreemapNode = computeNode({
			dataKey: props.dataKey,
			depth: 0,
			index: 0,
			nameKey: props.nameKey,
			node: {
				children: props.data,
				height: props.height,
				width: props.width,
				x: 0,
				y: 0,
			} as unknown as TreemapNode,
		})
		const fRoot: TreemapNode = squarify(root, props.aspectRatio)

		setFormatRoot(fRoot)
		setCurrentRoot(root)
		setNestIndex([root])

		return { currentRoot: root, formatRoot: fRoot }
	})

	function handleClick(node: TreemapNode) {
		if (props.type === "nest" && node.children) {
			const root = computeNode({
				depth: 0,
				node: { ...node, height: props.height, width: props.width, x: 0, y: 0 },
				index: 0,
				dataKey: props.dataKey,
				nameKey: props.nameKey,
				/* with Treemap nesting, should this continue nesting the index or start from empty string? */
				nestedActiveTooltipIndex: node.tooltipIndex,
			})

			const fRoot = squarify(root, props.aspectRatio)
			const currentNestIndex = nestIndex()
			setFormatRoot(fRoot)
			setCurrentRoot(root)
			setNestIndex([...currentNestIndex, node])
		}
		if (props.onClick) {
			props.onClick(node)
		}
	}

	function handleNestIndex(node: TreemapNode, i: number) {
		const root = computeNode({
			depth: 0,
			node: { ...node, height: props.height, width: props.width, x: 0, y: 0 },
			index: 0,
			dataKey: props.dataKey,
			nameKey: props.nameKey,
			/* with Treemap nesting, should this continue nesting the index or start from empty string? */
			nestedActiveTooltipIndex: node.tooltipIndex,
		})

		const fRoot = squarify(root, props.aspectRatio)

		setFormatRoot(fRoot)
		setCurrentRoot(node)
		setNestIndex(nestIndex().slice(0, i + 1))
	}

	function renderNode(root: TreemapNode, node: TreemapNode): JSX.Element | null {
		const nodeProps = { ...svgPropertiesNoEvents(props), ...node, root }
		const isLeaf = node.children == null || node.children.length === 0

		const curRoot = currentRoot()
		const isCurrentRootChild = (curRoot?.children || []).filter(
			(item: TreemapNode) => item.depth === node.depth && item.name === node.name,
		)

		if (isCurrentRootChild.length === 0 && root.depth && props.type === "nest") {
			return null
		}

		return (
			<Layer class={`recharts-treemap-depth-${node.depth}`}>
				<TreemapItem
					isLeaf={isLeaf}
					content={props.content}
					nodeProps={nodeProps}
					treemapProps={props}
					onNestClick={handleClick}
				/>
				<Show when={node.children && node.children.length}>
					<For each={node.children as TreemapNode[]}>
						{(child: TreemapNode) => renderNode(node, child)}
					</For>
				</Show>
			</Layer>
		)
	}

	function renderAllNodes(): JSX.Element | null {
		/* access reactive computation to ensure it's tracked */
		computed()
		const fRoot = formatRoot()

		if (fRoot == null) {
			return null
		}

		return renderNode(fRoot, fRoot)
	}

	/* render nest treemap */
	function renderNestIndex(): JSX.Element {
		/* eslint-disable solid/reactivity -- i() is the <For> index accessor; reads inside the For callback ARE tracked */
		return (
			<div
				class="recharts-treemap-nest-index-wrapper"
				style={{ "margin-top": "8px", "text-align": "center" }}
			>
				<For each={nestIndex()}>
					{(item: TreemapNode, i) => {
						/* TODO need to verify nameKey type */
						const rawName = get(item, props.nameKey as string, "root")
						const name: string = typeof rawName === "string" ? rawName : "root"
						let content: JSX.Element | string
						if (typeof props.nestIndexContent === "function") {
							content = props.nestIndexContent(item, i())
						} else {
							content = name
						}

						return (
							<div
								onClick={() => handleNestIndex(item, i())}
								class="recharts-treemap-nest-index-box"
								style={{
									background: "#000",
									color: "#fff",
									cursor: "pointer",
									display: "inline-block",
									"margin-right": "3px",
									padding: "0 7px",
								}}
							>
								{content}
							</div>
						)
					}}
				</For>
			</div>
		)
		/* eslint-enable solid/reactivity */
	}

	function handleTouchMove(e: TouchEvent) {
		const touchEvent = e.touches[0]
		if (touchEvent == null) {
			return
		}
		const target = document.elementFromPoint(touchEvent.clientX, touchEvent.clientY)
		if (target == null || typeof target.getAttribute !== "function" || formatRoot() == null) {
			return
		}
		const itemIndex = target.getAttribute("data-recharts-item-index")
		const activeNode: unknown = treemapPayloadSearcher(formatRoot(), itemIndex)
		if (isTreemapNode(activeNode) === false) {
			return
		}
		const treemapNode = activeNode as TreemapNode

		const activeCoordinate = {
			x: treemapNode.x + treemapNode.width / 2,
			y: treemapNode.y + treemapNode.height / 2,
		}

		const itemPayload = {
			active: true,
			coordinate: activeCoordinate,
			dataKey: props.dataKey as DataKey<unknown>,
			graphicalItemId: props.id,
			index: itemIndex,
		}
		newCtx?.setState("tooltip", "itemInteraction", "hover", itemPayload)
	}

	const attrs = () => svgPropertiesNoEvents(props)

	return (
		<>
			<SetTreemapTooltipEntrySettings
				dataKey={props.dataKey as DataKey<unknown>}
				nameKey={props.nameKey as DataKey<unknown>}
				stroke={props.stroke}
				fill={props.fill}
				currentRoot={currentRoot()}
				id={props.id}
			/>
			<Surface
				{...attrs()}
				width={props.width}
				height={props.type === "nest" ? props.height - 30 : props.height}
				onTouchMove={handleTouchMove}
			>
				{renderAllNodes()}
				{props.children}
			</Surface>
			<Show when={props.type === "nest"}>{renderNestIndex()}</Show>
		</>
	)
}

function TreemapDispatchInject(
	props: RequiresDefaultProps<Props, typeof defaultTreeMapProps> & { children?: JSX.Element },
): JSX.Element | null {
	/* width/height arrive after layout dispatch; gate on Show so the body
	   re-evaluates once dimensions populate. See GOTCHA-011. */
	const width = () => useChartWidth()
	const height = () => useChartHeight()
	const [childrenSplit, restProps] = splitProps(props, ["children"])
	return (
		<Show when={isPositiveNumber(width()) && isPositiveNumber(height())}>
			<RegisterGraphicalItemId id={restProps.id} type="treemap">
				{(id) => (
					<TreemapWithState
						{...restProps}
						id={id}
						width={width() as number}
						height={height() as number}
					>
						{childrenSplit.children}
					</TreemapWithState>
				)}
			</RegisterGraphicalItemId>
		</Show>
	)
}

/**
 * The Treemap chart is used to visualize hierarchical data using nested rectangles.
 *
 * @consumes ResponsiveContainerContext
 * @provides TooltipEntrySettings
 */
export function Treemap(outsideProps: Props): JSX.Element {
	/* GOTCHA-005-B: split children to avoid spread-induced enumeration that would
	   instantiate user JSX (Tooltip, etc.) under outer owner. */
	const [childrenSplit, restProps] = splitProps(outsideProps, ["children"])
	const props = resolveDefaultProps(restProps, defaultTreeMapProps)

	return (
		<RechartsStateProvider>
			<RechartsStoreProvider preloadedState={{ options: chartOptions }}>
			<ReportChartMargin margin={defaultTreemapMargin} />
			<ReportEventSettings
				throttleDelay={props.throttleDelay}
				throttledEvents={props.throttledEvents}
			/>
			<RechartsWrapper
				dispatchTouchEvents={false}
				class={props.class}
				style={props.style}
				width={props.width}
				height={props.height}
				/*
				 * Treemap has a bug where it doesn't include strokeWidth in its dimension calculation
				 * which makes the actual chart exactly {strokeWidth} larger than asked for.
				 * It's not a huge deal usually, but it makes the responsive option cycle infinitely.
				 */
				responsive={false}
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
				<TreemapDispatchInject {...props}>{childrenSplit.children}</TreemapDispatchInject>
			</RechartsWrapper>
			</RechartsStoreProvider>
		</RechartsStateProvider>
	)
}
