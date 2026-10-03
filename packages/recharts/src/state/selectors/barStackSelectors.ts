/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { NormalizedStackId } from "../../util/ChartUtils"
import type { BarSettings } from "../types/BarSettings"
import { selectUnfilteredCartesianItems } from "./axisSelectors"
import type { CartesianGraphicalItemSettings } from "../graphicalItemsSlice"
import { chartSelector } from "./chartSelector"
import { selectBarRectangles } from "./barSelectors"

export const selectAllBarsInStack = chartSelector(function selectAllBarsInStack(state: ChartState, stackId: NormalizedStackId, isPanorama: boolean): ReadonlyArray<BarSettings> {
	const allItems: ReadonlyArray<CartesianGraphicalItemSettings> =
		selectUnfilteredCartesianItems(state)
	return allItems
		.filter((i) => i.type === "bar")
		.filter((i) => i.stackId === stackId)
		.filter((i) => i.isPanorama === isPanorama)
		.filter((i) => !i.hide) as ReadonlyArray<BarSettings>
})

const selectAllBarIdsInStack = chartSelector(function selectAllBarIdsInStack(state: ChartState, stackId: NormalizedStackId, isPanorama: boolean) {
	return selectAllBarsInStack(state, stackId, isPanorama).map((bar) => bar.id)
})

export type BarStackItem = {
	x: number
	y: number
	width: number
	height: number
}

/**
 * Takes two rectangles and returns a new rectangle that encompasses both.
 * It takes the minimum x and y, and the maximum width and height.
 * It handles overlapping rectangles, and rectangles with a gap between them.
 * @param rect1
 * @param rect2
 */
export const expandRectangle = (
	rect1: BarStackItem | undefined,
	rect2: BarStackItem | undefined,
): BarStackItem | undefined => {
	if (!rect1) {
		return rect2
	}
	if (!rect2) {
		return rect1
	}
	const x = Math.min(rect1.x, rect1.x + rect1.width, rect2.x, rect2.x + rect2.width)
	const y = Math.min(rect1.y, rect1.y + rect1.height, rect2.y, rect2.y + rect2.height)
	const maxX = Math.max(rect1.x, rect1.x + rect1.width, rect2.x, rect2.x + rect2.width)
	const maxY = Math.max(rect1.y, rect1.y + rect1.height, rect2.y, rect2.y + rect2.height)
	const width = maxX - x
	const height = maxY - y
	return { height, width, x, y }
}

function combineStackRects(
	state: ChartState,
	stackId: NormalizedStackId,
	isPanorama: boolean,
): ReadonlyArray<BarStackItem | undefined> {
	const allBarIds = selectAllBarIdsInStack(state, stackId, isPanorama)
	const stackRects: Array<BarStackItem | undefined> = []
	allBarIds.forEach((barId) => {
		const rectangles = selectBarRectangles(state, barId, isPanorama, undefined)
		rectangles?.forEach((rect) => {
			/* Rectangles are filtered (zero dimension), so index by the original data position. */
			const rectIndex = rect.originalDataIndex
			stackRects[rectIndex] = expandRectangle(stackRects[rectIndex], rect)
		})
	})
	return stackRects
}

export const selectStackRects = chartSelector(function selectStackRects(state: ChartState, stackId: NormalizedStackId, isPanorama: boolean): ReadonlyArray<BarStackItem | undefined> {
	return combineStackRects(state, stackId, isPanorama)
})
