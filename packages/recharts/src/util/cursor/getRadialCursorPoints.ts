/* eslint-disable import/no-cycle */
import { polarToCartesian } from "../PolarUtils"
import { Coordinate, PolarCoordinate } from "../types"

export type RadialCursorPoints = {
	points: [startPoint: Coordinate, endPoint: Coordinate]
	cx?: number
	cy?: number
	radius?: number
	startAngle?: number
	endAngle?: number
}

/**
 * Only applicable for radial layouts
 * @param {Object} activeCoordinate ChartCoordinate
 * @returns {Object} RadialCursorPoints
 */
export function getRadialCursorPoints(activeCoordinate: PolarCoordinate): RadialCursorPoints {
	const { cx, cy, radius, startAngle, endAngle } = activeCoordinate
	const startPoint = polarToCartesian(cx, cy, radius, startAngle)
	const endPoint = polarToCartesian(cx, cy, radius, endAngle)

	return {
		cx,
		cy,
		endAngle,
		points: [startPoint, endPoint],
		radius,
		startAngle,
	}
}
