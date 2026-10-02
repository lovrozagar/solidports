/* eslint-disable import/no-cycle */
import { getPercentValue, isNumber, isPercent } from "../util/DataUtils"
import { CartesianViewBoxRequired, TrapezoidViewBox } from "../util/types"
import { TextAnchor, TextVerticalAnchor } from "../component/Text"
import { cartesianViewBoxToTrapezoid } from "./cartesianViewBoxToTrapezoid"

export type CartesianLabelPosition =
	| "top"
	| "left"
	| "right"
	| "bottom"
	| "inside"
	| "outside"
	| "insideLeft"
	| "insideRight"
	| "insideTop"
	| "insideBottom"
	| "insideTopLeft"
	| "insideBottomLeft"
	| "insideTopRight"
	| "insideBottomRight"
	| "insideStart"
	| "insideEnd"
	| "end"
	| "center"
	| "centerTop"
	| "centerBottom"
	| "middle"
	| {
			x?: number | string
			y?: number | string
	  }

export type GetCartesianPositionOptions = {
	viewBox: TrapezoidViewBox | CartesianViewBoxRequired
	parentViewBox?: CartesianViewBoxRequired
	/**
	 * The offset to the specified "position". Direction of the offset depends on the position.
	 */
	offset?: number
	/**
	 * The position of the element relative to the view box.
	 */
	position?: CartesianLabelPosition
	/**
	 * If true, the returned width and height will be clamped to keep the element within the parentViewBox.
	 * This is useful for preventing labels from overflowing the chart area.
	 */
	clamp?: boolean
}

export type CartesianPosition = {
	x: number
	y: number
	horizontalAnchor: TextAnchor
	verticalAnchor: TextVerticalAnchor
	width?: number
	height?: number
}

export { isOutsidePosition } from "./isOutsidePosition"

/**
 * Calculates the position and alignment for a generic element in a Cartesian coordinate system.
 *
 * @param options - The options including viewBox, position, and offset.
 * @returns The calculated x, y, alignment and size.
 */
