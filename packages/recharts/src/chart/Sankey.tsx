/* eslint-disable import/no-cycle, sort-keys */
import { batch, createMemo, For, Show, splitProps, type JSX } from "solid-js"
import maxBy from "es-toolkit/compat/maxBy"
import sumBy from "es-toolkit/compat/sumBy"
import get from "es-toolkit/compat/get"
import { Surface } from "../container/Surface"
import { Layer } from "../container/Layer"
import type { Props as RectangleProps } from "../shape/Rectangle"
import { Rectangle } from "../shape/Rectangle"
import { getValueByDataKey } from "../util/ChartUtils"
import type {
	Coordinate,
	DataKey,
	EventThrottlingProps,
	Margin,
	Percent,
	SankeyLink,
	SankeyNode,
} from "../util/types"
import {
	ReportChartMargin,
	ReportChartSize,
	useChartHeight,
	useChartWidth,
} from "../context/chartLayoutContext"
import { RechartsWrapper } from "./RechartsWrapper"
import { RechartsStateProvider } from "../state/RechartsStateProvider"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/useChartState"
import type {
	TooltipIndex,
	TooltipPayloadConfiguration,
	TooltipPayloadSearcher,
} from "../state/tooltipSlice"
import { SetTooltipEntrySettings } from "../state/SetTooltipEntrySettings"
import type { ChartOptions } from "../state/optionsSlice"
import { ReportEventSettings } from "../state/ReportEventSettings"
import { SetComputedData } from "../context/chartDataContext"
import {
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
} from "../util/svgPropertiesNoEvents"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { isPositiveNumber } from "../util/isWellBehavedNumber"
import { isNotNil, noop } from "../util/DataUtils"
import type { WithIdRequired } from "../util/useUniqueId"
import { RegisterGraphicalItemId } from "../context/RegisterGraphicalItemId"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"
import { initialEventSettingsState } from "../state/eventSettingsSlice"

const interpolationGenerator = (a: number, b: number) => {
	const ka = +a
	const kb = b - ka
	return (t: number) => ka + kb * t
}

const centerY = (node: SankeyNode) => node.y + node.dy / 2

/* TODO why is this not reading dataKey? */
const getValue = (entry: LinkDataItem | SankeyNode | undefined): number =>
	(entry && entry.value) || 0

const getSumOfIds = (links: ReadonlyArray<LinkDataItem>, ids: number[]): number =>
	ids.reduce((result, id) => result + getValue(links[id]), 0)

const getSumWithWeightedSource = (
	tree: ReadonlyArray<SankeyNode>,
	links: ReadonlyArray<LinkDataItemDy>,
	ids: number[],
) =>
	ids.reduce((result, id) => {
		const link = links[id]
		if (link == null) {
			return result
		}
		const sourceNode = tree[link.source]
		if (sourceNode == null) {
			return result
		}

		return result + centerY(sourceNode) * getValue(links[id])
	}, 0)

const getSumWithWeightedTarget = (
	tree: ReadonlyArray<SankeyNode>,
	links: ReadonlyArray<LinkDataItemDy>,
	ids: ReadonlyArray<number>,
): number =>
	ids.reduce((result: number, id: number) => {
		const link = links[id]
		if (link == null) {
			return result
		}
		const targetNode = tree[link.target]
		if (targetNode == null) {
			return result
		}

		return result + centerY(targetNode) * getValue(links[id])
	}, 0)

const ascendingY = (a: { y: number }, b: { y: number }) => a.y - b.y

const searchTargetsAndSources = (links: LinkDataItem[], id: number) => {
	const sourceNodes: number[] = []
	const sourceLinks: number[] = []
	const targetNodes: number[] = []
	const targetLinks: number[] = []

	for (let i = 0, len = links.length; i < len; i++) {
		const link = links[i]

		if (link?.source === id) {
			targetNodes.push(link.target)
			targetLinks.push(i)
		}

		if (link?.target === id) {
			sourceNodes.push(link.source)
			sourceLinks.push(i)
		}
	}

	return { sourceLinks, sourceNodes, targetLinks, targetNodes }
}

const updateDepthOfTargets = (tree: SankeyNode[], curNode: SankeyNode) => {
	const { targetNodes } = curNode

	for (let i = 0, len = targetNodes.length; i < len; i++) {
		const targetNode = targetNodes[i]
		if (targetNode == null) {
			continue
		}
		const target = tree[targetNode]

		if (target) {
			target.depth = Math.max(curNode.depth + 1, target.depth)

			updateDepthOfTargets(tree, target)
		}
	}
}

