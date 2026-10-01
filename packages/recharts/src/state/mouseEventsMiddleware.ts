/* eslint-disable import/no-cycle */
import { batch } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "./chartState"
import type { RelativePointer, HTMLMousePointer } from "../util/types"
import { selectActivePropsFromChartPointer } from "./selectors/selectActivePropsFromChartPointer"
import { selectTooltipEventType } from "./selectors/selectTooltipEventType"
import { getRelativeCoordinate } from "../util/getRelativeCoordinate"
import { readChartState } from "./chartState"

export type MouseEventHandlers = {
	handleMouseClick: (mousePointer: HTMLMousePointer) => void
	handleMouseMove: (mousePointer: HTMLMousePointer) => void
}

/**
 * Creates mouse event handler functions that read from the Solid store and update it directly.
 * Replaces the Redux createListenerMiddleware pattern.
 */
export function createMouseEventHandlers(
	store: ChartState,
	setStore: SetStoreFunction<ChartState>,
): MouseEventHandlers {
	/*
	 * This single rafId is safe because:
	 * 1. Each chart has its own store instance with its own handlers
	 * 2. mouseMove only fires from one DOM element (the chart wrapper)
	 * 3. Rapid mousemove events from the same element SHOULD debounce - we only care about the latest position
	 * This is different from externalEventsMiddleware which handles multiple event types
	 * (click, mouseenter, mouseleave, etc.) that should NOT cancel each other.
	 */
	let rafId: number | null = null
	let timeoutId: ReturnType<typeof setTimeout> | null = null
	let latestChartPointer: RelativePointer | null = null

	function handleMouseClick(mousePointer: HTMLMousePointer): void {
		const activeProps = selectActivePropsFromChartPointer(
			store,
			getRelativeCoordinate(mousePointer),
		)
		if (activeProps?.activeIndex != null) {
			setStore("tooltip", "axisInteraction", "click", {
				active: true,
				coordinate: activeProps.activeCoordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: activeProps.activeIndex,
			})
		}
	}

	function handleMouseMove(mousePointer: HTMLMousePointer): void {
		const { throttleDelay, throttledEvents } = store.eventSettings
		const isThrottled = throttledEvents === "all" || throttledEvents?.includes("mousemove")

		/* Cancel any pending execution */
		if (rafId !== null) {
			cancelAnimationFrame(rafId)
			rafId = null
		}
		if (timeoutId !== null && (typeof throttleDelay !== "number" || !isThrottled)) {
			clearTimeout(timeoutId)
			timeoutId = null
		}

		/*
		 * Here it is important to resolve the chart pointer _before_ the callback,
		 * because once we leave the current event loop, the mousePointer event object will lose
		 * reference to currentTarget which getRelativeCoordinate uses.
		 */
		latestChartPointer = getRelativeCoordinate(mousePointer)
		const callback = () => {
			/*
			 * Here we read a fresh state again inside the callback to ensure we have the latest state values
			 * after any potential actions that may have been dispatched between the original event and this callback.
			 */
			const tooltipEventType = selectTooltipEventType(
				store,
				readChartState(store).tooltip.settings.shared,
			)
			if (latestChartPointer == null) {
				rafId = null
				timeoutId = null
				return
			}

			/*
			 * This functionality only applies to charts that have axes.
			 * Graphical items have its own mouse events handling mechanism where they attach events directly to the items.
			 */
			if (tooltipEventType === "axis") {
				const activeProps = selectActivePropsFromChartPointer(store, latestChartPointer)
				if (activeProps?.activeIndex != null) {
					setStore("tooltip", "axisInteraction", "hover", {
						active: true,
						coordinate: activeProps.activeCoordinate,
						dataKey: undefined,
						graphicalItemId: undefined,
						index: activeProps.activeIndex,
					})
				} else {
					/* Mouse moves inside svg but out of plot area — flip `active` only, mirror
					   upstream mouseLeaveChart so coordinate/index survive for the active=true
					   prop and animation tail. */
					setStore("tooltip", "axisInteraction", "hover", "active", false)
					setStore("tooltip", "itemInteraction", "hover", "active", false)
				}
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
				timeoutId = setTimeout(callback, throttleDelay)
			}
		}
	}

	return { handleMouseClick, handleMouseMove }
}

/**
 * Action thunk wrappers for use with the dispatch pattern.
 * These delegate to the same logic as createMouseEventHandlers.
 */
export const mouseClickAction =
	(mousePointer: HTMLMousePointer) =>
	(
		setStore: SetStoreFunction<ChartState>,
		store: ChartState,
	) => {
		const activeProps = selectActivePropsFromChartPointer(
			store,
			getRelativeCoordinate(mousePointer),
		)
		if (activeProps?.activeIndex != null) {
			const payload = {
				active: true,
				coordinate: activeProps.activeCoordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: activeProps.activeIndex,
			}
			setStore("tooltip", "axisInteraction", "click", payload)
		}
	}

export const mouseMoveAction =
	(mousePointer: HTMLMousePointer) =>
	(
		setStore: SetStoreFunction<ChartState>,
		store: ChartState,
	) => {
		const chartPointer = getRelativeCoordinate(mousePointer)
		const tooltipEventType = selectTooltipEventType(
			store,
			readChartState(store).tooltip.settings.shared,
		)
		if (tooltipEventType === "axis") {
			const activeProps = selectActivePropsFromChartPointer(store, chartPointer)
			if (activeProps?.activeIndex != null) {
				const payload = {
					active: true,
					coordinate: activeProps.activeCoordinate,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: activeProps.activeIndex,
				}
				setStore("tooltip", "axisInteraction", "hover", payload)
			} else {
				batch(() => {
					setStore("tooltip", "axisInteraction", "hover", "active", false)
					setStore("tooltip", "itemInteraction", "hover", "active", false)
				})
			}
		}
	}
