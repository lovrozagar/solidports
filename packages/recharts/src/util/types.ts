/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import type { NiceTicksAlgorithm } from "../state/cartesianAxisSlice"
import type { Props as DotProps } from "../shape/Dot"
import { AxisRange } from "../state/selectors/axisSelectors"
import { ExternalMouseEvents } from "../chart/types"
import { SyncMethod } from "../synchronisation/types"
import { isEventKey } from "./excludeEventProps"
import { DotPoint } from "../component/Dots"
import { camelizeSvgPropsForHandler, SVGPropsNoEvents } from "./svgPropertiesNoEvents"
import type { CamelCaseSVGAttrs } from "./CamelCaseSVGAttrs"
import { BaseValue } from "../cartesian/Area"
import { ImplicitLabelType } from "../component/Label"
import { CustomScaleDefinition } from "./scale/CustomScaleDefinition"
import { ChartData } from "../state/chartDataSlice"
import {
	XAxisOrientation,
	XAxisPadding,
	YAxisOrientation,
	YAxisPadding,
} from "../state/cartesianAxisSlice"
import { TextAnchor, TextVerticalAnchor } from "../component/Text"
import type { TickFormatter } from "../cartesian/CartesianAxis"
import { TextProps } from "../index"
import { TypedDataKey } from "./typedDataKey"

/**
 * Determines how values are stacked:
 *
 * - `none` is the default, it adds values on top of each other. No smarts. Negative values will overlap.
 * - `expand` make it so that the values always add up to 1 - so the chart will look like a rectangle.
 * - `wiggle` and `silhouette` tries to keep the chart centered.
 * - `sign` stacks positive values above zero and negative values below zero. Similar to `none` but handles negatives.
 * - `positive` ignores all negative values, and then behaves like \`none\`.
 *
 * @see {@link https://d3js.org/d3-shape/stack#stack-offsets}
 * (note that the `diverging` offset in d3 is named `sign` in recharts)
 *
 * @inline
 */
export type StackOffsetType = "sign" | "expand" | "none" | "wiggle" | "silhouette" | "positive"
export type CartesianLayout = "horizontal" | "vertical"
export type PolarLayout = "centric" | "radial"
/**
 * @deprecated use either `CartesianLayout` or `PolarLayout` instead.
 * Mixing both charts families leads to ambiguity in the type system.
 * These two layouts share very few properties, so it is best to keep them separate.
 */
export type LayoutType = CartesianLayout | PolarLayout
export type AxisType = "xAxis" | "yAxis" | "zAxis" | "angleAxis" | "radiusAxis"

/**
 * The type of axis.
 *
 * `category`: Treats data as distinct values.
 * Each value is in the same distance from its neighbors, regardless of their actual numeric difference.
 *
 * `number`: Treats data as continuous range.
 * Values that are numerically closer are placed closer together on the axis.
 *
 * `auto`: the type is inferred based on the chart layout.
 *
 * This is external type - users will provide this type in props.
 * Internally we will evaluate it to either 'category' or 'number' based on the layout,
 * before sending it to the store.
 *
 * @inline
 */
export type AxisDomainTypeInput = "number" | "category" | "auto"

/**
 * Individual axes are responsible for resolving the 'auto' type to either 'number' or 'category',
 * based on the chart layout and axis kind. Then they can start using this type.
 */
export type EvaluatedAxisDomainType = "number" | "category"

/**
 * Extracts values from data objects.
 *
 * @inline
 */
/* eslint-disable-next-line typescript-eslint/no-explicit-any -- recharts public API contract: DataValueType defaults to any so downstream charts can pass unconstrained value extractors without ceremony */
export type DataKey<DataPointType, DataValueType = any> = TypedDataKey<DataPointType, DataValueType>

/*
 * 1:1 React parity — upstream recharts API is camelCase (`fillOpacity`, `strokeWidth`)
 * but Solid's `JSX.SvgSVGAttributes` only declares kebab-case. `CamelCaseSVGAttrs`
 * is intersected so users may pass either form at the public chart-component surface.
 * Runtime rekeys camel → kebab via `SVG_CAMEL_TO_KEBAB`.
 */
/*
 * Solid's attribute types admit `false` (its `RemoveAttribute`) on string-valued SVG
 * attributes; React's `SVGProps` (the upstream contract) do not. Strip it there and keep
 * it on genuinely boolean attributes.
 */
export type WithoutRemoveFalse<A> = {
	[K in keyof A]: K extends "children" ? A[K] : string extends NonNullable<A[K]> ? Exclude<A[K], false> : A[K]
}

export type PresentationAttributesWithProps<P, T extends Element> = WithoutRemoveFalse<JSX.AriaAttributes> &
	DOMAttributesWithProps<P, T> &
	WithoutRemoveFalse<Omit<JSX.SvgSVGAttributes<T>, keyof DOMAttributesWithProps<P, T>>> &
	CamelCaseSVGAttrs

export type PresentationAttributesAdaptChildEvent<P, T extends Element> = WithoutRemoveFalse<JSX.AriaAttributes> &
	DOMAttributesAdaptChildEvent<P, T> &
	WithoutRemoveFalse<Omit<JSX.SvgSVGAttributes<T>, keyof DOMAttributesAdaptChildEvent<P, T>>> &
	CamelCaseSVGAttrs

/**
 * @inline
 */
export type SymbolType = "circle" | "cross" | "diamond" | "square" | "star" | "triangle" | "wye"

/**
 * @inline
 */
export type LegendType =
	| "circle"
	| "cross"
	| "diamond"
	| "line"
	| "plainline"
	| "rect"
	| "square"
	| "star"
	| "triangle"
	| "wye"
	| "none"
export type TooltipType = "none"

export type AllowInDimension = {
	x?: boolean
	y?: boolean
}

export interface Coordinate {
	x: number
	y: number
}

export interface NullableCoordinate {
	x: number | null
	y: number | null
}

export type RectangleCoordinate = {
	x1: number
	y1: number
	x2: number
	y2: number
}

export type RectanglePosition = {
	x: number
	y: number
	width: number
	height: number
}

/**
 * @deprecated do not use: too many properties, mixing too many concepts, cartesian and polar together, everything optional.
 * Instead, use either `Coordinate` or `PolarCoordinate`.
 */
export interface ChartCoordinate extends Coordinate {
	/* eslint-disable typescript-eslint/no-explicit-any -- axis runtime values are heterogeneous (BaseAxisWithScale | undefined | numeric); narrowing breaks Pie/Polar consumers */
	xAxis?: any
	yAxis?: any
	width?: any
	height?: any
	/* eslint-enable typescript-eslint/no-explicit-any */
	offset?: ChartOffsetInternal
	angle?: number
	radius?: number
	cx?: number
	cy?: number
	startAngle?: number
	endAngle?: number
	innerRadius?: number
	outerRadius?: number
}

