/* eslint-disable import/no-cycle */
import { createEffect, createMemo, mergeProps, Show, type JSX } from "solid-js"
import { BarePortal } from "../util/BarePortal"
import {
	DefaultTooltipContent,
	type NameType,
	type Payload,
	type Props as DefaultTooltipContentProps,
	type TooltipItemSorter,
	type ValueType,
} from "./DefaultTooltipContent"
import { TooltipBoundingBox } from "./TooltipBoundingBox"

import { getUniqPayload, type UniqueOption } from "../util/payload/getUniqPayload"
import type {
	AllowInDimension,
	AnimationDuration,
	AnimationTiming,
	Coordinate,
} from "../util/types"
import { useViewBox } from "../context/chartLayoutContext"
import { useAccessibilityLayer } from "../context/accessibilityContext"
import { useElementOffset } from "../util/useElementOffset"
import { Cursor, type CursorDefinition } from "./Cursor"
import {
	selectActiveCoordinate,
	selectActiveLabel,
	selectIsTooltipActive,
	selectTooltipPayload,
} from "../state/selectors/selectors"
import { useTooltipPortal } from "../context/tooltipPortalContext"
import type { TooltipTrigger } from "../chart/types"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/useChartState"
import type {
	TooltipIndex,
	TooltipPayload,
	TooltipPayloadEntry,
	TooltipSettingsState,
} from "../state/tooltipSlice"
import type { AxisId } from "../state/cartesianAxisSlice"
import { useTooltipChartSynchronisation } from "../synchronisation/useChartSynchronisation"
import { selectTooltipEventType } from "../state/selectors/selectTooltipEventType"

export type ContentType<TValue extends ValueType = ValueType, TName extends NameType = NameType> =
	| JSX.Element
	| ((props: TooltipContentProps<TValue, TName>) => JSX.Element)

function defaultUniqBy(entry: Payload<ValueType, NameType>) {
	return entry.dataKey
}

export type TooltipContentProps<
	TValue extends ValueType = ValueType,
	TName extends NameType = NameType,
> = TooltipProps<TValue, TName> & {
	label?: string | number
	payload: TooltipPayload
	coordinate: Coordinate | undefined
	active: boolean
	accessibilityLayer: boolean
	activeIndex: TooltipIndex | undefined
}

function renderContent<TValue extends ValueType, TName extends NameType>(
	content: ContentType<TValue, TName> | undefined,
	contentProps: TooltipContentProps,
): JSX.Element {
	if (typeof content === "function") {
		return (content as (p: TooltipContentProps) => JSX.Element)(contentProps)
	}

	if (content != null) {
		return content as JSX.Element
	}

	return <DefaultTooltipContent {...contentProps} />
}

type PropertiesReadFromContext =
	| "viewBox"
	| "active"
	| "payload"
	| "coordinate"
	| "label"
	| "accessibilityLayer"

export type TooltipProps<
	TValue extends ValueType = ValueType,
	TName extends NameType = NameType,