const getNodesTree = (
	{ nodes, links }: SankeyData,
	width: number,
	nodeWidth: number,
	align: "left" | "justify",
): { tree: SankeyNode[]; maxDepth: number } => {
	const tree: SankeyNode[] = nodes.map((entry: Record<string, unknown>, index: number) => {
		const result = searchTargetsAndSources(links, index)

		return {
			...entry,
			...result,
			depth: 0,
			value: Math.max(
				getSumOfIds(links, result.sourceLinks),
				getSumOfIds(links, result.targetLinks),
			),
		} as SankeyNode
	})

	for (let i = 0, len = tree.length; i < len; i++) {
		const node = tree[i]

		if (node != null && node.sourceNodes.length === 0) {
			updateDepthOfTargets(tree, node)
		}
	}
	const maxDepth = maxBy(tree, (entry: SankeyNode) => entry.depth)?.depth ?? 0

	if (maxDepth >= 1) {
		const childWidth = (width - nodeWidth) / maxDepth
		for (let i = 0, len = tree.length; i < len; i++) {
			const node = tree[i]
			if (node == null) {
				continue
			}

			if (node.targetNodes.length === 0) {
				if (align === "justify") {
					node.depth = maxDepth
				}
			}
			node.x = node.depth * childWidth
			node.dx = nodeWidth
		}
	}

	return { maxDepth, tree }
}

const getDepthTree = (tree: SankeyNode[]): SankeyNode[][] => {
	const result: SankeyNode[][] = []

	for (let i = 0, len = tree.length; i < len; i++) {
		const node = tree[i]
		if (node == null) {
			continue
		}

		if (result[node.depth] == null) {
			result[node.depth] = []
		}

		result[node.depth]?.push(node)
	}

	return result
}

type LinkDataItemDy = LinkDataItem & { dy: number }

type SankeyVerticalAlign = "justify" | "top"

const updateYOfTree = (
	depthTree: SankeyNode[][],
	height: number,
	nodePadding: number,
	links: ReadonlyArray<LinkDataItem>,
	verticalAlign: SankeyVerticalAlign,
): Array<LinkDataItemDy> => {
	const yRatio: number = Math.min(
		...depthTree.map(
			(nodes) => (height - (nodes.length - 1) * nodePadding) / sumBy(nodes, getValue),
		),
	)

	for (let d = 0, maxDepth = depthTree.length; d < maxDepth; d++) {
		const nodes = depthTree[d]
		if (nodes == null) {
			continue
		}

		if (verticalAlign === "top") {
			let currentY = 0
			for (let i = 0, len = nodes.length; i < len; i++) {
				const node = nodes[i]
				if (node == null) {
					continue
				}

				node.dy = node.value * yRatio
				node.y = currentY
				currentY += node.dy + nodePadding
			}
		} else {
			for (let i = 0, len = nodes.length; i < len; i++) {
				const node = nodes[i]
				if (node == null) {
					continue
				}

				node.y = i
				node.dy = node.value * yRatio
			}
		}
	}

	return links.map(
		(link: LinkDataItem): LinkDataItemDy => ({ ...link, dy: getValue(link) * yRatio }),
	)
}

const resolveCollisions = (
	depthTree: SankeyNode[][],
	height: number,
	nodePadding: number,
	sort = true,
) => {
	for (let i = 0, len = depthTree.length; i < len; i++) {
		const nodes = depthTree[i]
		if (nodes == null) {
			continue
		}
		const n = nodes.length

		/* Sort by the value of y */
		if (sort) {
			nodes.sort(ascendingY)
		}

		let y0 = 0
		for (let j = 0; j < n; j++) {
			const node = nodes[j]
			if (node == null) {
				continue
			}
			const dy = y0 - node.y

			if (dy > 0) {
				node.y += dy
			}

			y0 = node.y + node.dy + nodePadding
		}

		y0 = height + nodePadding
		for (let j = n - 1; j >= 0; j--) {
			const node = nodes[j]
			if (node == null) {
				continue
			}
			const dy = node.y + node.dy + nodePadding - y0

			if (dy > 0) {
				node.y -= dy
				y0 = node.y
			} else {
				break
			}
		}
	}
}

const relaxLeftToRight = (
	tree: ReadonlyArray<SankeyNode>,
	depthTree: SankeyNode[][],
	links: ReadonlyArray<LinkDataItemDy>,
	alpha: number,
) => {
	for (let i = 0, maxDepth = depthTree.length; i < maxDepth; i++) {
		const nodes = depthTree[i]
		if (nodes == null) {
			continue
		}

		for (let j = 0, len = nodes.length; j < len; j++) {
			const node = nodes[j]
			if (node == null) {
				continue
			}

			if (node.sourceLinks.length) {
				const sourceSum = getSumOfIds(links, node.sourceLinks)
				const weightedSum = getSumWithWeightedSource(tree, links, node.sourceLinks)
				const y = weightedSum / sourceSum

				node.y += (y - centerY(node)) * alpha
			}
		}
	}
}