export type PolarCoordinate = Coordinate & {
	angle: number
	startAngle: number
	endAngle: number
	clockWise: boolean
	cx: number
	cy: number
	innerRadius: number
	outerRadius: number
	radius: number
}

export const isPolarCoordinate = (c: Coordinate | PolarCoordinate): c is PolarCoordinate => {
	return "radius" in c && "startAngle" in c && "endAngle" in c
}

export type D3ScaleType =
	| "linear"
	| "pow"
	| "sqrt"
	| "log"
	| "symlog"
	| "identity"
	| "time"
	| "band"
	| "point"
	| "ordinal"
	| "quantile"
	| "quantize"
	| "utc"
	| "sequential"
	| "threshold"

/** Upstream name for the scale shortcut strings. */
export type RechartsScaleType = D3ScaleType

/**
 * String shortcuts for scale types.
 * In case none of these does what you want you can also provide your own scale function
 * @see {@link CustomScaleDefinition}
 */
export type ScaleType = "auto" | D3ScaleType

/*
 * Event Handler Types -- Solid uses native DOM events directly.
 * The P generic carries recharts-specific props passed to the handler alongside the event.
 */

type EventHandler<P, E extends Event> = {
	bivarianceHack(props: P, event: E): void
}["bivarianceHack"]

type GenericEventHandler<P> = EventHandler<P, Event>
type ClipboardEventHandler<P> = EventHandler<P, ClipboardEvent>
type CompositionEventHandler<P> = EventHandler<P, CompositionEvent>
type DragEventHandler<P> = EventHandler<P, DragEvent>
type FocusEventHandler<P> = EventHandler<P, FocusEvent>
type InputEventHandler<P> = EventHandler<P, InputEvent>
type KeyboardEventHandler<P> = EventHandler<P, KeyboardEvent>
/* currentTarget carries the element type, like React's `MouseEvent<T>`, so handlers can pass the event to getRelativeCoordinate. */
export type RechartsMouseEventHandler<P, T = Element> = EventHandler<P, MouseEvent & { currentTarget: T }>
type TouchEventHandler<P, T = Element> = EventHandler<P, TouchEvent & { currentTarget: T }>
type PointerEventHandler<P, T = Element> = EventHandler<P, PointerEvent & { currentTarget: T }>
type UIEventHandler<P> = EventHandler<P, UIEvent>
type WheelEventHandler<P> = EventHandler<P, WheelEvent>
type AnimationEventHandler<P> = EventHandler<P, AnimationEvent>
type TransitionEventHandler<P> = EventHandler<P, TransitionEvent>

export interface DOMAttributesWithProps<P, T extends Element> {
	children?: JSX.Element
	innerHTML?: string

	/* Clipboard Events */
	onCopy?: ClipboardEventHandler<P>
	onCut?: ClipboardEventHandler<P>
	onPaste?: ClipboardEventHandler<P>

	/* Composition Events */
	onCompositionEnd?: CompositionEventHandler<P>
	onCompositionStart?: CompositionEventHandler<P>
	onCompositionUpdate?: CompositionEventHandler<P>

	/* Focus Events */
	onFocus?: FocusEventHandler<P>
	onBlur?: FocusEventHandler<P>

	/* Form Events */
	onChange?: GenericEventHandler<P>
	onBeforeInput?: InputEventHandler<P>
	onInput?: InputEventHandler<P>
	onReset?: GenericEventHandler<P>
	onSubmit?: GenericEventHandler<P>
	onInvalid?: GenericEventHandler<P>

	/* Image Events */
	onLoad?: GenericEventHandler<P>
	onError?: GenericEventHandler<P>

	/* Keyboard Events */
	onKeyDown?: KeyboardEventHandler<P>
	onKeyPress?: KeyboardEventHandler<P>
	onKeyUp?: KeyboardEventHandler<P>

	/* Media Events */
	onAbort?: GenericEventHandler<P>
	onCanPlay?: GenericEventHandler<P>
	onCanPlayThrough?: GenericEventHandler<P>
	onDurationChange?: GenericEventHandler<P>
	onEmptied?: GenericEventHandler<P>
	onEncrypted?: GenericEventHandler<P>
	onEnded?: GenericEventHandler<P>
	onLoadedData?: GenericEventHandler<P>
	onLoadedMetadata?: GenericEventHandler<P>
	onLoadStart?: GenericEventHandler<P>
	onPause?: GenericEventHandler<P>
	onPlay?: GenericEventHandler<P>
	onPlaying?: GenericEventHandler<P>
	onProgress?: GenericEventHandler<P>
	onRateChange?: GenericEventHandler<P>
	onSeeked?: GenericEventHandler<P>
	onSeeking?: GenericEventHandler<P>
	onStalled?: GenericEventHandler<P>
	onSuspend?: GenericEventHandler<P>
	onTimeUpdate?: GenericEventHandler<P>
	onVolumeChange?: GenericEventHandler<P>
	onWaiting?: GenericEventHandler<P>

	/* Mouse Events */
	onAuxClick?: RechartsMouseEventHandler<P, T>
	onClick?: RechartsMouseEventHandler<P, T>
	onContextMenu?: RechartsMouseEventHandler<P, T>
	onDoubleClick?: RechartsMouseEventHandler<P, T>
	onDrag?: DragEventHandler<P>
	onDragEnd?: DragEventHandler<P>
	onDragEnter?: DragEventHandler<P>
	onDragExit?: DragEventHandler<P>
	onDragLeave?: DragEventHandler<P>
	onDragOver?: DragEventHandler<P>
	onDragStart?: DragEventHandler<P>
	onDrop?: DragEventHandler<P>
	/**
	 * The customized event handler of mousedown in this chart.
	 */
	onMouseDown?: RechartsMouseEventHandler<P, T>
	/**
	 * The customized event handler of mouseenter in this chart.
	 */
	onMouseEnter?: RechartsMouseEventHandler<P, T>
	/**
	 * The customized event handler of mouseleave in this chart.
	 */
	onMouseLeave?: RechartsMouseEventHandler<P, T>
	/**
	 * The customized event handler of mousemove in this chart.
	 */
	onMouseMove?: RechartsMouseEventHandler<P, T>
	/**
	 * The customized event handler of mouseout in this chart.
	 */
	onMouseOut?: RechartsMouseEventHandler<P, T>
	/**
	 * The customized event handler of mouseover in this chart.
	 */
	onMouseOver?: RechartsMouseEventHandler<P, T>
	/**
	 * The customized event handler of mouseup in this chart.
	 */
	onMouseUp?: RechartsMouseEventHandler<P, T>

	/* Selection Events */
	onSelect?: GenericEventHandler<P>

	/* Touch Events */
	onTouchCancel?: TouchEventHandler<P, T>
	onTouchEnd?: TouchEventHandler<P, T>
	onTouchMove?: TouchEventHandler<P, T>
	onTouchStart?: TouchEventHandler<P, T>