> = Omit<DefaultTooltipContentProps<TValue, TName>, PropertiesReadFromContext> & {
	/**
	 * If true, then Tooltip is always displayed, once an activeIndex is set by mouse over, or programmatically.
	 * If false, then Tooltip is never displayed.
	 * If undefined, Recharts will control when the Tooltip displays. This includes mouse and keyboard controls.
	 */
	active?: boolean
	/**
	 * This option allows the tooltip to extend beyond the viewBox of the chart itself.
	 * @defaultValue {"x":false,"y":false}
	 */
	allowEscapeViewBox?: AllowInDimension
	/**
	 * Specifies the duration of animation, the unit of this option is ms.
	 * @defaultValue 400
	 */
	animationDuration?: AnimationDuration
	/**
	 * The type of easing function.
	 * @defaultValue ease
	 */
	animationEasing?: AnimationTiming
	/**
	 * Tooltip always attaches itself to the "Tooltip" axis. Which axis is it? Depends on the layout:
	 * - horizontal layout -> X axis
	 * - vertical layout -> Y axis
	 * - radial layout -> radial axis
	 * - centric layout -> angle axis
	 *
	 * Tooltip will use the default axis for the layout, unless you specify an axisId.
	 *
	 * @defaultValue 0
	 */
	axisId?: AxisId
	/**
	 * Renders the content of the tooltip.
	 *
	 * This should return HTML elements, not SVG elements.
	 *
	 * - If not set, the {@link DefaultTooltipContent} component is used.
	 * - If set to a JSX element, that element will be rendered.
	 * - If set to a function, the function will be called and should return HTML elements.
	 *
	 * @see {@link https://recharts.github.io/en-US/examples/CustomContentOfTooltip/ Example with custom content}
	 */
	content?: ContentType<TValue, TName>
	/**
	 * The style of tooltip content which is a dom element.
	 * @defaultValue {}
	 */
	contentStyle?: JSX.CSSProperties
	/**
	 * If set false, no cursor will be drawn when tooltip is active.
	 * If set a object, the option is the configuration of cursor.
	 * If set a JSX element, the option is the custom element of drawing cursor.
	 * @defaultValue true
	 */
	cursor?: CursorDefinition
	defaultIndex?: number | TooltipIndex
	/**
	 * When an item of the payload has value null or undefined, this item won't be displayed.
	 * @defaultValue true
	 */
	filterNull?: boolean
	/**
	 * Function to customize the value in the tooltip.
	 * If you return an array, the first entry will be the formatted "value", and the second entry will be the formatted "name"
	 */
	formatter?: (
		value: TValue,
		name: TName,
		item: TooltipPayloadEntry,
		index: number,
		payload: TooltipPayload,
	) => JSX.Element | [JSX.Element, JSX.Element]
	/**
	 * If true, the tooltip will display information about hidden series.
	 * Defaults to false.
	 * Interacting with the hide property of Area, Bar, Line, Scatter.
	 *
	 * @defaultValue false
	 */
	includeHidden?: boolean | undefined
	/**
	 * If set false, animation of tooltip will be disabled.
	 * If set "auto", the animation will be disabled in SSR and enabled in browser.
	 * @defaultValue auto
	 */
	isAnimationActive?: boolean | "auto"
	/**
	 * Sorts tooltip items.
	 * Defaults to 'name' which means it sorts alphabetically by graphical item `name` property.
	 * @defaultValue name
	 */
	itemSorter?: TooltipItemSorter
	/**
	 * The style of default tooltip content item which is a li element.
	 * @defaultValue {}
	 */
	itemStyle?: JSX.CSSProperties
	/**
	 * The formatter function of label in tooltip.
	 */
	labelFormatter?: (label: unknown, payload: TooltipPayload) => JSX.Element
	/**
	 * The style of default tooltip label which is a p element.
	 * @defaultValue {}
	 */
	labelStyle?: JSX.CSSProperties
	/**
	 * The offset size between the position of tooltip and the mouse cursor position.
	 * When a number is provided, the same offset is applied to both x and y axes.
	 *
	 * When a Coordinate object is provided, you can specify different offsets for each axis (x and y as numbers)
	 * @defaultValue 10
	 */
	offset?: number | Coordinate
	payloadUniqBy?: UniqueOption<TooltipPayloadEntry>
	/**
	 * If portal is defined, then Tooltip will use this element as a target
	 * for rendering using Solid Portal.
	 *
	 * If this is undefined then Tooltip renders inside the recharts-wrapper element.
	 */
	portal?: HTMLElement | null
	/**
	 * If this field is set, the tooltip will be displayed at the specified position
	 * regardless of the mouse position.
	 *
	 * You can set a single field (x or y) and let the other field be calculated automatically based
	 * on the mouse position.
	 */
	position?: Partial<Coordinate>
	/**
	 * @defaultValue {"x":false,"y":false}
	 */
	reverseDirection?: AllowInDimension
	/**
	 * The separator between name and value.
	 * @defaultValue ' : '
	 */
	separator?: string
	/**
	 * Defines whether the tooltip is reacting to the current data point,
	 * or to all data points at the current axis coordinate.
	 *
	 * - `true`: tooltip will appear on top of all bars on an axis tick.
	 * - `false`: tooltip will appear on individual bars.
	 *
	 * Different chart types allow different modes, and have different defaults.
	 *
	 * @see {@link https://github.com/recharts/recharts/wiki/Tooltip-event-type-and-shared-prop Tooltip event type and shared prop wiki page}
	 */
	shared?: boolean
	/**
	 * If `hover` then the Tooltip shows on mouse enter and hides on mouse leave.
	 *
	 * If `click` then the Tooltip shows after clicking and stays active.
	 *
	 * @defaultValue hover
	 */
	trigger?: TooltipTrigger
	/**
	 * @defaultValue false
	 */
	useTranslate3d?: boolean
	/**
	 * CSS styles to be applied to the wrapper `div` element.
	 */
	wrapperStyle?: JSX.CSSProperties
}

