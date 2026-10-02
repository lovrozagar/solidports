/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import { createMemo, Show } from 'solid-js';
import isPlainObject from "es-toolkit/compat/isPlainObject"

import { Rectangle } from "../shape/Rectangle"
import { Trapezoid } from "../shape/Trapezoid"
import { Sector } from "../shape/Sector"
import { Layer } from "../container/Layer"
import { Symbols, SymbolsProps } from "../shape/Symbols"
import { Curve } from "../shape/Curve"
import { cloneJsxNodeWithProps, isJsxNode } from "./ReactUtils"
import {
	armShapeElementProps,
	createShapeElementPropsSlot,
	disarmShapeElementProps,
	ShapeElementPropsProvider,
} from "./ShapeElementProps"

import { splitProps } from './solid-1-compat';
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
	/**
	 * Component rendered when `option` is empty, an object of props, or this same component.
	 * Overrides the `shapeType` lookup, like upstream's `DefaultShape`.
	 */
	DefaultShape?: (props: never) => JSX.Element
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
	const component = createMemo(() => SHAPE_MAP[props.shapeType])
	const isSymbols = createMemo(
		() => props.shapeType === "symbols" && isSymbolsProps(props.shapeType, props.elementProps),
	)
	return (
		<Show when={component()}>
			<Dynamic component={isSymbols() ? Symbols : component()} {...props.elementProps} />
		</Show>
	)
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
		"DefaultShape",
		"activeClassName",
		"inActiveClassName",
	])
	const activeClassName = () => (local.activeClassName as string) ?? "recharts-active-shape"
	const inActiveClassName = () => (local.inActiveClassName as string) ?? "recharts-shape"

	const renderDefault = (elementProps: Record<string, unknown>): JSX.Element => {
		const DefaultShape = local.DefaultShape as ShapeComponent | undefined
		if (DefaultShape != null) {
			return <Dynamic component={DefaultShape} {...elementProps} />
		}
		return <ShapeSelector shapeType={local.shapeType as ShapeType} elementProps={elementProps} />
	}

	/* Element options are evaluated inside the provider so built-in shapes pick up the
	   props upstream would inject with cloneElement (see ShapeElementProps). */
	const slot = createShapeElementPropsSlot()

	const renderShape = (): JSX.Element => {
		const token = armShapeElementProps(slot, props)
		/* read once: an element option is a getter that mints a new shape per read */
		const option = local.option
		/* Only an element option may take the injected props; it already has while being
		   read. Disarm so shapes rendered by the remaining branches (and their nested
		   shapes) keep exactly the props they are given. */
		disarmShapeElementProps(slot)

		if (option != null && option === local.DefaultShape) {
			return renderDefault(props)
		}

		if (typeof option === "function") {
			return (option as (p: Record<string, unknown>, i: unknown) => JSX.Element)(props, props.index)
		}

		if (isPlainObject(option) && typeof option !== "boolean") {
			const nextProps = defaultPropTransformer(option as Record<string, unknown>, props)
			return renderDefault(nextProps)
		}

		/* A built-in shape passed as an element took the injected props while it was
		   evaluated. Anything else (a custom component) is cloned with the props applied. */
		if (isJsxNode(option)) {
			if (token.consumed) {
				return option as unknown as JSX.Element
			}
			return <>{cloneJsxNodeWithProps(option, props as Record<string, unknown>) as unknown as JSX.Element}</>
		}

		return renderDefault(props)
	}

	return (
		<Layer class={props.isActive ? activeClassName() : inActiveClassName()}>
			<ShapeElementPropsProvider slot={slot}>{renderShape()}</ShapeElementPropsProvider>
		</Layer>
	)
}