	/* Pointer Events */
	onPointerDown?: PointerEventHandler<P, T>
	onPointerMove?: PointerEventHandler<P, T>
	onPointerUp?: PointerEventHandler<P, T>
	onPointerCancel?: PointerEventHandler<P, T>
	onPointerEnter?: PointerEventHandler<P, T>
	onPointerLeave?: PointerEventHandler<P, T>
	onPointerOver?: PointerEventHandler<P, T>
	onPointerOut?: PointerEventHandler<P, T>
	onGotPointerCapture?: PointerEventHandler<P, T>
	onLostPointerCapture?: PointerEventHandler<P, T>

	/* UI Events */
	onScroll?: UIEventHandler<P>

	/* Wheel Events */
	onWheel?: WheelEventHandler<P>

	/* Animation Events */
	onAnimationStart?: AnimationEventHandler<P>
	onAnimationEnd?: AnimationEventHandler<P>
	onAnimationIteration?: AnimationEventHandler<P>

	/* Transition Events */
	onTransitionEnd?: TransitionEventHandler<P>
}

type AdaptChildEventHandler<P, E extends Event> = {
	bivarianceHack(data: P, index: number, event: E): void
}["bivarianceHack"]

type AdaptChildGenericEventHandler<P> = AdaptChildEventHandler<P, Event>
type AdaptChildClipboardEventHandler<P> = AdaptChildEventHandler<P, ClipboardEvent>
type AdaptChildCompositionEventHandler<P> = AdaptChildEventHandler<P, CompositionEvent>
type AdaptChildDragEventHandler<P> = AdaptChildEventHandler<P, DragEvent>
type AdaptChildFocusEventHandler<P> = AdaptChildEventHandler<P, FocusEvent>
type AdaptChildInputEventHandler<P> = AdaptChildEventHandler<P, InputEvent>
type AdaptChildKeyboardEventHandler<P> = AdaptChildEventHandler<P, KeyboardEvent>
type AdaptChildMouseEventHandler<P, T = Element> = AdaptChildEventHandler<P, MouseEvent & { currentTarget: T }>
type AdaptChildTouchEventHandler<P, T = Element> = AdaptChildEventHandler<P, TouchEvent & { currentTarget: T }>
type AdaptChildPointerEventHandler<P, T = Element> = AdaptChildEventHandler<P, PointerEvent & { currentTarget: T }>
type AdaptChildUIEventHandler<P> = AdaptChildEventHandler<P, UIEvent>
type AdaptChildWheelEventHandler<P> = AdaptChildEventHandler<P, WheelEvent>
type AdaptChildAnimationEventHandler<P> = AdaptChildEventHandler<P, AnimationEvent>
type AdaptChildTransitionEventHandler<P> = AdaptChildEventHandler<P, TransitionEvent>

export type DOMAttributesAdaptChildEvent<P, T extends Element> = {
	children?: JSX.Element
	innerHTML?: string

	/* Clipboard Events */
	onCopy?: AdaptChildClipboardEventHandler<P>
	onCut?: AdaptChildClipboardEventHandler<P>
	onPaste?: AdaptChildClipboardEventHandler<P>

	/* Composition Events */
	onCompositionEnd?: AdaptChildCompositionEventHandler<P>
	onCompositionStart?: AdaptChildCompositionEventHandler<P>
	onCompositionUpdate?: AdaptChildCompositionEventHandler<P>

	/* Focus Events */
	onFocus?: AdaptChildFocusEventHandler<P>
	onBlur?: AdaptChildFocusEventHandler<P>

	/* Form Events */
	onChange?: AdaptChildGenericEventHandler<P>
	onBeforeInput?: AdaptChildInputEventHandler<P>
	onInput?: AdaptChildInputEventHandler<P>
	onReset?: AdaptChildGenericEventHandler<P>
	onSubmit?: AdaptChildGenericEventHandler<P>
	onInvalid?: AdaptChildGenericEventHandler<P>

	/* Image Events */
	onLoad?: AdaptChildGenericEventHandler<P>
	onError?: AdaptChildGenericEventHandler<P>

	/* Keyboard Events */
	onKeyDown?: AdaptChildKeyboardEventHandler<P>
	onKeyPress?: AdaptChildKeyboardEventHandler<P>
	onKeyUp?: AdaptChildKeyboardEventHandler<P>

	/* Media Events */
	onAbort?: AdaptChildGenericEventHandler<P>
	onCanPlay?: AdaptChildGenericEventHandler<P>
	onCanPlayThrough?: AdaptChildGenericEventHandler<P>
	onDurationChange?: AdaptChildGenericEventHandler<P>
	onEmptied?: AdaptChildGenericEventHandler<P>
	onEncrypted?: AdaptChildGenericEventHandler<P>
	onEnded?: AdaptChildGenericEventHandler<P>
	onLoadedData?: AdaptChildGenericEventHandler<P>
	onLoadedMetadata?: AdaptChildGenericEventHandler<P>
	onLoadStart?: AdaptChildGenericEventHandler<P>
	onPause?: AdaptChildGenericEventHandler<P>
	onPlay?: AdaptChildGenericEventHandler<P>
	onPlaying?: AdaptChildGenericEventHandler<P>
	onProgress?: AdaptChildGenericEventHandler<P>
	onRateChange?: AdaptChildGenericEventHandler<P>
	onSeeked?: AdaptChildGenericEventHandler<P>
	onSeeking?: AdaptChildGenericEventHandler<P>
	onStalled?: AdaptChildGenericEventHandler<P>
	onSuspend?: AdaptChildGenericEventHandler<P>
	onTimeUpdate?: AdaptChildGenericEventHandler<P>
	onVolumeChange?: AdaptChildGenericEventHandler<P>
	onWaiting?: AdaptChildGenericEventHandler<P>

	/* Mouse Events */
	onAuxClick?: AdaptChildMouseEventHandler<P, T>
	onClick?: AdaptChildMouseEventHandler<P, T>
	onContextMenu?: AdaptChildMouseEventHandler<P, T>
	onDoubleClick?: AdaptChildMouseEventHandler<P, T>
	onDrag?: AdaptChildDragEventHandler<P>
	onDragEnd?: AdaptChildDragEventHandler<P>
	onDragEnter?: AdaptChildDragEventHandler<P>
	onDragExit?: AdaptChildDragEventHandler<P>
	onDragLeave?: AdaptChildDragEventHandler<P>
	onDragOver?: AdaptChildDragEventHandler<P>
	onDragStart?: AdaptChildDragEventHandler<P>
	onDrop?: AdaptChildDragEventHandler<P>
	onMouseDown?: AdaptChildMouseEventHandler<P, T>
	onMouseEnter?: AdaptChildMouseEventHandler<P, T>
	onMouseLeave?: AdaptChildMouseEventHandler<P, T>
	onMouseMove?: AdaptChildMouseEventHandler<P, T>
	onMouseOut?: AdaptChildMouseEventHandler<P, T>
	onMouseOver?: AdaptChildMouseEventHandler<P, T>
	onMouseUp?: AdaptChildMouseEventHandler<P, T>

	/* Selection Events */
	onSelect?: AdaptChildGenericEventHandler<P>

	/* Touch Events */
	onTouchCancel?: AdaptChildTouchEventHandler<P, T>
	onTouchEnd?: AdaptChildTouchEventHandler<P, T>
	onTouchMove?: AdaptChildTouchEventHandler<P, T>
	onTouchStart?: AdaptChildTouchEventHandler<P, T>

	/* Pointer Events */
	onPointerDown?: AdaptChildPointerEventHandler<P, T>
	onPointerMove?: AdaptChildPointerEventHandler<P, T>
	onPointerUp?: AdaptChildPointerEventHandler<P, T>
	onPointerCancel?: AdaptChildPointerEventHandler<P, T>
	onPointerEnter?: AdaptChildPointerEventHandler<P, T>
	onPointerLeave?: AdaptChildPointerEventHandler<P, T>
	onPointerOver?: AdaptChildPointerEventHandler<P, T>
	onPointerOut?: AdaptChildPointerEventHandler<P, T>
	onGotPointerCapture?: AdaptChildPointerEventHandler<P, T>
	onLostPointerCapture?: AdaptChildPointerEventHandler<P, T>

	/* UI Events */
	onScroll?: AdaptChildUIEventHandler<P>

	/* Wheel Events */
	onWheel?: AdaptChildWheelEventHandler<P>

	/* Animation Events */
	onAnimationStart?: AdaptChildAnimationEventHandler<P>
	onAnimationEnd?: AdaptChildAnimationEventHandler<P>
	onAnimationIteration?: AdaptChildAnimationEventHandler<P>

	/* Transition Events */
	onTransitionEnd?: AdaptChildTransitionEventHandler<P>
}

