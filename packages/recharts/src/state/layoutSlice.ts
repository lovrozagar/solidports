import type { LayoutType, Margin } from "../util/types"

export type ChartLayoutState = {
	layoutType: LayoutType
	width: number
	height: number
	margin: Margin
	/**
	 * How much is the chart zoomed in.
	 * Used for scaling the mouse coordinates to the chart coordinates.
	 */
	scale: number
}

export const initialLayoutState: ChartLayoutState = {
	height: 0,
	layoutType: "horizontal",
	margin: { bottom: 5, left: 5, right: 5, top: 5 },
	scale: 1,
	width: 0,
}