const relaxRightToLeft = (
	tree: ReadonlyArray<SankeyNode>,
	/*
	 * depthTree array is modified by this method!
	 */
	depthTree: SankeyNode[][],
	links: ReadonlyArray<LinkDataItemDy>,
	alpha: number,
) => {
	for (let i = depthTree.length - 1; i >= 0; i--) {
		const nodes = depthTree[i]
		if (nodes == null) {
			continue
		}

		for (let j = 0, len = nodes.length; j < len; j++) {
			const node = nodes[j]
			if (node == null) {
				continue
			}

			if (node.targetLinks.length) {
				const targetSum = getSumOfIds(links, node.targetLinks)
				const weightedSum = getSumWithWeightedTarget(tree, links, node.targetLinks)
				const y = weightedSum / targetSum

				node.y += (y - centerY(node)) * alpha
			}
		}
	}
}

const updateYOfLinks = (tree: SankeyNode[], links: LinkDataItemDy[]): void => {
	for (let i = 0, len = tree.length; i < len; i++) {
		const node = tree[i]
		if (node == null) {
			continue
		}
		let sy = 0
		let ty = 0

		node.targetLinks.sort((a, b) => {
			const targetA = links[a]?.target
			const targetB = links[b]?.target
			if (targetA == null || targetB == null) {
				return 0
			}
			const yA = tree[targetA]?.y
			const yB = tree[targetB]?.y
			if (yA == null || yB == null) {
				return 0
			}
			return yA - yB
		})
		node.sourceLinks.sort((a, b) => {
			const sourceA = links[a]?.source
			const sourceB = links[b]?.source
			if (sourceA == null || sourceB == null) {
				return 0
			}
			const yA = tree[sourceA]?.y
			const yB = tree[sourceB]?.y
			if (yA == null || yB == null) {
				return 0
			}
			return yA - yB
		})

		for (let j = 0, tLen = node.targetLinks.length; j < tLen; j++) {
			const targetLink = node.targetLinks[j]
			if (targetLink == null) {
				continue
			}
			const link = links[targetLink]

			if (link) {
				/* updateYOfLinks modifies the links array to add sy in place */
				;(link as LinkDataItemDy & { sy: number }).sy = sy
				sy += link.dy
			}
		}

		for (let j = 0, sLen = node.sourceLinks.length; j < sLen; j++) {
			const sourceLink = node.sourceLinks[j]
			if (sourceLink == null) {
				continue
			}
			const link = links[sourceLink]

			if (link) {
				/* updateYOfLinks modifies the links array to add ty in place */
				;(link as LinkDataItemDy & { ty: number }).ty = ty
				ty += link.dy
			}
		}
	}
}

const computeData = ({
	data,
	width,
	height,
	iterations,
	nodeWidth,
	nodePadding,
	sort,
	verticalAlign,
	align,
}: {
	data: SankeyData
	width: number
	height: number
	iterations: number
	nodeWidth: number
	nodePadding: number
	sort: boolean
	verticalAlign: SankeyVerticalAlign
	align: "left" | "justify"
}): {
	nodes: ReadonlyArray<SankeyNode>
	links: ReadonlyArray<SankeyLink>
} => {
	const { links } = data
	const { tree } = getNodesTree(data, width, nodeWidth, align)
	const depthTree = getDepthTree(tree)
	const linksWithDy: Array<LinkDataItemDy> = updateYOfTree(
		depthTree,
		height,
		nodePadding,
		links,
		verticalAlign,
	)

	resolveCollisions(depthTree, height, nodePadding, sort)

	if (verticalAlign === "justify") {
		let alpha = 1
		for (let i = 1; i <= iterations; i++) {
			relaxRightToLeft(tree, depthTree, linksWithDy, (alpha *= 0.99))

			resolveCollisions(depthTree, height, nodePadding, sort)

			relaxLeftToRight(tree, depthTree, linksWithDy, alpha)

			resolveCollisions(depthTree, height, nodePadding, sort)
		}
	}

	updateYOfLinks(tree, linksWithDy)
	/* updateYOfLinks modifies the links array to add sy and ty in place */
	const newLinks: ReadonlyArray<SankeyLink> = linksWithDy as unknown as ReadonlyArray<SankeyLink>

	return { links: newLinks, nodes: tree }
}

const getNodeCoordinateOfTooltip = (item: NodeProps) => {
	return { x: +item.x + +item.width / 2, y: +item.y + +item.height / 2 }
}

const getLinkCoordinateOfTooltip = (item: LinkProps): Coordinate | undefined => {
	return "sourceX" in item
		? {
				x: (item.sourceX + item.targetX) / 2,
				y: (item.sourceY + item.targetY) / 2,
			}
		: undefined
}

type SankeyTooltipPayload = { payload: SankeyNode | SankeyLink; name: unknown; value: unknown }

