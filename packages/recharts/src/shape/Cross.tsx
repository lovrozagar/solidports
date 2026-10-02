/* eslint-disable import/no-cycle */
/**
 * @fileOverview Cross
 */
import type { JSX } from '@solidjs/web';
import { useShapeElementProps } from "../util/ShapeElementProps"
import type { WithoutRemoveFalse } from "../util/types"
import { Show } from 'solid-js';
import { clsx } from "clsx"
import { isNumber } from "../util/DataUtils"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"

interface CrossProps {
	/**
	 * The x-coordinate of the vertical line of the cross in pixels.
	 */
	x?: number
	/**
	 * The y-coordinate of the horizontal line of the cross in pixels.
	 */
	y?: number
	/**
	 * Width of the cross in pixels.
	 */
	width?: number
	/**
	 * Height of the cross in pixels.
	 */
	height?: number
	/**
	 * The y-coordinate of the top left point in the boundary box of the cross.
	 */
	top?: number
	/**
	 * The x-coordinate of the top left point in the boundary box of the cross.
	 */
	left?: number
	class?: string
}

export type Props = WithoutRemoveFalse<JSX.PathSVGAttributes<SVGPathElement>> & CrossProps

const getPath = (
	x: number,
	y: number,
	width: number,
	height: number,
	top: number,
	left: number,
) => {
	return `M${x},${top}v${height}M${left},${y}h${width}`
}

export function Cross(ownProps: Props) {
	/* Props injected for a shape passed as an element (see ShapeElementProps). */
	const props = useShapeElementProps(ownProps)
	const x = () => props.x ?? 0
	const y = () => props.y ?? 0
	const top = () => props.top ?? 0
	const left = () => props.left ?? 0
	const width = () => props.width ?? 0
	const height = () => props.height ?? 0

	const isValid = () =>
		isNumber(x()) &&
		isNumber(y()) &&
		isNumber(width()) &&
		isNumber(height()) &&
		isNumber(top()) &&
		isNumber(left())

	return (
		<Show when={isValid()}>
			<path
				{...svgPropertiesAndEvents({
					...props,
					height: height(),
					left: left(),
					top: top(),
					width: width(),
					x: x(),
					y: y(),
				})}
				class={clsx("recharts-cross", props.class)}
				d={getPath(x(), y(), width(), height(), top(), left())}
			/>
		</Show>
	)
}