/**
 * The type of easing function to use for animations
 *
 * @inline
 */
export type AnimationTiming = "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear"
/** Specifies the duration of animation, the unit of this option is ms. */
export type AnimationDuration = number

export type OffsetVertical = {
	top: number
	bottom: number
}

export type OffsetHorizontal = {
	left: number
	right: number
}

/**
 * This object defines the offset of the chart area and width and height and brush and ... it's a bit too much information all in one.
 * We use it internally but let's not expose it to the outside world.
 * If you are looking for this information, instead import `ChartOffset` or `PlotArea` from `recharts`.
 */
export type ChartOffsetInternal = {
	top: number
	bottom: number
	left: number
	right: number
	width: number
	height: number
	brushBottom: number
}

export interface Padding {
	top: number
	bottom: number
	left: number
	right: number
}

export interface GeometrySector {
	cx: number
	cy: number
	innerRadius: number
	outerRadius: number
	startAngle: number
	endAngle: number
}

export type GeometrySectorWithCornerRadius = GeometrySector & {
	cornerRadius: number
	forceCornerRadius: boolean
	cornerIsExternal: boolean
}

export type AxisDomainItem =
	| string
	| number
	| ((d: number) => string | number)
	| "auto"
	| "dataMin"
	| "dataMax"

/**
 * The domain of axis.
 * This is the definition
 *
 * Numeric domain is always defined by an array of exactly two values, for the min and the max of the axis.
 * Categorical domain is defined as array of all possible values.
 *
 * Can be specified in many ways:
 * - array of numbers
 * - with special strings like 'dataMin' and 'dataMax'
 * - with special string math like 'dataMin - 100'
 * - with keyword 'auto'
 * - or a function
 * - array of functions
 * - or a combination of the above
 */
export type AxisDomain =
	| ReadonlyArray<string>
	| ReadonlyArray<number>
	| Readonly<[AxisDomainItem, AxisDomainItem]>
	| (([dataMin, dataMax]: NumberDomain, allowDataOverflow: boolean) => NumberDomain)

/**
 * NumberDomain is an evaluated {@link AxisDomain}.
 * Unlike {@link AxisDomain}, it has no variety - it's a tuple of two number.
 * This is after all the keywords and functions were evaluated and what is left is [min, max].
 *
 * Know that the min, max values are not guaranteed to be nice numbers - values like -Infinity or NaN are possible.
 *
 * There are also `category` axes that have different things than numbers in their domain.
 */
export type NumberDomain = readonly [min: number, max: number]

export type CategoricalDomainItem = number | string | Date

export type CategoricalDomain = ReadonlyArray<CategoricalDomainItem>

export type BaseTickContentProps = {
	angle: number
	className?: string
	fill: string | undefined
	height?: number | string
	index: number
	name?: string
	stroke: string
	payload: CartesianTickItem
	textAnchor: TextAnchor
	tickFormatter: TickFormatter | undefined
	verticalAnchor: TextVerticalAnchor
	visibleTicksCount: number
	width?: number | string
	x: number | string
	y: number | string
}

export type XAxisTickContentProps = BaseTickContentProps & {
	orientation: XAxisOrientation
	padding: XAxisPadding | undefined
}

export type YAxisTickContentProps = BaseTickContentProps & {
	orientation: YAxisOrientation
	padding: YAxisPadding | undefined
}

export type TickProp<T> = TextProps | JSX.Element | ((props: T) => JSX.Element) | boolean

export interface BaseAxisProps<DataPointType, DataValueType> extends DataConsumer<
	DataPointType,
	DataValueType
