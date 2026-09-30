/* eslint-disable import/no-cycle */
import { createContext, createMemo, useContext, type JSX } from "solid-js"
import { clsx } from "clsx"
import {
	isValidTextAnchor,
	type RenderableText,
	Text,
	type TextAnchor,
	type TextVerticalAnchor,
} from "./Text"
import { isNullish, isNumber, isNumOrStr, mathSign, uniqueId } from "../util/DataUtils"
import { polarToCartesian } from "../util/PolarUtils"
import type {
	CartesianViewBoxRequired,
	DataKey,
	PolarViewBoxRequired,
	TrapezoidViewBox,
	ViewBox,
} from "../util/types"
import { cartesianViewBoxToTrapezoid, useViewBox } from "../context/chartLayoutContext"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectPolarViewBox } from "../state/selectors/polarAxisSelectors"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { isJsxNode } from "../util/ReactUtils"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

import {
	type CartesianLabelPosition,
	getCartesianPosition,
} from "../cartesian/getCartesianPosition"

/**
 * @inline
 */
export type LabelContentType = JSX.Element | ((props: Props) => RenderableText | JSX.Element)

type PolarLabelPosition = "insideStart" | "insideEnd" | "end"

/**
 * @inline
 */
export type LabelPosition = CartesianLabelPosition | PolarLabelPosition

/**
 * @inline
 */
export type LabelFormatter = (label: RenderableText) => RenderableText

interface LabelProps extends ZIndexable {
	/**
	 * The box of viewing area. Used for positioning.
	 * If undefined, viewBox will be calculated based on surrounding context.
	 */
	viewBox?: ViewBox
	parentViewBox?: ViewBox
	/**
	 * Function to customize how content is serialized before rendering.
	 *
	 * This should return a renderable text - something that the {@link Text} component can render.
	 * Typically, a string or number.
	 * Custom components are not supported here - use the `content` prop instead.
	 */
	formatter?: LabelFormatter
	/**
	 * The value of label can be set as children or as the `value` prop
	 *
	 * @example <Label value="foo" />
	 */
	value?: RenderableText
	/**
	 * The offset to the specified "position". Direction of the offset depends on the position.
	 *
	 * @defaultValue 5
	 */
	offset?: number
	/**
	 * The position of label relative to the view box.
	 *
	 * @defaultValue middle
	 */
	position?: LabelPosition
	/**
	 * The value of label can be set as children or as the `value` prop
	 *
	 * @example <Label>foo</Label>
	 */
	children?: RenderableText
	className?: string
	/**
	 * If set a JSX element, the option is the custom element of rendering label.
	 * If set a function, the function will be called to render label content.
	 *
	 * @example <Label content={CustomizedLabel} />
	 * @example
	 * const renderCustomLabel = (props) => <text {...props}>Custom Label</text>
	 * <Label content={renderCustomLabel} />
	 */
	content?: LabelContentType
	/**
	 * @defaultValue false
	 */
	textBreakAll?: boolean
	/**
	 * Text rotation angle in degrees.
	 * Positive values rotate clockwise, negative values rotate counterclockwise.
	 *
	 * @defaultValue 0
	 */
	angle?: number
	index?: number
	labelRef?: SVGTextElement | ((el: SVGTextElement) => void)
	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue 2000
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number
	/**
	 * Unique identifier of this component.
	 * Used as an HTML attribute `id`.
	 */
	id?: string
}

export type Props = LabelProps & {
	textAnchor?: string
	fill?: string
	[key: string]: unknown
}

type PropsWithDefaults = Props & {
	offset: number
}

export type ImplicitLabelType =
	| boolean
	| string
	| number
	| JSX.Element
	| ((props: Record<string, unknown>) => RenderableText | JSX.Element)
	/* dataKey is only applicable when label is used implicitly from graphical element props */
	| (Props & { dataKey?: DataKey<unknown> })

