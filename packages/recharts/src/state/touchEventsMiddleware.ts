/* eslint-disable import/no-cycle */
import type { ChartState } from "./chartState"
import { selectActivePropsFromChartPointer } from "./selectors/selectActivePropsFromChartPointer"
import { getRelativeCoordinate } from "../util/getRelativeCoordinate"
import { selectTooltipEventType } from "./selectors/selectTooltipEventType"
import { readChartState } from "./chartState"
import {
	DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME,
	DATA_ITEM_INDEX_ATTRIBUTE_NAME,
} from "../util/Constants"
import { selectTooltipCoordinate } from "./selectors/touchSelectors"
import { selectAllGraphicalItemsSettings } from "./selectors/tooltipSelectors"
import type { RelativePointer } from "../util/types"
import { createEventProxy } from "../util/createEventProxy"

import { type SetStoreFunction } from '../util/solid-1-compat';
import { setTooltipInteraction } from "./tooltipInteraction"
export type TouchEventHandlers = {
	handleTouchMove: (touchEvent: TouchEvent) => void
}

/**
 * Creates touch event handler functions that read from the Solid store and update it directly.
 * Replaces the Redux createListenerMiddleware pattern for touch events.
 */
export function createTouchEventHandlers(
	store: ChartState,
	setStore: SetStoreFunction<ChartState>,
): TouchEventHandlers {
	let rafId: number | null = null
	let timeoutId: ReturnType<typeof setTimeout> | null = null
	let latestChartPointers: ReadonlyArray<RelativePointer> | null = null
	let latestTouchEvent: TouchEvent | null = null

	function handleTouchMove(touchEvent: TouchEvent): void {
		if (touchEvent.touches == null || touchEvent.touches.length === 0) {
			return
		}

		latestTouchEvent = createEventProxy(touchEvent)

		const { throttleDelay, throttledEvents } = store.eventSettings
		const isThrottled = throttledEvents === "all" || throttledEvents.includes("touchmove")

		if (rafId !== null) {
			cancelAnimationFrame(rafId)
			rafId = null
		}
		if (timeoutId !== null && (typeof throttleDelay !== "number" || !isThrottled)) {
			clearTimeout(timeoutId)
			timeoutId = null
		}

		latestChartPointers = Array.from(touchEvent.touches).map((touch) =>
			getRelativeCoordinate({
				clientX: touch.clientX,
				clientY: touch.clientY,
				currentTarget: touchEvent.currentTarget as HTMLElement,
			}),
		)

		const callback = () => {
			if (latestTouchEvent == null) {
				return
			}

			const tooltipEventType = selectTooltipEventType(
				store,
				readChartState(store).tooltip.settings.shared,
			)
			if (tooltipEventType === "axis") {
				const latestTouchPointer = latestChartPointers?.[0]
				if (latestTouchPointer == null) {
					rafId = null
					timeoutId = null
					return
				}
				const activeProps = selectActivePropsFromChartPointer(store, latestTouchPointer)
				if (activeProps?.activeIndex != null) {
					setTooltipInteraction(setStore, "axisInteraction", "hover", {
						active: true,
						coordinate: activeProps.activeCoordinate,
						dataKey: undefined,
						graphicalItemId: undefined,
						index: activeProps.activeIndex,
					})
				}
			} else if (tooltipEventType === "item") {
				const touch = latestTouchEvent.touches[0]
				if (document.elementFromPoint == null || touch == null) {
					return
				}
				const target = document.elementFromPoint(touch.clientX, touch.clientY)
				if (target == null || target.getAttribute == null) {
					return
				}
				const itemIndex = target.getAttribute(DATA_ITEM_INDEX_ATTRIBUTE_NAME)
				const graphicalItemId =
					target.getAttribute(DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME) ?? undefined
				const settings = selectAllGraphicalItemsSettings(store).find(
					(item) => item.id === graphicalItemId,
				)
				if (itemIndex == null || settings == null || graphicalItemId == null) {
					return
				}
				const { dataKey } = settings
				const coordinate = selectTooltipCoordinate(store, itemIndex, graphicalItemId)

				setTooltipInteraction(setStore, "itemInteraction", "hover", {
					active: true,
					coordinate,
					dataKey,
					graphicalItemId,
					index: itemIndex,
				})
			}
			rafId = null
			timeoutId = null
		}

		if (!isThrottled) {
			callback()
			return
		}

		if (throttleDelay === "raf") {
			rafId = requestAnimationFrame(callback)
		} else if (typeof throttleDelay === "number") {
			if (timeoutId === null) {
				callback()
				latestTouchEvent = null

				timeoutId = setTimeout(() => {
					if (latestTouchEvent) {
						callback()
					} else {
						timeoutId = null
						rafId = null
					}
				}, throttleDelay)
			}
		}
	}

	return { handleTouchMove }
}

/**
 * Action thunk wrapper for touch events, used with the dispatch pattern.
 */
export const touchEventAction =
	(touchEvent: TouchEvent) =>
	(
		setStore: SetStoreFunction<ChartState>,
		store: ChartState,
	) => {
		if (touchEvent.touches == null || touchEvent.touches.length === 0) {
			return
		}
		const tooltipEventType = selectTooltipEventType(
			store,
			readChartState(store).tooltip.settings.shared,
		)
		if (tooltipEventType === "axis") {
			const firstTouch = touchEvent.touches[0]
			if (firstTouch == null) {
				return
			}
			const chartPointer = getRelativeCoordinate({
				clientX: firstTouch.clientX,
				clientY: firstTouch.clientY,
				currentTarget: touchEvent.currentTarget as HTMLElement,
			})
			const activeProps = selectActivePropsFromChartPointer(store, chartPointer)
			if (activeProps?.activeIndex != null) {
				const payload = {
					active: true,
					coordinate: activeProps.activeCoordinate,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: activeProps.activeIndex,
				}
				setTooltipInteraction(setStore, "axisInteraction", "hover", payload)
			}
		} else if (tooltipEventType === "item") {
			const touch = touchEvent.touches[0]
			if (document.elementFromPoint == null || touch == null) {
				return
			}
			const target = document.elementFromPoint(touch.clientX, touch.clientY)
			if (target == null || target.getAttribute == null) {
				return
			}
			const itemIndex = target.getAttribute(DATA_ITEM_INDEX_ATTRIBUTE_NAME)
			const graphicalItemId =
				target.getAttribute(DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME) ?? undefined
			const settings = selectAllGraphicalItemsSettings(store).find(
				(item) => item.id === graphicalItemId,
			)
			if (itemIndex == null || settings == null || graphicalItemId == null) {
				return
			}
			const { dataKey } = settings
			const coordinate = selectTooltipCoordinate(store, itemIndex, graphicalItemId)
			const payload = {
				active: true,
				coordinate,
				dataKey,
				graphicalItemId,
				index: itemIndex,
			}
			setTooltipInteraction(setStore, "itemInteraction", "hover", payload)
		}
	}