export const getCartesianPosition = (options: GetCartesianPositionOptions): CartesianPosition => {
	const { viewBox, position, offset = 0, parentViewBox: parentViewBoxFromOptions, clamp } = options

	const { x, y, height, upperWidth, lowerWidth } = cartesianViewBoxToTrapezoid(viewBox)

	/* Funnel.tsx provides a viewBox where `x` is the top-left of the trapezoid shape. */
	const upperX = x
	/* The trapezoid is centered, so we can calculate the other corners from the top-left. */
	const lowerX = x + (upperWidth - lowerWidth) / 2
	/* middleX is the x-coordinate of the left edge at the vertical midpoint of the trapezoid. */
	const middleX = (upperX + lowerX) / 2
	/* The width of the trapezoid at its vertical midpoint. */
	const midHeightWidth = (upperWidth + lowerWidth) / 2
	/* The center x-coordinate is constant for the entire height of the trapezoid. */
	const centerX = upperX + upperWidth / 2

	/* Define vertical offsets and position inverts based on the value being positive or negative.
	 * This allows labels to be positioned correctly for bars with negative height. */
	const verticalSign = height >= 0 ? 1 : -1
	const verticalOffset = verticalSign * offset
	const verticalEnd = verticalSign > 0 ? "end" : "start"
	const verticalStart = verticalSign > 0 ? "start" : "end"

	/* Define horizontal offsets and position inverts based on the value being positive or negative.
	 * This allows labels to be positioned correctly for bars with negative width. */
	const horizontalSign = upperWidth >= 0 ? 1 : -1
	const horizontalOffset = horizontalSign * offset
	const horizontalEnd = horizontalSign > 0 ? "end" : "start"
	const horizontalStart = horizontalSign > 0 ? "start" : "end"

	/* We assume parentViewBox is generic if provided.
	 * The user has asserted that parentViewBox will be CartesianViewBoxRequired if present. */
	const parentViewBox = parentViewBoxFromOptions

	if (position === "top") {
		const result: CartesianPosition = {
			horizontalAnchor: "middle",
			verticalAnchor: verticalEnd,
			x: upperX + upperWidth / 2,
			y: y - verticalOffset,
		}

		if (clamp && parentViewBox) {
			result.height = Math.max(y - parentViewBox.y, 0)
			result.width = upperWidth
		}
		return result
	}

	if (position === "bottom") {
		const result: CartesianPosition = {
			horizontalAnchor: "middle",
			verticalAnchor: verticalStart,
			x: lowerX + lowerWidth / 2,
			y: y + height + verticalOffset,
		}
		if (clamp && parentViewBox) {
			result.height = Math.max(parentViewBox.y + parentViewBox.height - (y + height), 0)
			result.width = lowerWidth
		}
		return result
	}

	if (position === "left") {
		const result: CartesianPosition = {
			horizontalAnchor: horizontalEnd,
			verticalAnchor: "middle",
			x: middleX - horizontalOffset,
			y: y + height / 2,
		}
		if (clamp && parentViewBox) {
			result.width = Math.max(result.x - parentViewBox.x, 0)
			result.height = height
		}
		return result
	}

	if (position === "right") {
		const result: CartesianPosition = {
			horizontalAnchor: horizontalStart,
			verticalAnchor: "middle",
			x: middleX + midHeightWidth + horizontalOffset,
			y: y + height / 2,
		}
		if (clamp && parentViewBox) {
			result.width = Math.max(parentViewBox.x + parentViewBox.width - result.x, 0)
			result.height = height
		}
		return result
	}

	const sizeAttrs = clamp && parentViewBox ? { height, width: midHeightWidth } : {}

	if (position === "insideLeft") {
		return {
			horizontalAnchor: horizontalStart,
			verticalAnchor: "middle",
			x: middleX + horizontalOffset,
			y: y + height / 2,
			...sizeAttrs,
		}
	}

	if (position === "insideRight") {
		return {
			horizontalAnchor: horizontalEnd,
			verticalAnchor: "middle",
			x: middleX + midHeightWidth - horizontalOffset,
			y: y + height / 2,
			...sizeAttrs,
		}
	}

	if (position === "insideTop") {
		return {
			horizontalAnchor: "middle",
			verticalAnchor: verticalStart,
			x: upperX + upperWidth / 2,
			y: y + verticalOffset,
			...sizeAttrs,
		}
	}

	if (position === "insideBottom") {
		return {
			horizontalAnchor: "middle",
			verticalAnchor: verticalEnd,
			x: lowerX + lowerWidth / 2,
			y: y + height - verticalOffset,
			...sizeAttrs,
		}
	}

	if (position === "insideTopLeft") {
		return {
			horizontalAnchor: horizontalStart,
			verticalAnchor: verticalStart,
			x: upperX + horizontalOffset,
			y: y + verticalOffset,
			...sizeAttrs,
		}
	}

	if (position === "insideTopRight") {
		return {
			horizontalAnchor: horizontalEnd,
			verticalAnchor: verticalStart,
			x: upperX + upperWidth - horizontalOffset,
			y: y + verticalOffset,
			...sizeAttrs,
		}
	}

	if (position === "insideBottomLeft") {
		return {
			horizontalAnchor: horizontalStart,
			verticalAnchor: verticalEnd,
			x: lowerX + horizontalOffset,
			y: y + height - verticalOffset,
			...sizeAttrs,
		}
	}

	if (position === "insideBottomRight") {
		return {
			horizontalAnchor: horizontalEnd,
			verticalAnchor: verticalEnd,
			x: lowerX + lowerWidth - horizontalOffset,
			y: y + height - verticalOffset,
			...sizeAttrs,
		}
	}

	if (
		position != null &&
		typeof position === "object" &&
		(isNumber(position.x) || isPercent(position.x)) &&
		(isNumber(position.y) || isPercent(position.y))
	) {
		/* TODO: This is not quite right. The width of the trapezoid changes with y.
		 * A percentage-based x should be relative to the width at that y.
		 * For now, we use the mid-height width as a reasonable approximation. */
		return {
			horizontalAnchor: "end",
			verticalAnchor: "end",
			x: x + getPercentValue(position.x, midHeightWidth),
			y: y + getPercentValue(position.y, height),
			...sizeAttrs,
		}
	}

	return {
		horizontalAnchor: "middle",
		verticalAnchor: "middle",
		x: centerX,
		y: y + height / 2,
		...sizeAttrs,
	}
}