const CartesianLabelContext = createContext<TrapezoidViewBox | null>(null)

export function CartesianLabelContextProvider(props: TrapezoidViewBox & { children: JSX.Element }) {
	const viewBox = createMemo(
		(): TrapezoidViewBox => ({
			height: props.height,
			lowerWidth: props.lowerWidth,
			upperWidth: props.upperWidth,
			width: props.width,
			x: props.x,
			y: props.y,
		}),
	)
	/* eslint-disable solid/reactivity -- viewBox() in JSX Provider value; reactive via Solid's JSX transform */
	return (
		<CartesianLabelContext.Provider value={viewBox()}>
			{props.children}
		</CartesianLabelContext.Provider>
	)
	/* eslint-enable solid/reactivity */
}

const useCartesianLabelContext = (): TrapezoidViewBox | undefined => {
	const labelChildContext = useContext(CartesianLabelContext)
	const cc = useViewBox()
	return labelChildContext || (cc ? cartesianViewBoxToTrapezoid(cc) : undefined)
}

const PolarLabelContext = createContext<PolarViewBoxRequired | null>(null)

export function PolarLabelContextProvider(props: PolarViewBoxRequired & { children: JSX.Element }) {
	const viewBox = createMemo(
		(): PolarViewBoxRequired => ({
			clockWise: props.clockWise,
			cx: props.cx,
			cy: props.cy,
			endAngle: props.endAngle,
			innerRadius: props.innerRadius,
			outerRadius: props.outerRadius,
			startAngle: props.startAngle,
		}),
	)
	/* eslint-disable solid/reactivity -- viewBox() in JSX Provider value; reactive via Solid's JSX transform */
	return <PolarLabelContext.Provider value={viewBox()}>{props.children}</PolarLabelContext.Provider>
	/* eslint-enable solid/reactivity */
}

export const usePolarLabelContext = (): PolarViewBoxRequired | undefined => {
	const labelChildContext = useContext(PolarLabelContext)
	const ctx = useChartStore()
	const chartContext = ctx ? selectPolarViewBox(ctx.store) : undefined
	return labelChildContext || chartContext
}

/* eslint-disable solid/reactivity -- plain utility fn; Props parameter is not a Solid reactive proxy at this call site */
const getLabel = (props: Props): RenderableText => {
	const label: RenderableText = isNullish(props.children) ? props.value : props.children

	if (typeof props.formatter === "function") {
		return props.formatter(label)
	}

	return label
}
/* eslint-enable solid/reactivity */

export const isLabelContentAFunction = (
	content: unknown,
): content is (props: Props) => JSX.Element => {
	return content != null && typeof content === "function"
}

const getDeltaAngle = (startAngle: number, endAngle: number) => {
	const sign = mathSign(endAngle - startAngle)
	const deltaAngle = Math.min(Math.abs(endAngle - startAngle), 360)

	return sign * deltaAngle
}

const renderRadialLabel = (
	labelProps: PropsWithDefaults,
	position: PolarLabelPosition,
	label: RenderableText | JSX.Element,
	attrs: Record<PropertyKey, unknown>,
	viewBox: PolarViewBoxRequired,
): JSX.Element => {
	const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, clockWise } = viewBox
	const radius = (innerRadius + outerRadius) / 2
	const deltaAngle = getDeltaAngle(startAngle, endAngle)
	const sign = deltaAngle >= 0 ? 1 : -1
	let labelAngle: number
	let direction: boolean | undefined

	switch (position) {
		case "insideStart":
			labelAngle = startAngle + sign * labelProps.offset
			direction = clockWise
			break
		case "insideEnd":
			labelAngle = endAngle - sign * labelProps.offset
			direction = !clockWise
			break
		case "end":
			labelAngle = endAngle + sign * labelProps.offset
			direction = clockWise
			break
		default:
			throw new Error(`Unsupported position ${position}`)
	}

	direction = deltaAngle <= 0 ? direction : !direction

	const startPoint = polarToCartesian(cx, cy, radius, labelAngle)
	const endPoint = polarToCartesian(cx, cy, radius, labelAngle + (direction ? 1 : -1) * 359)
	const path = `M${startPoint.x},${startPoint.y}
    A${radius},${radius},0,1,${direction ? 0 : 1},
    ${endPoint.x},${endPoint.y}`
	const id = isNullish(labelProps.id) ? uniqueId("recharts-radial-line-") : labelProps.id

	return (
		<text
			{...attrs}
			dominant-baseline="central"
			class={clsx("recharts-radial-bar-label", labelProps.className)}
		>
			<defs>
				<path id={id} d={path} />
			</defs>
			<textPath href={`#${id}`}>{label}</textPath>
		</text>
	)
}