> {
	/**
	 * The type of axis.
	 *
	 * `category`: Treats data as distinct values.
	 * Each value is in the same distance from its neighbors, regardless of their actual numeric difference.
	 *
	 * `number`: Treats data as continuous range.
	 * Values that are numerically closer are placed closer together on the axis.
	 *
	 * `auto`: the type is inferred based on the chart layout.
	 */
	type?: AxisDomainTypeInput
	/**
	 * The name of data.
	 * This option will be used in tooltip.
	 * If no value was set to this option, the value of dataKey will be used alternatively.
	 */
	name?: string
	/**
	 * The unit of data. This option will be used in tooltip.
	 */
	unit?: string
	/**
	 * The data that you provide via the `data` prop is an array of objects.
	 * Each object can have multiple properties, each representing a different data dimension.
	 * Use the `dataKey` prop to specify which property (or dimension) to use for this component.
	 *
	 * Typically, you will want to have one dataKey on the X axis, and different dataKey on the Y axis,
	 * where they extract different values from the same data objects.
	 *
	 * Decides how to extract the value of this Axis from the data:
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the value of this Axis.
	 *
	 * If undefined, it will reuse the dataKey of graphical items.
	 */
	dataKey?: DataKey<DataPointType, DataValueType>
	/**
	 * Specify the domain of axis when the axis is a number axis.
	 *
	 * If undefined, then the domain is calculated based on the data and dataKeys.
	 *
	 * The length of domain should be 2, and we will validate the values in domain.
	 *
	 * Each element in the array can be a number, 'auto', 'dataMin', 'dataMax', a string like 'dataMin - 20', 'dataMax + 100',
	 * or a function that accepts a single argument and returns a number.
	 *
	 * If any element of domain is set to be 'auto', comprehensible scale ticks will be calculated, and the final domain of axis is generated by the ticks.
	 * If a function, receives '[dataMin, dataMax]', and must return a computed domain as '[min, max]'.
	 *
	 * @example <XAxis type="number" domain={['dataMin', 'dataMax']} />
	 * @example <XAxis type="number" domain={[0, 'dataMax']} />
	 * @example <XAxis type="number" domain={['auto', 'auto']} />
	 * @example <XAxis type="number" domain={[0, 'dataMax + 1000']} />
	 * @example <XAxis type="number" domain={['dataMin - 100', 'dataMax + 100']} />
	 * @example <XAxis type="number" domain={[dataMin => (0 - Math.abs(dataMin)), dataMax => (dataMax * 2)]} />
	 * @example <XAxis type="number" domain={([dataMin, dataMax]) => { const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax)); return [-absMax, absMax]; }} />
	 * @example <XAxis type="number" domain={[0, 100]} allowDataOverflow />
	 */
	domain?: AxisDomain
	/**
	 * Scale function determines how data values are mapped to visual values.
	 * In other words, decided the mapping between data domain and coordinate range.
	 *
	 * If undefined, or 'auto', the scale function is created internally according to the type of axis and data.
	 *
	 * You can define a custom scale, either as a string shortcut to a d3 scale, or as a complete scale definition object.
	 *
	 * @defaultValue auto
	 * @example <XAxis scale="log" />
	 * @example
	 * import { scaleLog } from 'd3-scale';
	 * const scale = scaleLog().base(Math.E);
	 * <YAxis scale={scale} />
	 */
	scale?:
		| ScaleType
		| CustomScaleDefinition
		| CustomScaleDefinition<string>
		| CustomScaleDefinition<number>
		| CustomScaleDefinition<Date>
}

/**
 * Props shared in all renderable axes - meaning the ones that are drawn on the chart,
 * can have ticks, axis line, etc.
 */
export interface RenderableAxisProps<DataPointType, DataValueType> extends BaseAxisProps<
	DataPointType,
	DataValueType
> {
	/**
	 * Tick text rotation angle in degrees.
	 * Positive values rotate clockwise, negative values rotate counterclockwise.
	 *
	 * @defaultValue 0
	 */
	angle?: number
	/**
	 * If set true, the axis do not display in the chart.
	 *
	 * @defaultValue false
	 */
	hide?: boolean
	/**
	 * Defines how the individual label text is rendered.
	 * This controls the settings for individual ticks; on a typical axis, there are multiple ticks, depending on your data.
	 *
	 * If you want to customize the overall axis label, use the `label` prop instead.
	 *
	 * Options:
	 * - `false`: Do not render any tick labels.
	 * - `true`: Render tick labels with default settings.
	 * - `object`: An object of props to be merged into the internally calculated tick props.
	 * - `JSX.Element`: A custom element to be used as the tick label.
	 * - `function`: A function that returns an element for custom rendering of tick labels.
	 *
	 * @defaultValue true
	 */
	tick?: TickProp<unknown>

	/**
	 * The count of axis ticks. Not used if 'type' is 'category'.
	 * @defaultValue 5
	 */
	tickCount?: number
	/**
	 * Controls how Recharts calculates "nice" tick values for this axis.
	 * Options: `'none'`, `'auto'`, `'adaptive'`, `'snap125'`.
	 * See {@link NiceTicksAlgorithm} for a full description of each option.
	 *
	 * @defaultValue 'auto'
	 * @since 3.8
	 */
	niceTicks?: NiceTicksAlgorithm
	/**
	 * Determines how the axis line is drawn. Options:
	 * - `true`: the axis line is drawn with default props;
	 * - `false`: the axis line is not visible;
	 * - `object`: passed as props to SVG `<line>` element representing the axis line.
	 *
	 * @defaultValue true
	 */
	axisLine?: boolean | JSX.LineSVGAttributes<SVGLineElement>

	/**
	 * If false set, tick lines will not be drawn.
	 * If true set, tick lines will be drawn which have the props calculated internally.
	 * If object set, tick lines will be drawn which have the props merged
	 * by the internal calculated props and the option.
	 * @defaultValue true
	 */
	tickLine?: boolean | JSX.LineSVGAttributes<SVGLineElement>
	/**
	 * The length of tick line.
	 * @defaultValue 6
	 */
	tickSize?: number
	/**
	 * The formatter function of tick.
	 */
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- tick value is heterogeneous across number/category/time axes; consumers narrow at use site */
	tickFormatter?: (value: any, index: number) => string
	/**
	 * When domain of the axis is specified and the type of the axis is 'number',
	 * if allowDataOverflow is set to be false,
	 * the domain will be adjusted when the minimum value of data is smaller than domain[0] or
	 * the maximum value of data is greater than domain[1] so that the axis displays all data values.
	 * If set to true, graphic elements (line, area, bars) will be clipped to conform to the specified domain.
	 *
	 * @defaultValue false
	 */
	allowDataOverflow?: boolean
	/**
	 * Allow the axis has duplicated categories or not when the type of axis is "category".
	 * @defaultValue true
	 */
	allowDuplicatedCategory?: boolean
	/**
	 * Allow the ticks of axis to be decimals or not.
	 *
	 * @defaultValue true
	 */
	allowDecimals?: boolean
	/**
	 * Ensures that all datapoints within a chart contribute to its domain calculation, even when they are hidden
	 * @defaultValue false
	 */
	includeHidden?: boolean
	/**
	 * @deprecated Recharts computes the range automatically based on chart width or height
	 *
	 * Recharts ignores this prop since 3.0
	 */
	range?: AxisRange
	/**
	 * Defines a single label for the whole axis.
	 * This prop renders one label in the center of the axis line.
	 * Useful for labeling the axis as a whole, like "Time (in seconds)" or "Distance (in meters)".
	 *
	 * This is not controlling tick labels.
	 * If you want to customize tick labels, please see `tickFormatter` or `tick` props.
	 *
	 * - `false`: no label is rendered
	 * - `string` | `number`: the content of the label
	 * - `object`: the props of LabelList component
	 * - `JSX.Element`: a custom label element
	 * - `function`: a render function of custom label
	 *
	 * @defaultValue false
	 */
	label?: ImplicitLabelType
	/** The HTML element's class name */
	className?: string
	/**
	 * If set to true, the ticks of this axis are reversed.
	 * @defaultValue false
	 */
	reversed?: boolean
}

