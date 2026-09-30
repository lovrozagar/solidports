import type { SetStoreFunction } from "solid-js/store"
import type { LayoutType, Margin, Size } from "../util/types"
import type { RechartsRootState } from "./store"

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

export const setChartSize =
	(size: Size) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		setStore("layout", "width", size.width)
		setStore("layout", "height", size.height)
	}

export const setMargin =
	(margin: Margin) =>
	(setStore: SetStoreFunction<RechartsRootState>) =>
		setStore("layout", "margin", margin)

export const setScale =
	(scale: number) =>
	(setStore: SetStoreFunction<RechartsRootState>) =>
		setStore("layout", "scale", scale)