const getAttrsOfPolarLabel = (
	viewBox: PolarViewBoxRequired,
	offset: number,
	position: LabelPosition | undefined,
): LabelPositionAttributes => {
	const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = viewBox
	const midAngle = (startAngle + endAngle) / 2

	if (position === "outside") {
		const { x, y } = polarToCartesian(cx, cy, outerRadius + offset, midAngle)

		return {
			textAnchor: x >= cx ? "start" : "end",
			verticalAnchor: "middle",
			x,
			y,
		}
	}

	if (position === "center") {
		return {
			textAnchor: "middle",
			verticalAnchor: "middle",
			x: cx,
			y: cy,
		}
	}

	if (position === "centerTop") {
		return {
			textAnchor: "middle",
			verticalAnchor: "start",
			x: cx,
			y: cy,
		}
	}

	if (position === "centerBottom") {
		return {
			textAnchor: "middle",
			verticalAnchor: "end",
			x: cx,
			y: cy,
		}
	}

	const r = (innerRadius + outerRadius) / 2
	const { x, y } = polarToCartesian(cx, cy, r, midAngle)

	return {
		textAnchor: "middle",
		verticalAnchor: "middle",
		x,
		y,
	}
}

const isPolar = (
	viewBox: CartesianViewBoxRequired | TrapezoidViewBox | PolarViewBoxRequired | undefined,
): viewBox is PolarViewBoxRequired => viewBox != null && "cx" in viewBox && isNumber(viewBox.cx)

export type LabelPositionAttributes = {
	height?: number
	textAnchor: TextAnchor
	verticalAnchor: TextVerticalAnchor
	width?: number
	x: number
	y: number
}

export const defaultLabelProps = {
	angle: 0,
	offset: 5,
	position: "middle",
	textBreakAll: false,
	zIndex: DefaultZIndexes.label,
} as const satisfies Partial<Props>

function polarViewBoxToTrapezoid(
	viewBox: PolarViewBoxRequired | TrapezoidViewBox | undefined,
): TrapezoidViewBox | undefined {
	if (!isPolar(viewBox)) {
		return viewBox
	}
	const { cx, cy, outerRadius } = viewBox
	const diameter = outerRadius * 2
	return {
		height: diameter,
		lowerWidth: diameter,
		upperWidth: diameter,
		width: diameter,
		x: cx - outerRadius,
		y: cy - outerRadius,
	}
}

/**
 * @consumes CartesianViewBoxContext
 * @consumes PolarViewBoxContext
 * @consumes CartesianLabelContext
 * @consumes PolarLabelContext
 */
