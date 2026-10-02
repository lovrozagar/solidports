import { createContext, untrack, useContext } from "solid-js"
import type { JSX } from "@solidjs/web"
import { mergeProps } from "./solid-1-compat"
import { cloneJsxNodeWithProps, isJsxNode } from "./ReactUtils"
import { camelizeSvgPropsForHandler } from "./svgPropertiesNoEvents"

/**
 * Upstream renders a shape passed as an element with
 * `cloneElement(option, { ...props, ...option.props })`. Solid evaluates `<Sector fill="red" />`
 * eagerly, so there is no unrendered element to clone. Instead the caller provides the props it
 * would inject, then reads the option lazily inside the provider: the built-in shape evaluated
 * there merges them under its own explicit props.
 *
 * Each evaluation arms a one-shot token: only the first shape evaluated after arming takes it,
 * so shapes nested inside that shape (e.g. the curves of AreaRevealShape) are unaffected.
 */
type ShapeElementPropsToken = { props: Record<string, unknown>; consumed: boolean }

export type ShapeElementPropsSlot = { token: ShapeElementPropsToken | null }

const ShapeElementPropsContext = createContext<ShapeElementPropsSlot | null>(null)

export function createShapeElementPropsSlot(): ShapeElementPropsSlot {
	return { token: null }
}

/** Arm the slot with the props for the next shape evaluated inside the provider. */
export function armShapeElementProps(slot: ShapeElementPropsSlot, props: Record<string, unknown>): ShapeElementPropsToken {
	const token = { consumed: false, props }
	slot.token = token
	return token
}

/** Stop offering the injected props to shapes evaluated from now on. */
export function disarmShapeElementProps(slot: ShapeElementPropsSlot): void {
	slot.token = null
}

export function ShapeElementPropsProvider(props: { slot: ShapeElementPropsSlot; children: JSX.Element }) {
	/* eslint-disable-next-line solid/reactivity -- the slot is a stable mutable container */
	return <ShapeElementPropsContext value={props.slot}>{props.children}</ShapeElementPropsContext>
}

/**
 * Merge props injected by an enclosing ShapeElementPropsProvider under the shape's own props.
 * Own props win, like upstream's `{ ...props, ...option.props }`.
 */
export function useShapeElementProps<P extends object>(own: P): P {
	const slot = useContext(ShapeElementPropsContext)
	const token = slot?.token
	if (token == null || token.consumed) {
		return own
	}
	token.consumed = true
	return untrack(() => mergeProps(token.props, own)) as unknown as P
}

/**
 * Renders a `shape`-style option the way upstream does for element / function / default:
 * - an element: built-in shapes take `shapeProps` while evaluated; other elements are cloned
 *   with them applied (Solid cannot clone an unrendered element);
 * - a function: called with the props in upstream's camelCase spelling;
 * - anything else: `renderDefault(shapeProps)`.
 */
export function ShapeOption(props: {
	option: unknown
	shapeProps: Record<string, unknown>
	renderDefault: (shapeProps: Record<string, unknown>) => JSX.Element
}) {
	const slot = createShapeElementPropsSlot()
	const render = (): JSX.Element => {
		const token = armShapeElementProps(slot, props.shapeProps)
		/* read once: an element option mints a new node per read */
		const option = props.option
		disarmShapeElementProps(slot)
		if (isJsxNode(option)) {
			return token.consumed
				? (option as unknown as JSX.Element)
				: (cloneJsxNodeWithProps(option, props.shapeProps) as unknown as JSX.Element)
		}
		if (typeof option === "function") {
			return (option as (p: Record<string, unknown>) => JSX.Element)(camelizeSvgPropsForHandler(props.shapeProps))
		}
		return props.renderDefault(props.shapeProps)
	}
	return <ShapeElementPropsProvider slot={slot}>{render()}</ShapeElementPropsProvider>
}