/** Defines how ticks are placed and whether / how tick collisions are handled.
 * 'preserveStart' keeps the left tick on collision and ensures that the first tick is always shown.
 * 'preserveEnd' keeps the right tick on collision and ensures that the last tick is always shown.
 * 'preserveStartEnd' keeps the left tick on collision and ensures that the first and last ticks always show.
 * 'equidistantPreserveStart' selects a number N such that every nTh tick will be shown without collision.
 * 'equidistantPreserveEnd' selects a number N such that every nTh tick will be shown, ensuring the last tick is always visible.
 */
export type AxisInterval =
	| number
	| "preserveStart"
	| "preserveEnd"
	| "preserveStartEnd"
	| "equidistantPreserveStart"
	| "equidistantPreserveEnd"

/**
 * Ticks can be any type when the axis is the type of category.
 *
 * Ticks must be numbers when the axis is the type of number.
 */
export type AxisTick = number | string

export interface TickItem {
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- tick value runtime type matches axis type (number/string/Date); narrowing here forces casts at every consumer */
	value: any
	coordinate: number
	index: number
	/**
	 * How far this tick is offset from the start of a category band.
	 * On axes that do not have bands, this will always be zero.
	 *
	 * We never read offset internally in Recharts,
	 * but it has been part of the external API so let's keep it here for people who do use it.
	 */
	offset?: number
}

export interface CartesianTickItem extends TickItem {
	tickCoord?: number
	tickSize?: number
	isShow?: boolean
}

export interface Margin {
	top: number
	right: number
	bottom: number
	left: number
}

/**
 * @inline
 */
export interface CartesianViewBox {
	x?: number
	y?: number
	width?: number
	height?: number
}

export type CartesianViewBoxRequired = Required<CartesianViewBox>

interface PolarViewBox {
	cx?: number
	cy?: number
	innerRadius?: number
	outerRadius?: number
	startAngle?: number
	endAngle?: number
	clockWise?: boolean
}

export type PolarViewBoxRequired = Required<PolarViewBox>

export type TrapezoidViewBox = {
	/**
	 * The x-coordinate of the upper left corner of the trapezoid.
	 * If the upper side is shorter than the lower side, this will be the x-coordinate of the upper left corner,
	 * meaning that the X does take into account the varying width of the trapezoid.
	 */
	x: number
	/**
	 * The y-coordinate of the upper side of the trapezoid.
	 * Nothing exciting happening here.
	 */
	y: number
	/**
	 * The width of the upper side of the trapezoid.
	 */
	upperWidth: number
	/**
	 * The width of the lower side of the trapezoid.
	 */
	lowerWidth: number
	/**
	 * The overall width of the trapezoid: `Math.max(upperWidth, lowerWidth)`.
	 */
	width: number
	/**
	 * The height of the trapezoid.
	 */
	height: number
}

/**
 * @inline
 */
export type ViewBox = CartesianViewBoxRequired | PolarViewBoxRequired

type RecordString<T> = Record<string, T>

type AdaptEventHandlersReturn =
	| RecordString<(e?: Event) => unknown>
	| RecordString<(e: Event) => void>
	| null

export const adaptEventHandlers = (
	props: object | boolean,
	newHandler?: (e?: Event) => unknown,
): AdaptEventHandlersReturn => {
	if (typeof props === "function" || typeof props === "boolean") {
		return null
	}

	if (typeof props !== "object" || props === null) {
		return null
	}

	const inputProps = props as RecordString<unknown>

	const out: RecordString<(e: Event) => void> = {}

	/* User handler gets camelCase payload (className, fillOpacity, strokeWidth)
	 * to match upstream React parity. Capture values now while the runtime owner
	 * is set — at click time the owner is gone, so getters that resolve via
	 * `useContext` (e.g. `useChartLayout`) would return undefined. */
	const camelProps = camelizeSvgPropsForHandler(inputProps) as RecordString<unknown>

	Object.keys(inputProps).forEach((key) => {
		if (isEventKey(key) && typeof inputProps[key] === "function") {
			out[key] =
				newHandler ||
				((e: Event) => (inputProps[key] as (props: RecordString<unknown>, e: Event) => void)(camelProps, e))
		}
	})

	return out
}

const getEventHandlerOfChild =
	(originalHandler: (data: unknown, index: number, e: Event) => void, data: unknown, index: number) =>
	(e: Event): null => {
		originalHandler(data, index, e)

		return null
	}

export const adaptEventsOfChild = (
	props: RecordString<unknown>,
	data: unknown,
	index: number,
): RecordString<(e?: Event) => unknown> | null => {
	if (props === null || (typeof props !== "object" && typeof props !== "function")) {
		return null
	}

	let out: RecordString<(e: Event) => void> | null = null

	Object.keys(props).forEach((key: string) => {
		const item = (props as RecordString<unknown>)[key]

		if (isEventKey(key) && typeof item === "function") {
			if (out === null) out = {}

			out[key] = getEventHandlerOfChild(item as (data: unknown, index: number, e: Event) => void, data, index)
		}
	})

	return out
}

/**
 * 'axis' means that all graphical items belonging to this axis tick will be highlighted,
 * and all will be present in the tooltip.
 * Tooltip with 'axis' will display when hovering on the chart background.
 *
 * 'item' means only the one graphical item being hovered will show in the tooltip.
 * Tooltip with 'item' will display when hovering over individual graphical items.
 *
 * This is calculated internally;
 * charts have a `defaultTooltipEventType` and `validateTooltipEventTypes` options.
 *
 * Users then use <Tooltip shared={true} /> or <Tooltip shared={false} /> to control their preference,
 * and charts will then see what is allowed and what is not.
 */
export type TooltipEventType = "axis" | "item"

export interface SankeyNode {
	dx: number
	dy: number
	name: string
	value: number
	x: number
	y: number
	depth: number
	targetNodes: number[]
	targetLinks: number[]
	sourceNodes: number[]
	sourceLinks: number[]
}

export interface SankeyLink {
	target: number
	source: number
	value: number
	sy: number
	dy: number
	ty: number
}

export type Size = { width: number; height: number }

/**
 * These are the props we are going to pass to an `activeDot` or `dot` if it is a function or a custom Component
 */
export type ActiveDotProps = DotProps & {
	payload: unknown
	index: number
	dataKey: DataKey<unknown> | undefined
	cx: number | undefined
	cy: number | undefined
	r: number | string | undefined
	fill: string
	strokeWidth: number
	stroke: string
	value: unknown
}

/**
 * This is the type of `activeDot` prop on:
 * - Area
 * - Line
 * - Radar
 *
 * @inline
 */