const emptyPayload: TooltipPayload = []

export const defaultTooltipProps = {
	allowEscapeViewBox: { x: false, y: false },
	animationDuration: 400,
	animationEasing: "ease",
	axisId: 0,
	contentStyle: {},
	cursor: true,
	filterNull: true,
	includeHidden: false,
	isAnimationActive: "auto",
	itemSorter: "name",
	itemStyle: {},
	labelStyle: {},
	offset: 10,
	reverseDirection: { x: false, y: false },
	separator: " : ",
	trigger: "hover",
	useTranslate3d: false,
	wrapperStyle: {},
} as const satisfies Partial<TooltipProps>

/**
 * The Tooltip component displays a floating box with data values when hovering over or clicking on chart elements.
 *
 * It can be configured to show information for individual data points or for all points at a specific axis coordinate.
 * The appearance and content of the tooltip can be customized via props.
 *
 * @see {@link https://github.com/recharts/recharts/wiki/Tooltip-event-type-and-shared-prop Tooltip event type and shared prop wiki page}
 * @see {@link https://recharts.github.io/en-US/guide/activeIndex/ Active index replacement when migrating from Recharts v2 to v3}
 *
 * @consumes CartesianChartContext
 * @consumes PolarChartContext
 * @consumes TooltipEntrySettings
 */