export function Label(outerProps: Props): JSX.Element | null {
	const props: PropsWithDefaults = resolveDefaultProps(
		outerProps,
		defaultLabelProps,
	) as PropsWithDefaults
	const polarViewBox = usePolarLabelContext()
	const cartesianViewBox = useCartesianLabelContext()

	/*
	 * I am not proud about this solution, but it's a quick fix for https://github.com/recharts/recharts/issues/6030#issuecomment-3155352460.
	 * What we should really do is split Label into two components: CartesianLabel and PolarLabel and then handle their respective viewBoxes separately.
	 * Also other components should set its own viewBox in a context so that we can fix https://github.com/recharts/recharts/issues/6156
	 */
	const resolvedViewBox =
		props.position === "center" ? cartesianViewBox : (polarViewBox ?? cartesianViewBox)

	let viewBox: PolarViewBoxRequired | TrapezoidViewBox | undefined
	if (props.viewBox == null) {
		viewBox = resolvedViewBox
	} else if (isPolar(props.viewBox)) {
		viewBox = props.viewBox
	} else {
		viewBox = cartesianViewBoxToTrapezoid(props.viewBox)
	}

	const cartesianBox = polarViewBoxToTrapezoid(viewBox)

	/* `content` prop is typed as ReactElement | function. Primitives passed through
	   (string/number/boolean) are not renderable elements — match upstream behavior
	   of rejecting them when no value/children provided. Solid has no isValidElement,
	   so check for function or non-primitive object (Node / JSX result). */
	const isElementLikeContent =
		props.content != null &&
		(typeof props.content === "function" || typeof props.content === "object")
	if (
		!viewBox ||
		(isNullish(props.value) &&
			isNullish(props.children) &&
			typeof props.content !== "function" &&
			!isElementLikeContent)
	) {
		return null
	}

	const propsWithViewBox = {
		...props,
		viewBox,
	}

	if (typeof props.content === "function") {
		const { content: _, ...propsForContent } = propsWithViewBox
		/* React's createElement(content, props) calls function components with
		   (props, legacyContext={}). Tests are 1:1 ports so they assert the
		   two-arg shape. Solid has no legacy context so pass an empty object. */
		const label = (props.content as (p: Record<string, unknown>, legacyCtx: Record<string, never>) => RenderableText | JSX.Element)(propsForContent, {})

		/* If the function returned a JSX Element (object), return it directly */
		if (label != null && typeof label === "object") {
			return label as JSX.Element
		}

		/* Otherwise it returned renderable text, fall through to text rendering */
		const attrs = svgPropertiesAndEvents({ ...props })
		let positionAttrs: LabelPositionAttributes

		if (isPolar(viewBox)) {
			if (
				props.position === "insideStart" ||
				props.position === "insideEnd" ||
				props.position === "end"
			) {
				return renderRadialLabel(props, props.position, label as RenderableText, attrs, viewBox)
			}
			positionAttrs = getAttrsOfPolarLabel(viewBox, props.offset, props.position)
		} else {
			if (!cartesianBox) {
				return null
			}
			const cartesianResult = getCartesianPosition({
				clamp: true,
				offset: props.offset,
				parentViewBox: isPolar(props.parentViewBox) ? undefined : props.parentViewBox,
				position: props.position,
				viewBox: cartesianBox,
			})

			positionAttrs = {
				textAnchor: cartesianResult.horizontalAnchor,
				verticalAnchor: cartesianResult.verticalAnchor,
				x: cartesianResult.x,
				y: cartesianResult.y,
				...(cartesianResult.width !== undefined ? { width: cartesianResult.width } : {}),
				...(cartesianResult.height !== undefined ? { height: cartesianResult.height } : {}),
			}
		}

		return (
			<ZIndexLayer zIndex={props.zIndex}>
				<Text
					ref={props.labelRef}
					className={clsx("recharts-label", props.className ?? "")}
					{...attrs}
					{...positionAttrs}
					textAnchor={
						isValidTextAnchor(props.textAnchor) ? props.textAnchor : positionAttrs.textAnchor
					}
					breakAll={props.textBreakAll}
				>
					{label as RenderableText}
				</Text>
			</ZIndexLayer>
		)
	}

	/* content is a JSX element -- render it with merged props.
	   Primitives (string/number/boolean) are NOT valid elements per upstream contract;
	   they're filtered earlier alongside null. */
	if (
		props.content != null &&
		typeof props.content !== "string" &&
		typeof props.content !== "number" &&
		typeof props.content !== "boolean"
	) {
		return props.content as JSX.Element
	}

	const label = getLabel(props)

	const attrs = svgPropertiesAndEvents({ ...props })
	let positionAttrs: LabelPositionAttributes

	if (isPolar(viewBox)) {
		if (
			props.position === "insideStart" ||
			props.position === "insideEnd" ||
			props.position === "end"
		) {
			return renderRadialLabel(props, props.position, label, attrs, viewBox)
		}
		positionAttrs = getAttrsOfPolarLabel(viewBox, props.offset, props.position)
	} else {
		if (!cartesianBox) {
			return null
		}
		const cartesianResult = getCartesianPosition({
			clamp: true,
			offset: props.offset,
			parentViewBox: isPolar(props.parentViewBox) ? undefined : props.parentViewBox,
			position: props.position,
			viewBox: cartesianBox,
		})

		positionAttrs = {
			textAnchor: cartesianResult.horizontalAnchor,
			verticalAnchor: cartesianResult.verticalAnchor,
			x: cartesianResult.x,
			y: cartesianResult.y,
			...(cartesianResult.width !== undefined ? { width: cartesianResult.width } : {}),
			...(cartesianResult.height !== undefined ? { height: cartesianResult.height } : {}),
		}
	}

	return (
		<ZIndexLayer zIndex={props.zIndex}>
			<Text
				ref={props.labelRef}
				className={clsx("recharts-label", props.className ?? "")}
				{...attrs}
				{...positionAttrs}
				/*
				 * textAnchor is decided by default based on the `position`
				 * but we allow overriding via props for precise control.
				 */
				textAnchor={
					isValidTextAnchor(props.textAnchor) ? props.textAnchor : positionAttrs.textAnchor
				}
				breakAll={props.textBreakAll}
			>
				{label}
			</Text>
		</ZIndexLayer>
	)
}