export type ActiveDotType =
	/**
	 * true | false will turn the default activeDot on and off, respectively
	 */
	| boolean
	/**
	 * activeDot can be a custom Solid Component.
	 * It should return an SVG element because we are in SVG context - HTML won't work here.
	 */
	| ((props: ActiveDotProps) => JSX.Element)
	/**
	 * activeDot can be an object; props from here will be appended to the default active dot
	 */
	| Partial<ActiveDotProps>
	/**
	 * activeDot can be a JSX element.
	 */
	| JSX.Element

/**
 * Inside the dot event handlers we provide extra information about the dot point
 * that the Dot component itself does not need but users might find useful.
 */
export type DotItemDotProps = SVGPropsNoEvents<Omit<DotProps, "points" | "ref">> & {
	points: ReadonlyArray<DotPoint>
	index: number
	payload: unknown
	dataKey: DataKey<unknown> | undefined
	value: unknown
}

/**
 * This is the type of `dot` prop on:
 * - Area
 * - Line
 * - Radar
 *
 * @inline
 */
export type DotType =
	/**
	 * true | false will turn the default dot on and off, respectively
	 */
	| boolean
	/**
	 * dot can be a custom Solid Component.
	 * It should return an SVG element because we are in SVG context - HTML won't work here.
	 *
	 * When a function or component is used, the props received are {@link DotItemDotProps}
	 * which contain some extra information compared to {@link DotProps}.
	 */
	| ((props: DotItemDotProps) => JSX.Element)
	/**
	 * dot can be an object; props from here will be appended to the default dot
	 */
	| Partial<DotProps>
	/**
	 * dot can be a JSX element.
	 */
	| JSX.Element

export type ActiveShape<PropsType = Record<string, unknown>, ElementType extends Element = SVGElement> =
	| JSX.Element
	| ((props: PropsType) => JSX.Element | null | undefined)
	| JSX.SvgSVGAttributes<ElementType>
	| boolean

/**
 * Animation progress props passed to custom `shape` renderers.
 * `animationElapsedTime` is 0 at the start and 1 at the end (easing already applied).
 */
export interface ShapeAnimationProps {
	animationElapsedTime?: number
	isAnimating?: boolean
	isEntrance?: boolean
}

export type RangeObj = PolarViewBoxRequired & {
	angle: number
	radius: number
}

type HTMLElementTarget = Pick<HTMLElement, "getBoundingClientRect" | "offsetWidth" | "offsetHeight">
type SVGElementTarget = Pick<SVGGraphicsElement, "getBoundingClientRect" | "getBBox">

/**
 * Simplified version of the MouseEvent so that we don't have to mock the whole thing in tests.
 *
 * This represents the native MouseEvent:
 * https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
 */
export interface HTMLMousePointer {
	clientX: number
	clientY: number
	currentTarget: HTMLElementTarget
}

export interface HTMLTouchPointer {
	touches: ArrayLike<Pick<Touch, "clientX" | "clientY">>
	currentTarget: HTMLElementTarget
}

/**
 * Simplified version of the MouseEvent for SVG elements.
 *
 * Similar to MousePointer but uses SVGGraphicsElement properties instead of HTMLElement properties.
 * SVG elements use getBBox() to get the intrinsic size instead of offsetWidth/offsetHeight.
 */
export interface SVGMousePointer {
	clientX: number
	clientY: number
	currentTarget: SVGElementTarget
}

export interface SVGTouchPointer {
	touches: ArrayLike<Pick<Touch, "clientX" | "clientY">>
	currentTarget: SVGElementTarget
}

/**
 * Recharts accepts mouse events from both HTML and SVG elements.
 */
export type MousePointer = HTMLMousePointer | SVGMousePointer
export type TouchPointer = HTMLTouchPointer | SVGTouchPointer

/**
 * Coordinates relative to the top-left corner of the active element.
 * Also include scale which means that element that's scaled will return the same coordinates as element that's not scaled.
 */
export interface RelativePointer {
	relativeX: number
	relativeY: number
}

/**
 * Data provider means that this component accepts a `data` prop which is where you can input your data into the chart state.
 * The data is an array of objects, where each object represents a data point.
 *
 * DataPointType is the type of each data point object in the data array.
 *
 * The data is reused in multiple charts and components. Meaning if you provide data on the chart level,
 * then all child components, graphical items, legend, tooltip, axes ... will be able to access the data.
 *
 * Same goes for the graphical item. If you provide data on the graphical item level,
 * then that data is visible for the main chart, and all axes, tooltip, legend ... in the whole chart.
 * This is not scoped to the graphical item only.
 */
export interface DataProvider<DataPointType> {
	/**
	 * The source data. Each element should be an object.
	 * The properties of each object represent the values of different data dimensions.
	 *
	 * Use the `dataKey` prop to specify which properties to use.
	 *
	 * @example data={[{ name: 'a', value: 12 }]}
	 * @example data={[{ label: 'foo', measurements: [5, 12] }]}
	 */
	data?: ChartData<DataPointType>
}

/**
 * Data consumer means that this component accepts a `dataKey` prop which is how you specify
 * which dimension of the data to use for this component.
 *
 * DataPointType is the type of each data point object in the data array.
 * DataValueType is the type of the value that this dataKey extracts from each data point.
 */
export interface DataConsumer<DataPointType, DataValueType> {
	/**
	 * The data that you provide via the `data` prop is an array of objects.
	 * Each object can have multiple properties, each representing a different data dimension.
	 * Use the `dataKey` prop to specify which property (or dimension) to use for this component.
	 *
	 * Typically, you will want to have one dataKey on the X axis, and different dataKey on the Y axis,
	 * where they extract different values from the same data objects.
	 *
	 * Decides how to extract the value from the data:
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the value.
	 */
	dataKey?: DataKey<DataPointType, DataValueType>
}

/**
 * Props shared with all Cartesian and Polar charts.
 * There are three charts that do not use these base props, and define their own:
 * - Treemap
 * - Sunburst
 * - Sankey
 */