const getPayloadOfTooltip = (
	item: { payload: SankeyNode | SankeyLink },
	type: SankeyElementType,
	nameKey: DataKey<SankeyLink | SankeyNode, string> | undefined,
): SankeyTooltipPayload | undefined => {
	const { payload } = item
	if (type === "node") {
		return {
			name: getValueByDataKey(payload, nameKey, ""),
			payload,
			value: getValueByDataKey(payload, "value"),
		}
	}
	if ("source" in payload && payload.source && payload.target) {
		const sourceObj = typeof payload.source === "object" ? (payload.source as SankeyNode) : null
		const targetObj = typeof payload.target === "object" ? (payload.target as SankeyNode) : null
		const sourceName = sourceObj ? getValueByDataKey(sourceObj, nameKey, "") : ""
		const targetName = targetObj ? getValueByDataKey(targetObj, nameKey, "") : ""

		return {
			name: `${sourceName} - ${targetName}`,
			payload,
			value: getValueByDataKey(payload, "value"),
		}
	}

	return undefined
}

export const sankeyPayloadSearcher: TooltipPayloadSearcher = (
	_: unknown,
	activeIndex: TooltipIndex,
	computedData?: unknown,
	nameKey?,
): SankeyTooltipPayload | undefined => {
	if (activeIndex == null || typeof activeIndex !== "string") {
		return undefined
	}
	if (computedData == null || typeof computedData !== "object") {
		return undefined
	}
	const splitIndex = activeIndex.split("-")
	const [targetType, index] = splitIndex
	const item = get(computedData, `${targetType}s[${index}]`)
	if (item) {
		const payload = getPayloadOfTooltip(
			item as { payload: SankeyNode | SankeyLink },
			targetType as SankeyElementType,
			nameKey as DataKey<SankeyLink | SankeyNode, string> | undefined,
		)
		return payload
	}
	return undefined
}

const options: ChartOptions = {
	chartName: "Sankey",
	defaultTooltipEventType: "item",
	eventEmitter: undefined,
	tooltipPayloadSearcher: sankeyPayloadSearcher,
	validateTooltipEventTypes: ["item"],
}

function SetSankeyTooltipEntrySettings(props: {
	dataKey: DataKey<unknown> | undefined
	nameKey: DataKey<unknown> | undefined
	stroke: string | undefined
	strokeWidth: number | string | undefined
	fill: string | undefined
	name: string | number | undefined
	data: SankeyData
	id: GraphicalItemId
}): JSX.Element {
	/* GOTCHA-005: createMemo so reactive props flow into the settings object. */
	const tooltipEntrySettings = createMemo<TooltipPayloadConfiguration>(() => ({
		dataDefinedOnItem: props.data,
		getPosition: noop,
		settings: {
			color: props.fill,
			dataKey: props.dataKey,
			fill: props.fill,
			graphicalItemId: props.id,
			hide: false,
			name: props.name,
			nameKey: props.nameKey,
			stroke: props.stroke,
			strokeWidth: props.strokeWidth,
			type: undefined,
			unit: "",
		},
	}))
	return <SetTooltipEntrySettings tooltipEntrySettings={tooltipEntrySettings()} />
}

interface LinkDataItem {
	source: number
	target: number
	value: number
}

export interface NodeProps {
	height: number
	width: number
	payload: SankeyNode
	index: number
	x: number
	y: number
	[key: string]: unknown
}

export interface LinkProps {
	sourceX: number
	targetX: number
	sourceY: number
	targetY: number
	sourceControlX: number
	targetControlX: number
	sourceRelativeY: number
	targetRelativeY: number
	linkWidth: number
	index: number
	/** payload is SankeyLink except source and target are now Node objects instead of numbers */
	payload: Omit<SankeyLink, "source" | "target"> & { source: SankeyNode; target: SankeyNode }
	[key: string]: unknown
}

export interface SankeyData {
	nodes: Record<string, unknown>[]
	links: LinkDataItem[]
}

export type SankeyNodeOptions = ((props: NodeProps) => JSX.Element) | RectangleProps

type SankeyLinkOptions = ((props: LinkProps) => JSX.Element) | JSX.PathSVGAttributes<SVGPathElement>

