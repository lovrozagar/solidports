import type { ChartCoordinate, ChartOffsetInternal, LayoutType } from "../types"

export type CursorRectangle = {
	fill: string
	height: number
	stroke: string
	width: number
	x: number
	y: number
}

export function getCursorRectangle(
	layout: LayoutType,
	activeCoordinate: ChartCoordinate,
	offset: ChartOffsetInternal,
	tooltipAxisBandSize: number,
): CursorRectangle {
	const halfSize = tooltipAxisBandSize / 2

	return {
		fill: "#ccc",
		height: layout === "horizontal" ? offset.height - 1 : tooltipAxisBandSize,
		stroke: "none",
		width: layout === "horizontal" ? tooltipAxisBandSize : offset.width - 1,
		x: layout === "horizontal" ? activeCoordinate.x - halfSize : offset.left + 0.5,
		y: layout === "horizontal" ? offset.top + 0.5 : activeCoordinate.y - halfSize,
	}
}