interface BaseChartProps<DataPointType> extends DataProvider<DataPointType>, ExternalMouseEvents {
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
	id?: string
	children?: JSX.Element
	className?: string
	/**
	 * Turn on accessibility support for keyboard-only and screen reader users.
	 *
	 * @defaultValue true
	 */
	accessibilityLayer?: boolean
	desc?: string
	/**
	 * Empty space around the container.
	 *
	 * @defaultValue {"top":5,"right":5,"bottom":5,"left":5}
	 */
	margin?: Partial<Margin>
	style?: JSX.CSSProperties
	/**
	 * The CSS cursor style applied to the chart container.
	 * Useful for setting the mouse cursor when hovering over the chart (e.g. `"pointer"`, `"crosshair"`).
	 */
	cursor?: JSX.CSSProperties["cursor"]
	/**
	 * Charts with the same syncId will synchronize Tooltip and Brush events.
	 *
	 * @see {@link https://recharts.github.io/en-US/examples/SynchronizedAreaChart/ Synchronized Charts Example}
	 */
	syncId?: number | string
	/**
	 * Customize how the charts will synchronize tooltips and brushes.
	 * `index`: synchronize using the data index in the data array. Index expects that all data has the same length.
	 * `value`: synchronize using the data value on categorical axis (categorical: XAxis in horizontal layout, YAxis in vertical layout).
	 * function: a custom sync method which receives tick and data as argument and returns an index.
	 *
	 * @defaultValue index
	 */
	syncMethod?: SyncMethod
	/**
	 * If and where the chart should appear in the tab order
	 */
	tabIndex?: number
	/**
	 * If true, then it will listen to container size changes and adapt the SVG chart accordingly.
	 * If false, then it renders the chart at the specified width and height and will stay that way
	 * even if the container size changes.
	 *
	 * This is similar to ResponsiveContainer but without the need for an extra wrapper component.
	 * The `responsive` prop also uses standard CSS sizing rules, instead of custom resolution logic (like ResponsiveContainer does).
	 * @default false
	 *
	 * @see {@link https://recharts.github.io/en-US/guide/sizes/ Chart sizing guide}
	 */
	responsive?: boolean
}

export interface EventThrottlingProps {
	/**
	 * Decides the time interval to throttle events.
	 * Only events defined in `throttledEvents` prop are throttled.
	 * All other events are executed immediately/synchronously.
	 *
	 * Options:
	 * - `number`: the time interval in milliseconds
	 * - `'raf'`: use requestAnimationFrame to schedule updates.
	 *
	 * @defaultValue 'raf'
	 */
	throttleDelay?: number | "raf"
	/**
	 * Defines which events should be throttled.
	 * Events not in this list will not be throttled.
	 *
	 * Use the special value `'all'` to throttle all events. Empty array means no events are throttled.
	 *
	 * Use the prop `throttleDelay` to define the throttling interval.
	 *
	 * If an event is on this list, then you lose the opportunity to access the event synchronously.
	 * Which means that if you want to call `e.preventDefault()` or `e.stopPropagation()` inside the event handler,
	 * then that event handler must not be in this list.
	 *
	 * @defaultValue ["mousemove","touchmove","pointermove","scroll","wheel"]
	 */
	throttledEvents?: ReadonlyArray<keyof GlobalEventHandlersEventMap> | "all"
}

export interface CartesianChartProps<DataPointType = unknown>
	extends BaseChartProps<DataPointType>, EventThrottlingProps {
	/**
	 * The gap between two bar categories, which can be a percent value or a fixed value.
	 *
	 * @defaultValue 10%
	 *
	 * @see {@link https://recharts.github.io/en-US/guide/barAlignment/ Bar Alignment Guide}
	 */
	barCategoryGap?: number | string
	/**
	 * The gap between two bars in the same category.
	 *
	 * @defaultValue 4
	 *
	 * @see {@link https://recharts.github.io/en-US/guide/barAlignment/ Bar Alignment Guide}
	 */
	barGap?: number | string
	/**
	 * The width or height of each bar. If the barSize is not specified, the size of the
	 * bar will be calculated by the barCategoryGap, barGap and the quantity of bar groups.
	 */
	barSize?: number | string
	/**
	 * The base value of area.
	 */
	baseValue?: BaseValue
	compact?: boolean
	dataKey?: DataKey<unknown>
	/**
	 * The layout of chart defines the orientation of axes, graphical items, and tooltip.
	 *
	 * @defaultValue horizontal
	 */
	layout?: CartesianLayout
	/**
	 * The maximum width of all the bars in a horizontal BarChart, or maximum height in a vertical BarChart.
	 */
	maxBarSize?: number
	/**
	 * If `false`, stacked items will be rendered left to right.
	 * If `true`, stacked items will be rendered right to left.
	 *
	 * Render direction affects SVG layering, not x position.
	 *
	 * @defaultValue false
	 */
	reverseStackOrder?: boolean
	/**
	 * The ARIA role for the chart, which provides semantic information for screen reader users.
	 */
	role?: string
	/**
	 * The type of offset function used to generate the lower and upper values in the series array.
	 * The types are built-in offsets in d3-shape.
	 * Only applicable for stacked Area or Bar charts.
	 * Has no effect when the stackId prop is not set on Area or Bar components.
	 *
	 * @link https://d3js.org/d3-shape/stack#stack_offset
	 * @see {@link https://recharts.github.io/en-US/examples/BarChartStackedBySign/ Chart with stackOffset=sign example}
	 *
	 * @defaultValue none
	 */
	stackOffset?: StackOffsetType
	title?: string
}

export interface PolarChartProps<DataPointType = unknown>
	extends BaseChartProps<DataPointType>, EventThrottlingProps {
	/**
	 * The gap between two bar categories, which can be a percent value or a fixed value.
	 *
	 * @defaultValue 10%
	 */
	barCategoryGap?: number | string
	/**
	 * The gap between two bars in the same category.
	 *
	 * @defaultValue 4
	 */
	barGap?: number | string
	/**
	 * The width or height of each bar. If the barSize is not specified, the size of the
	 * bar will be calculated by the barCategoryGap, barGap and the quantity of bar groups.
	 */
	barSize?: number | string
	/**
	 * The x-coordinate of center. If set a percentage, the final value is obtained by multiplying the percentage of width.
	 * @defaultValue 50%
	 */
	cx?: number | string
	/**
	 * The y-coordinate of center. If set a percentage, the final value is obtained by multiplying the percentage of height.
	 * @defaultValue 50%
	 */
	cy?: number | string
	dataKey?: DataKey<unknown>
	/**
	 * Angle, in degrees, at which the chart should end.
	 */
	endAngle?: number
	/**
	 * The inner radius of the chart.
	 * If set a percentage, the final value is obtained by multiplying the percentage of maxRadius which is calculated by the width, height, cx, cy.
	 * @defaultValue 0
	 */
	innerRadius?: number | string
	/**
	 * The layout of chart defines the orientation of axes, graphical items, and tooltip.
	 */
	layout?: PolarLayout
	maxBarSize?: number
	/**
	 * The outer radius of the chart.
	 * If set a percentage, the final value is obtained by multiplying the percentage of maxRadius which is calculated by the width, height, cx, cy.
	 * @defaultValue 80%
	 */
	outerRadius?: number | string
	reverseStackOrder?: boolean
	role?: string
	stackOffset?: StackOffsetType
	/**
	 * Angle in degrees from which the chart should start.
	 */
	startAngle?: number
	title?: string
}

export type Percent = `${number}%`

export type NonEmptyArray<T> = readonly [T, ...T[]]

export const isNonEmptyArray = <T>(
	arr: ReadonlyArray<T> | null | undefined,
): arr is NonEmptyArray<T> => {
	return Array.isArray(arr) && arr.length > 0
}