export function Tooltip(outsideProps: TooltipProps<ValueType, NameType>) {
	/* mergeProps preserves the reactive props proxy; resolveDefaultProps would freeze
	   `payload`/`active`/etc. as snapshots and leak the children getter through the
	   spread, breaking GOTCHA-005-C and GOTCHA-006-E semantics. */
	const props = mergeProps(defaultTooltipProps, outsideProps) as TooltipProps<ValueType, NameType> &
		typeof defaultTooltipProps

	const ctx = useChartStore()
	const newCtx = useOptionalChartState()
	const defaultIndexAsString = (): string | null | undefined =>
		typeof props.defaultIndex === "number" ? String(props.defaultIndex) : props.defaultIndex

	createEffect(() => {
		/* Write only defined active so ChartState initial `active:false` is preserved
		   when Tooltip mounts without an explicit `active` prop. */
		const newSettingsUpdate: Partial<TooltipSettingsState> = {
			axisId: props.axisId,
			defaultIndex: props.defaultIndex as TooltipIndex | undefined,
			shared: props.shared,
			trigger: props.trigger,
		}
		if (props.active !== undefined) newSettingsUpdate.active = props.active
		newCtx?.setState("tooltip", "settings", newSettingsUpdate as TooltipSettingsState)
	})

	const viewBox = () => useViewBox()
	const accessibilityLayer = () => useAccessibilityLayer()
	const tooltipEventType = createMemo(() =>
		ctx ? selectTooltipEventType(ctx.store, props.shared) : undefined,
	)

	/* selectTooltipState (D27 full merge) now handles new-state-first for all
	   interaction subtrees — ctx.store already reflects the merged view. */
	const tooltipActiveResult = createMemo((): { isActive: boolean; activeIndex: TooltipIndex | null } => {
		return (
			(ctx?.store
				? selectIsTooltipActive(ctx.store, tooltipEventType(), props.trigger, defaultIndexAsString())
				: undefined) ?? { activeIndex: null, isActive: false }
		)
	})

	const payloadFromRedux = createMemo(() =>
		ctx?.store
			? selectTooltipPayload(ctx.store, tooltipEventType(), props.trigger, defaultIndexAsString())
			: undefined,
	)

	const labelFromRedux = createMemo(() =>
		ctx?.store
			? selectActiveLabel(ctx.store, tooltipEventType(), props.trigger, defaultIndexAsString())
			: undefined,
	)

	const coordinate = createMemo((): Coordinate | undefined =>
		ctx?.store
			? selectActiveCoordinate(ctx.store, tooltipEventType(), props.trigger, defaultIndexAsString())
			: undefined,
	)

	const tooltipPortalFromContext = useTooltipPortal()

	/*
	 * The user can set `active=true` on the Tooltip in which case the Tooltip will stay always active,
	 * or `active=false` in which case the Tooltip never shows.
	 *
	 * If the `active` prop is not defined then it will show and hide based on mouse or keyboard activity.
	 */
	const finalIsActive = (): boolean => props.active ?? tooltipActiveResult().isActive ?? false
	const activeIndex = () => tooltipActiveResult().activeIndex

	const finalLabel = () => (tooltipEventType() === "axis" ? labelFromRedux() : undefined)

	/* eslint-disable-next-line solid/reactivity -- tooltipEventType and coordinate are createMemo accessors passed by reference, not invoked here */
	useTooltipChartSynchronisation(
		tooltipEventType,
		() => props.trigger,
		coordinate,
		finalLabel,
		activeIndex,
		finalIsActive,
	)

	const tooltipPortal = () => props.portal ?? tooltipPortalFromContext()

	const finalPayload = createMemo((): TooltipPayload => {
		let fp: TooltipPayload = payloadFromRedux() ?? emptyPayload
		if (!finalIsActive()) {
			fp = emptyPayload
		}

		if (props.filterNull && fp.length) {
			fp = getUniqPayload(
				fp.filter(
					(entry) => entry.value != null && (entry.hide !== true || props.includeHidden),
				),
				props.payloadUniqBy,
				defaultUniqBy,
			)
		}
		return fp
	})

	const hasPayload = () => finalPayload().length > 0

	/* Re-measure tooltip box whenever payload or active flips. Mirrors React's
	   useElementOffset([payload, finalIsActive]) — without these deps the bounding
	   box is read once at mount (0×0 when hidden) and never updates, leaving the
	   tooltip stuck at top-left of the chart. */
	const [lastBoundingBox, updateBoundingBox] = useElementOffset(() => [
		finalPayload(),
		finalIsActive(),
	])

	const tooltipContentProps = (): TooltipContentProps => ({
		...props,
		accessibilityLayer: accessibilityLayer(),
		active: finalIsActive(),
		activeIndex: activeIndex(),
		coordinate: coordinate(),
		label: finalLabel(),
		payload: finalPayload(),
	})

	const isReady = createMemo(
		() => tooltipPortal() != null && viewBox() != null && tooltipEventType() != null,
	)

	return (
		<Show when={isReady()}>
			{/* Tooltip the HTML element renders through a Solid portal so that it escapes clipping, and it renders on top of everything else */}
			<BarePortal mount={tooltipPortal() ?? undefined}>
				<TooltipBoundingBox
					allowEscapeViewBox={props.allowEscapeViewBox}
					animationDuration={props.animationDuration}
					animationEasing={props.animationEasing}
					isAnimationActive={props.isAnimationActive}
					active={finalIsActive()}
					coordinate={coordinate()}
					hasPayload={hasPayload()}
					offset={props.offset}
					position={props.position}
					reverseDirection={props.reverseDirection}
					useTranslate3d={props.useTranslate3d}
					viewBox={viewBox() ?? { height: 0, width: 0, x: 0, y: 0 }}
					wrapperStyle={props.wrapperStyle}
					lastBoundingBox={lastBoundingBox()}
					innerRef={updateBoundingBox}
					hasPortalFromProps={Boolean(props.portal)}
				>
					{renderContent(props.content, tooltipContentProps())}
				</TooltipBoundingBox>
			</BarePortal>
			<Show when={finalIsActive() && tooltipEventType()}>
				{(eventType) => (
					<Cursor
						cursor={props.cursor}
						tooltipEventType={eventType()}
						coordinate={coordinate()}
						payload={finalPayload()}
						index={activeIndex()}
					/>
				)}
			</Show>
		</Show>
	)
}