interface SankeyProps extends EventThrottlingProps {
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
	 * dataKey prop in Sankey defines which key in the link objects represents the value of the link _in Tooltip only_.
	 *
	 * Unlike other charts where dataKey is used to extract values from the data array, in Sankey charts,
	 * the value of each link is directly taken from the 'value' property of the link objects.
	 *
	 * @default 'value'
	 */
	dataKey?: DataKey<unknown>
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
	 * The source data, including the array of nodes, and the relationships, represented by links.
	 *
	 * Note that Sankey requires a specific data structure.
	 * Each node should have a unique index in the nodes array, and each link should reference these nodes by their indices.
	 * This is different from other chart types in Recharts, which accept arbitrary data.
	 *
	 * @example
	 * nodes: [
	 *   { name: 'Visit' },
	 *   { name: 'Direct-Favourite' },
	 *   { name: 'Page-Click' },
	 *   { name: 'Detail-Favourite' },
	 *   { name: 'Lost' },
	 * ],
	 * links: [
	 *   { source: 0, target: 1, value: 3728.3 },
	 *   { source: 0, target: 2, value: 354170 },
	 *   { source: 2, target: 3, value: 62429 },
	 *   { source: 2, target: 4, value: 291741 },
	 * ],
	 */
	data: SankeyData
	/**
	 * The padding between the nodes
	 * @default 10
	 */
	nodePadding?: number
	/**
	 * The width of node
	 * @default 10
	 */
	nodeWidth?: number
	/**
	 * The curvature of width
	 * @default 0.5
	 */
	linkCurvature?: number
	/**
	 * The number of the iterations between the links
	 * @default 32
	 */
	iterations?: number
	/**
	 * If set an object, the option is the configuration of nodes.
	 * If set a React element, the option is the custom react element of drawing the nodes.
	 *
	 * @example <Sankey node={MyCustomComponent} />
	 * @example <Sankey node={{stroke: #77c878, strokeWidth: 2}} />
	 */
	node?: SankeyNodeOptions
	/**
	 * If set an object, the option is the configuration of links.
	 * If set a React element, the option is the custom react element of drawing the links.
	 *
	 * @example <Sankey link={MyCustomComponent} />
	 * @example <Sankey link={{ fill: #77c878 }} />
	 */
	link?: SankeyLinkOptions
	style?: JSX.CSSProperties
	class?: string
	children?: JSX.Element
	/**
	 * Empty space around the container.
	 *
	 * @defaultValue {"top":5,"right":5,"bottom":5,"left":5}
	 */
	margin?: Partial<Margin>
	/**
	 * The customized event handler of click on the area in this group
	 */
	onClick?: (item: NodeProps | LinkProps, type: SankeyElementType, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseenter on the area in this group
	 */
	onMouseEnter?: (item: NodeProps | LinkProps, type: SankeyElementType, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave on the area in this group
	 */
	onMouseLeave?: (item: NodeProps | LinkProps, type: SankeyElementType, e: MouseEvent) => void
	/**
	 * Whether to sort the nodes on the y axis, or to display them as user-defined.
	 * @default true
	 */
	sort?: boolean
	/**
	 * Controls the vertical spacing of nodes within a depth. 'justify' distributes nodes evenly and balances link paths, while 'top' positions the group starting from the top edge of the chart.
	 * @default 'justify'
	 */
	verticalAlign?: SankeyVerticalAlign
	/**
	 * If set to 'justify', the start nodes will be aligned to the left edge of the chart and the end nodes will be aligned to the right edge of the chart. If set to 'left', the start nodes will be aligned to the left edge of the chart.
	 * @default 'justify'
	 */
	align?: "left" | "justify"
	stroke?: string
	strokeWidth?: number | string
	fill?: string
	name?: string | number
	id?: string
}

export type Props = SankeyProps

export type SankeyElementType = "node" | "link"

function renderLinkItem(
	option: SankeyLinkOptions | undefined,
	linkProps: LinkProps,
	events?: Record<string, ((e: Event) => void) | undefined>,
): JSX.Element {
	if (typeof option === "function") {
		return option(linkProps)
	}

	const {
		sourceX,
		sourceY,
		sourceControlX,
		targetX,
		targetY,
		targetControlX,
		linkWidth,
		...others
	} = linkProps

	return (
		<path
			class="recharts-sankey-link"
			d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
			fill="none"
			stroke="#333"
			stroke-width={linkWidth}
			stroke-opacity="0.2"
			{...svgPropertiesNoEvents(others)}
			{...(events ?? {})}
		/>
	)
}

const buildLinkProps = ({
	link,
	nodes,
	left,
	top,
	i,
	linkContent,
	linkCurvature,
}: {
	link: SankeyLink
	nodes: ReadonlyArray<SankeyNode>
	top: number
	left: number
	linkContent: SankeyLinkOptions | undefined
	i: number
	linkCurvature: number
}): LinkProps | undefined => {
	const { sy: sourceRelativeY, ty: targetRelativeY, dy: linkWidth } = link
	const sourceNode = nodes[link.source]
	const targetNode = nodes[link.target]
	if (sourceNode == null || targetNode == null) {
		return undefined
	}
	const sourceX = sourceNode.x + sourceNode.dx + left
	const targetX = targetNode.x + left
	const interpolationFunc = interpolationGenerator(sourceX, targetX)
	const sourceControlX = interpolationFunc(linkCurvature)
	const targetControlX = interpolationFunc(1 - linkCurvature)
	const sourceY = sourceNode.y + sourceRelativeY + linkWidth / 2 + top
	const targetY = targetNode.y + targetRelativeY + linkWidth / 2 + top

	const linkProps: LinkProps = {
		...svgPropertiesNoEventsFromUnknown(linkContent),
		index: i,
		linkWidth,
		payload: { ...link, source: sourceNode, target: targetNode },
		sourceControlX,
		sourceRelativeY,
		sourceX,
		sourceY,
		targetControlX,
		targetRelativeY,
		targetX,
		targetY,
	}

	return linkProps
}

function SankeyLinkElement(props: {
	graphicalItemId: GraphicalItemId
	props: LinkProps
	i: number
	linkContent: SankeyLinkOptions | undefined
	onMouseEnter: (linkProps: LinkProps, e: MouseEvent) => void
	onMouseLeave: (linkProps: LinkProps, e: MouseEvent) => void
	onClick: (linkProps: LinkProps, e: MouseEvent) => void
	dataKey: DataKey<unknown>
}): JSX.Element {
	/* eslint-disable solid/reactivity -- props.props and props.i are stable identifiers captured once at mount */
	const activeCoordinate = getLinkCoordinateOfTooltip(props.props)
	const activeIndex = `link-${props.i}`
	/* eslint-enable solid/reactivity */

	const ctx = useChartStore()
	const newCtx = useOptionalChartState()

	/* GOTCHA-016-C: bind both enter/leave AND over/out so fireEvent.mouseEnter, fireEvent.mouseOver, and user.hover all dispatch. Track per-instance entry state — `user.hover` fires mouseenter then mouseover; we dedupe by toggling once per real entry. */
	let entered = false
	const fireEnter = (e: MouseEvent) => {
		if (entered) return
		entered = true
		const hoverPayload = {
			active: true,
			coordinate: activeCoordinate,
			dataKey: props.dataKey,
			graphicalItemId: props.graphicalItemId,
			index: activeIndex,
		}
		newCtx?.setState("tooltip", "itemInteraction", "hover", hoverPayload)
		props.onMouseEnter(props.props, e)
	}
	const fireLeave = (e: MouseEvent) => {
		if (!entered) return
		entered = false
		newCtx?.setState("tooltip", "itemInteraction", "hover", "active", false)
		props.onMouseLeave(props.props, e)
	}
	const events = {
		onClick: (e: MouseEvent) => {
			const clickPayload = {
				active: true,
				coordinate: activeCoordinate,
				dataKey: props.dataKey,
				graphicalItemId: props.graphicalItemId,
				index: activeIndex,
			}
			newCtx?.setState("tooltip", "itemInteraction", "click", clickPayload)
			props.onClick(props.props, e)
		},
		onMouseEnter: fireEnter,
		onMouseOver: fireEnter,
		onMouseLeave: fireLeave,
		onMouseOut: fireLeave,
	}

	return (
		<Layer>
			{renderLinkItem(
				props.linkContent,
				props.props,
				events as unknown as Record<string, ((e: Event) => void) | undefined>,
			)}
		</Layer>
	)
}

function AllSankeyLinkElements(props: {
	graphicalItemId: GraphicalItemId
	modifiedLinks: ReadonlyArray<LinkProps>
	links: ReadonlyArray<SankeyLink>
	linkContent: SankeyLinkOptions | undefined
	onMouseEnter: (linkProps: LinkProps, e: MouseEvent) => void
	onMouseLeave: (linkProps: LinkProps, e: MouseEvent) => void
	onClick: (linkProps: LinkProps, e: MouseEvent) => void
	dataKey: DataKey<unknown>
}): JSX.Element {
	return (
		<Layer class="recharts-sankey-links">
			<For each={props.links as SankeyLink[]}>
				{(link: SankeyLink, i) => {
					const linkPropsItem = () => props.modifiedLinks[i()]
					return (
						<Show when={linkPropsItem()}>
							{(lp) => (
								<SankeyLinkElement
									graphicalItemId={props.graphicalItemId}
									props={lp()}
									linkContent={props.linkContent}
									i={i()}
									onMouseEnter={props.onMouseEnter}
									onMouseLeave={props.onMouseLeave}
									onClick={props.onClick}
									dataKey={props.dataKey}
								/>
							)}
						</Show>
					)
				}}
			</For>
		</Layer>
	)
}

function renderNodeItem(
	option: SankeyNodeOptions | undefined,
	nodeProps: NodeProps,
	events?: Record<string, ((e: Event) => void) | undefined>,
): JSX.Element {
	if (typeof option === "function") {
		return option(nodeProps)
	}

	return (
		<Rectangle
			class="recharts-sankey-node"
			fill="#0088fe"
			fill-opacity="0.8"
			{...svgPropertiesNoEvents(nodeProps)}
			{...(events ?? {})}
		/>
	)
}

const buildNodeProps = ({
	node,
	nodeContent,
	top,
	left,
	i,
}: {
	node: SankeyNode
	nodeContent: SankeyNodeOptions | undefined
	top: number
	left: number
	i: number
}): NodeProps => {
	const { x, y, dx, dy } = node
	const nodeProps: NodeProps = {
		...svgPropertiesNoEventsFromUnknown(nodeContent),
		height: dy,
		index: i,
		payload: node,
		width: dx,
		x: x + left,
		y: y + top,
	}
	return nodeProps
}

function NodeElement(props: {
	graphicalItemId: GraphicalItemId
	props: NodeProps
	nodeContent: SankeyNodeOptions | undefined
	i: number
	onMouseEnter: (nodeProps: NodeProps, e: MouseEvent) => void
	onMouseLeave: (nodeProps: NodeProps, e: MouseEvent) => void
	onClick: (nodeProps: NodeProps, e: MouseEvent) => void
	dataKey: DataKey<unknown>
}): JSX.Element {
	const ctx = useChartStore()
	const newCtx = useOptionalChartState()

	/* eslint-disable solid/reactivity -- props.props and props.i are stable identifiers captured once at mount */
	const activeCoordinate = getNodeCoordinateOfTooltip(props.props)
	const activeIndex = `node-${props.i}`
	/* eslint-enable solid/reactivity */

	/* GOTCHA-016-C: same pattern as SankeyLinkElement — bind both enter/leave AND over/out, dedupe via per-instance entry flag. */
	let entered = false
	const fireEnter = (e: MouseEvent) => {
		if (entered) return
		entered = true
		const hoverPayload = {
			active: true,
			coordinate: activeCoordinate,
			dataKey: props.dataKey,
			graphicalItemId: props.graphicalItemId,
			index: activeIndex,
		}
		newCtx?.setState("tooltip", "itemInteraction", "hover", hoverPayload)
		props.onMouseEnter(props.props, e)
	}
	const fireLeave = (e: MouseEvent) => {
		if (!entered) return
		entered = false
		newCtx?.setState("tooltip", "itemInteraction", "hover", "active", false)
		props.onMouseLeave(props.props, e)
	}
	const events = {
		onClick: (e: MouseEvent) => {
			const clickPayload = {
				active: true,
				coordinate: activeCoordinate,
				dataKey: props.dataKey,
				graphicalItemId: props.graphicalItemId,
				index: activeIndex,
			}
			newCtx?.setState("tooltip", "itemInteraction", "click", clickPayload)
			props.onClick(props.props, e)
		},
		onMouseEnter: fireEnter,
		onMouseOver: fireEnter,
		onMouseLeave: fireLeave,
		onMouseOut: fireLeave,
	}

	return (
		<Layer>
			{renderNodeItem(
				props.nodeContent,
				props.props,
				events as unknown as Record<string, ((e: Event) => void) | undefined>,
			)}
		</Layer>
	)
}

function AllNodeElements(props: {
	graphicalItemId: GraphicalItemId
	modifiedNodes: ReadonlyArray<NodeProps>
	nodeContent: SankeyNodeOptions | undefined
	onMouseEnter: (nodeProps: NodeProps, e: MouseEvent) => void
	onMouseLeave: (nodeProps: NodeProps, e: MouseEvent) => void
	onClick: (nodeProps: NodeProps, e: MouseEvent) => void
	dataKey: DataKey<unknown>
}): JSX.Element {
	return (
		<Layer class="recharts-sankey-nodes">
			<For each={props.modifiedNodes as NodeProps[]}>
				{(modifiedNode, i) => (
					<NodeElement
						graphicalItemId={props.graphicalItemId}
						props={modifiedNode}
						nodeContent={props.nodeContent}
						i={i()}
						onMouseEnter={props.onMouseEnter}
						onMouseLeave={props.onMouseLeave}
						onClick={props.onClick}
						dataKey={props.dataKey}
					/>
				)}
			</For>
		</Layer>
	)
}

export const sankeyDefaultProps = {
	align: "justify",
	dataKey: "value",
	iterations: 32,
	linkCurvature: 0.5,
	margin: { bottom: 5, left: 5, right: 5, top: 5 },
	nameKey: "name",
	nodePadding: 10,
	nodeWidth: 10,
	sort: true,
	verticalAlign: "justify",
	...initialEventSettingsState,
} as const satisfies Partial<Props>

type PropsWithResolvedDefaults = RequiresDefaultProps<Props, typeof sankeyDefaultProps>

type InternalSankeyProps = WithIdRequired<PropsWithResolvedDefaults>

function SankeyImpl(props: InternalSankeyProps): JSX.Element {
	const width = () => useChartWidth()
	const height = () => useChartHeight()

	const computed = createMemo(() => {
		const w = width()
		const h = height()
		if (w == null || h == null || w <= 0 || h <= 0 || props.data == null) {
			return {
				links: [] as SankeyLink[],
				modifiedLinks: [] as LinkProps[],
				modifiedNodes: [] as NodeProps[],
				nodes: [] as SankeyNode[],
			}
		}
		const contentWidth = w - (props.margin.left ?? 0) - (props.margin.right ?? 0)
		const contentHeight = h - (props.margin.top ?? 0) - (props.margin.bottom ?? 0)
		const result = computeData({
			align: props.align,
			data: props.data,
			height: contentHeight,
			iterations: props.iterations,
			nodePadding: props.nodePadding,
			nodeWidth: props.nodeWidth,
			sort: props.sort,
			verticalAlign: props.verticalAlign,
			width: contentWidth,
		})

		const top = props.margin.top || 0
		const left = props.margin.left || 0
		const newModifiedLinks = result.links
			.map((l, i) => {
				return buildLinkProps({
					i,
					left,
					link: l,
					linkContent: props.link,
					linkCurvature: props.linkCurvature,
					nodes: result.nodes,
					top,
				})
			})
			.filter(isNotNil)

		const newModifiedNodes = result.nodes.map((n, i) => {
			return buildNodeProps({
				i,
				left,
				node: n,
				nodeContent: props.node,
				top,
			})
		})

		return {
			links: result.links,
			modifiedLinks: newModifiedLinks,
			modifiedNodes: newModifiedNodes,
			nodes: result.nodes,
		}
	})

	function handleMouseEnter(item: NodeProps | LinkProps, type: SankeyElementType, e: MouseEvent) {
		if (props.onMouseEnter) {
			props.onMouseEnter(item, type, e)
		}
	}

	function handleMouseLeave(item: NodeProps | LinkProps, type: SankeyElementType, e: MouseEvent) {
		if (props.onMouseLeave) {
			props.onMouseLeave(item, type, e)
		}
	}

	function handleClick(item: NodeProps | LinkProps, type: SankeyElementType, e: MouseEvent) {
		if (props.onClick) {
			props.onClick(item, type, e)
		}
	}

	const attrs = () => svgPropertiesNoEvents(props)

	return (
		<Show
			when={
				isPositiveNumber(width()) &&
				isPositiveNumber(height()) &&
				props.data?.links &&
				props.data?.nodes
			}
		>
			<SetComputedData
				computedData={{ links: computed().modifiedLinks, nodes: computed().modifiedNodes }}
			/>
			<Surface {...attrs()} width={width() ?? 0} height={height() ?? 0}>
				{props.children}
				<AllSankeyLinkElements
					graphicalItemId={props.id}
					links={computed().links}
					modifiedLinks={computed().modifiedLinks}
					linkContent={props.link}
					dataKey={props.dataKey}
					onMouseEnter={(linkProps: LinkProps, e: MouseEvent) =>
						handleMouseEnter(linkProps, "link", e)
					}
					onMouseLeave={(linkProps: LinkProps, e: MouseEvent) =>
						handleMouseLeave(linkProps, "link", e)
					}
					onClick={(linkProps: LinkProps, e: MouseEvent) => handleClick(linkProps, "link", e)}
				/>
				<AllNodeElements
					graphicalItemId={props.id}
					modifiedNodes={computed().modifiedNodes}
					nodeContent={props.node}
					dataKey={props.dataKey}
					onMouseEnter={(nodeProps: NodeProps, e: MouseEvent) =>
						handleMouseEnter(nodeProps, "node", e)
					}
					onMouseLeave={(nodeProps: NodeProps, e: MouseEvent) =>
						handleMouseLeave(nodeProps, "node", e)
					}
					onClick={(nodeProps: NodeProps, e: MouseEvent) => handleClick(nodeProps, "node", e)}
				/>
			</Surface>
		</Show>
	)
}

/**
 * Flow diagram in which the width of the arrows is proportional to the flow rate.
 * It is typically used to visualize energy or material or cost transfers between processes.
 *
 * @consumes ResponsiveContainerContext
 * @provides TooltipEntrySettings
 */
export function Sankey(outsideProps: Props): JSX.Element {
	/* GOTCHA-005-B: do not spread {...props} into a deep child — that enumerates the
	   Solid props proxy and triggers `children` getter, which instantiates user JSX
	   (Tooltip, Customized, etc.) under the OUTER owner (no RechartsWrapper Provider
	   in scope). Strip children via splitProps and pass them as JSX so they're created
	   inside RechartsWrapper where TooltipPortalContext / LegendPortalContext live. */
	const [childrenSplit, restProps] = splitProps(outsideProps, ["children"])
	const props: PropsWithResolvedDefaults = resolveDefaultProps(restProps, sankeyDefaultProps)

	return (
		<RechartsStateProvider preloadedState={{ options }}>
			<ReportChartSize width={props.width} height={props.height} />
			<ReportChartMargin margin={props.margin} />
			<ReportEventSettings
				throttleDelay={props.throttleDelay}
				throttledEvents={props.throttledEvents}
			/>

			<RechartsWrapper
				class={props.class}
				style={props.style}
				width={props.width}
				height={props.height}
				/*
				 * Sankey, same as Treemap, suffers from overfilling the container
				 * and causing infinite render loops where the chart keeps growing.
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
				<RegisterGraphicalItemId id={props.id} type="sankey">
					{(id) => (
						<>
							<SetSankeyTooltipEntrySettings
								dataKey={props.dataKey}
								nameKey={props.nameKey}
								stroke={props.stroke}
								strokeWidth={props.strokeWidth}
								fill={props.fill}
								name={props.name}
								data={props.data}
								id={id}
							/>
							<SankeyImpl {...props} id={id}>
								{childrenSplit.children}
							</SankeyImpl>
						</>
					)}
				</RegisterGraphicalItemId>
			</RechartsWrapper>
		</RechartsStateProvider>
	)
}

Sankey.displayName = "Sankey"