Label.displayName = "Label"

const parseLabel = (
	label: ImplicitLabelType | undefined,
	viewBox: ViewBox | undefined,
	labelRef?: SVGTextElement | ((el: SVGTextElement) => void),
): JSX.Element | null => {
	if (!label) {
		return null
	}

	const commonProps = { labelRef, viewBox }

	if (label === true) {
		return <Label {...commonProps} />
	}

	if (isNumOrStr(label)) {
		return <Label value={label} {...commonProps} />
	}

	if (isLabelContentAFunction(label)) {
		return <Label content={label} {...commonProps} />
	}

	/* `label={<CustomLabel />}` — user JSX evaluated to a live Node before reaching us.
	 * Render it directly; clone if reused so position attrs from Label compute via the
	 * cloned subtree. Single-instance render at this site (no per-tick repeat). */
	if (isJsxNode(label)) {
		return <>{(label as Node).cloneNode(true) as unknown as JSX.Element}</>
	}

	if (label && typeof label === "object") {
		return <Label {...(label as Props)} {...commonProps} />
	}

	return null
}

export function CartesianLabelFromLabelProp(props: {
	label: ImplicitLabelType | undefined
	labelRef?: SVGTextElement | ((el: SVGTextElement) => void)
}): JSX.Element | null {
	const viewBox = useCartesianLabelContext()

	/* eslint-disable-next-line solid/reactivity -- label/labelRef are structural props; parseLabel evaluates once at mount */
	return parseLabel(props.label, viewBox, props.labelRef) || null
}

export function PolarLabelFromLabelProp(props: {
	label: ImplicitLabelType | undefined
}): JSX.Element | null {
	const viewBox = usePolarLabelContext()

	/* eslint-disable-next-line solid/reactivity -- label is a structural prop; parseLabel evaluates once at mount */
	return parseLabel(props.label, viewBox) || null
}
