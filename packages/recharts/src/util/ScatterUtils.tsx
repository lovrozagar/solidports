/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { SymbolType } from "./types"
import { ScatterPointItem, ScatterCustomizedShape } from "../cartesian/Scatter"
import { Symbols } from "../shape/Symbols"
import { Shape } from "./ActiveShapeUtils"
import { DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME } from "./Constants"
import { GraphicalItemId } from "../state/graphicalItemsSlice"

export type ScatterShapeProps = ScatterPointItem & {
	index: number
	[DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME]: GraphicalItemId
}

export function ScatterSymbol(
	props: {
		option: ScatterCustomizedShape
		isActive: boolean
	} & ScatterShapeProps,
): JSX.Element {
	/* eslint-disable solid/reactivity -- option type and shapeProps are stable at mount; component re-renders via Solid's fine-grained reactivity on JSX reads below */
	const { option: _option, isActive: _isActive, ...shapeProps } = props
	if (typeof props.option === "string") {
		const symbolType = props.option as SymbolType
		return (
			<Shape
				option={<Symbols type={symbolType} {...shapeProps} />}
				isActive={props.isActive}
				shapeType="symbols"
				{...shapeProps}
			/>
		)
	}

	return (
		<Shape option={props.option} isActive={props.isActive} shapeType="symbols" {...shapeProps} />
	)
	/* eslint-enable solid/reactivity */
}
