/* eslint-disable import/no-cycle */
import { JSX, splitProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import isPlainObject from "es-toolkit/compat/isPlainObject"

import { Rectangle } from "../shape/Rectangle"
import { Trapezoid } from "../shape/Trapezoid"
import { Sector } from "../shape/Sector"
import { Layer } from "../container/Layer"
import { Symbols, SymbolsProps } from "../shape/Symbols"
import { Curve } from "../shape/Curve"
import { cloneJsxNodeWithProps, isJsxNode } from "./ReactUtils"

/**
 * This is an abstraction for rendering a user defined prop for a customized shape in several forms.
 *
 * <Shape /> is the root and will handle taking in:
 *  - an object of svg properties
 *  - a boolean
 *  - a render prop (inline function that returns jsx)
 *  - a JSX element
 *
 * <ShapeSelector /> is a subcomponent of <Shape /> and used to match a component
 * to the value of props.shapeType that is passed to the root.
 */
type ShapeType = "trapezoid" | "rectangle" | "sector" | "symbols" | "curve"

export type ShapeProps<OptionType, ExtraProps> = {
	shapeType: ShapeType
	option: OptionType
	isActive?: boolean
	index?: string | number
	activeClassName?: string
	inActiveClassName?: string
} & ExtraProps

function defaultPropTransformer(
	option: Record<string, unknown>,
	props: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...props,
		...option,
	}
}

function isSymbolsProps(
	shapeType: ShapeType,
	_elementProps: unknown,
): _elementProps is SymbolsProps {
	return shapeType === "symbols"
}

type ShapeComponent = (props: Record<string, unknown>) => JSX.Element

const SHAPE_MAP: Record<ShapeType, ShapeComponent> = {
	curve: Curve as ShapeComponent,
	rectangle: Rectangle as ShapeComponent,
	sector: Sector as ShapeComponent,
	symbols: Symbols as ShapeComponent,
	trapezoid: Trapezoid as ShapeComponent,
}

function ShapeSelector(props: {
	shapeType: ShapeType
	elementProps: Record<string, unknown>
}): JSX.Element {
	/* eslint-disable solid/reactivity -- shapeType is structural (stable at mount); conditional branches run once; elementProps spread happens in JSX (tracked) */
	const component = SHAPE_MAP[props.shapeType]
	if (!component) {
		return null
	}
	if (props.shapeType === "symbols" && isSymbolsProps(props.shapeType, props.elementProps)) {
		return <Dynamic component={Symbols} {...props.elementProps} />
	}
	return <Dynamic component={component} {...props.elementProps} />
	/* eslint-enable solid/reactivity */
}

export function getPropsFromShapeOption<T>(option: T): T {
	return option
}

export function Shape<OptionType, ExtraProps>(
	allProps: ShapeProps<OptionType, ExtraProps>,
): JSX.Element {
	/* mirror upstream: keep `isActive` on the forwarded props so function-options and
	   downstream rectangles receive it (tests assert it on the received props). */
	const [local, props] = splitProps(allProps as Record<string, unknown>, [
		"option",
		"shapeType",
		"activeClassName",
		"inActiveClassName",
	])
	const activeClassName = () => (local.activeClassName as string) ?? "recharts-active-shape"
	const inActiveClassName = () => (local.inActiveClassName as string) ?? "recharts-shape"

	const renderShape = (): JSX.Element => {
		const option = local.option

		if (typeof option === "function") {
			return (option as (p: Record<string, unknown>, i: unknown) => JSX.Element)(props, props.index)
		}

		if (isPlainObject(option) && typeof option !== "boolean") {
			const nextProps = defaultPropTransformer(option as Record<string, unknown>, props)
			return <ShapeSelector shapeType={local.shapeType as ShapeType} elementProps={nextProps} />
		}

		/* User passed JSX `<Sector ... />` as activeShape — Solid evaluated it
		 * once into a Node. Clone + apply iteration props so the rendered DOM
		 * reflects user-supplied class/fill while position attrs flow from props. */
		if (isJsxNode(option)) {
			return <>{cloneJsxNodeWithProps(option, props as Record<string, unknown>) as unknown as JSX.Element}</>
		}

		return <ShapeSelector shapeType={local.shapeType as ShapeType} elementProps={props} />
	}

	return (
		<Layer class={props.isActive ? activeClassName() : inActiveClassName()}>{renderShape()}</Layer>
	)
}
