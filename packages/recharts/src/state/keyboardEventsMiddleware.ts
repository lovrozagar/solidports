/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "./store"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "./_solid/chartState"
import {
	selectTooltipAxisDomain,
	selectTooltipAxisTicks,
	selectTooltipDisplayedData,
} from "./selectors/tooltipSelectors"
import { selectCoordinateForDefaultIndex } from "./selectors/selectors"
import { selectChartDirection, selectTooltipAxisDataKey } from "./selectors/axisSelectors"
import { combineActiveTooltipIndex } from "./selectors/combiners/combineActiveTooltipIndex"

export type KeyboardEventHandlers = {
	handleKeyDown: (key: KeyboardEvent["key"]) => void
	handleFocus: () => void
	handleBlur: () => void
}

/**
 * Creates keyboard event handler functions that read from the Solid store and update it directly.
 * Replaces the Redux createListenerMiddleware pattern for keyboard navigation.
 */
export function createKeyboardEventHandlers(
	store: RechartsRootState,
	_setStore: SetStoreFunction<RechartsRootState>,
	setChartState: SetStoreFunction<ChartState>,
): KeyboardEventHandlers {
	let rafId: number | null = null
	let timeoutId: ReturnType<typeof setTimeout> | null = null
	let latestKeyboardActionPayload: KeyboardEvent["key"] | null = null

	function handleKeyDown(key: KeyboardEvent["key"]): void {
		latestKeyboardActionPayload = key

		if (rafId !== null) {
			cancelAnimationFrame(rafId)
			rafId = null
		}

		const { throttleDelay, throttledEvents } = store.eventSettings
		const isThrottled = throttledEvents === "all" || throttledEvents.includes("keydown")

		if (timeoutId !== null && (typeof throttleDelay !== "number" || !isThrottled)) {
			clearTimeout(timeoutId)
			timeoutId = null
		}

		const callback = () => {
			try {
				const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
				if (!accessibilityLayerIsActive) {
					return
				}
				const keyboardInteraction = store._solid.tooltip.keyboardInteraction
				const currentKey = latestKeyboardActionPayload
				if (currentKey !== "ArrowRight" && currentKey !== "ArrowLeft" && currentKey !== "Enter") {
					return
				}

				/* TODO this is lacking index for charts that do not support numeric indexes */
				const resolvedIndex = combineActiveTooltipIndex(
					keyboardInteraction,
					selectTooltipDisplayedData(store),
					selectTooltipAxisDataKey(store),
					selectTooltipAxisDomain(store),
				)
				const currentIndex = resolvedIndex == null ? -1 : Number(resolvedIndex)
				if (!Number.isFinite(currentIndex) || currentIndex < 0) {
					return
				}
				const tooltipTicks = selectTooltipAxisTicks(store)
				if (currentKey === "Enter") {
					const coordinate = selectCoordinateForDefaultIndex(
						store,
						"axis",
						"hover",
						String(keyboardInteraction.index),
					)
					setChartState("tooltip", "keyboardInteraction", {
						active: !keyboardInteraction.active,
						coordinate,
						dataKey: undefined,
						graphicalItemId: undefined,
						index: keyboardInteraction.index,
					})
					return
				}

				const direction = selectChartDirection(store)
				const directionMultiplier = direction === "left-to-right" ? 1 : -1
				const movement = currentKey === "ArrowRight" ? 1 : -1
				const nextIndex = currentIndex + movement * directionMultiplier
				if (tooltipTicks == null || nextIndex >= tooltipTicks.length || nextIndex < 0) {
					return
				}
				const coordinate = selectCoordinateForDefaultIndex(
					store,
					"axis",
					"hover",
					String(nextIndex),
				)

				setChartState("tooltip", "keyboardInteraction", {
					active: true,
					coordinate,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: nextIndex.toString(),
				})
			} finally {
				rafId = null
				timeoutId = null
			}
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
				latestKeyboardActionPayload = null

				timeoutId = setTimeout(() => {
					if (latestKeyboardActionPayload) {
						callback()
					} else {
						timeoutId = null
						rafId = null
					}
				}, throttleDelay)
			}
		}
	}

	function handleFocus(): void {
		const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
		if (!accessibilityLayerIsActive) {
			return
		}
		const keyboardInteraction = store._solid.tooltip.keyboardInteraction
		if (keyboardInteraction.active) {
			return
		}
		if (keyboardInteraction.index == null) {
			const nextIndex = "0"
			const coordinate = selectCoordinateForDefaultIndex(store, "axis", "hover", String(nextIndex))
			setChartState("tooltip", "keyboardInteraction", {
				active: true,
				coordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: nextIndex,
			})
		}
	}

	function handleBlur(): void {
		const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
		if (!accessibilityLayerIsActive) {
			return
		}
		const keyboardInteraction = store._solid.tooltip.keyboardInteraction
		if (keyboardInteraction.active) {
			setChartState("tooltip", "keyboardInteraction", {
				active: false,
				coordinate: keyboardInteraction.coordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: keyboardInteraction.index,
			})
		}
	}

	return { handleBlur, handleFocus, handleKeyDown }
}

/**
 * Action thunk wrappers for keyboard events, used with the dispatch pattern.
 * Note: these are simplified versions without throttling. For full throttling, use createKeyboardEventHandlers.
 */
export const focusAction =
	() =>
	(
		_setStore: SetStoreFunction<RechartsRootState>,
		store: RechartsRootState,
		setChartState?: SetStoreFunction<ChartState> | undefined,
	) => {
		const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
		if (!accessibilityLayerIsActive) {
			return
		}
		const keyboardInteraction = store._solid.tooltip.keyboardInteraction
		if (keyboardInteraction.active) {
			return
		}
		if (keyboardInteraction.index == null) {
			const nextIndex = "0"
			const coordinate = selectCoordinateForDefaultIndex(store, "axis", "hover", String(nextIndex))
			const payload = {
				active: true,
				coordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: nextIndex,
			}
			setChartState?.("tooltip", "keyboardInteraction", payload)
		}
	}

export const blurAction =
	() =>
	(
		_setStore: SetStoreFunction<RechartsRootState>,
		store: RechartsRootState,
		setChartState?: SetStoreFunction<ChartState> | undefined,
	) => {
		const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
		if (!accessibilityLayerIsActive) {
			return
		}
		const keyboardInteraction = store._solid.tooltip.keyboardInteraction
		if (keyboardInteraction.active) {
			const payload = {
				active: false,
				coordinate: keyboardInteraction.coordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: keyboardInteraction.index,
			}
			setChartState?.("tooltip", "keyboardInteraction", payload)
		}
	}

export const keyDownAction =
	(key: string) =>
	(
		_setStore: SetStoreFunction<RechartsRootState>,
		store: RechartsRootState,
		setChartState?: SetStoreFunction<ChartState> | undefined,
	) => {
		const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
		if (!accessibilityLayerIsActive) {
			return
		}
		const keyboardInteraction = store._solid.tooltip.keyboardInteraction
		if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Enter") {
			return
		}
		const resolvedIndex = combineActiveTooltipIndex(
			keyboardInteraction,
			selectTooltipDisplayedData(store),
			selectTooltipAxisDataKey(store),
			selectTooltipAxisDomain(store),
		)
		const currentIndex = resolvedIndex == null ? -1 : Number(resolvedIndex)
		if (!Number.isFinite(currentIndex) || currentIndex < 0) {
			return
		}
		const tooltipTicks = selectTooltipAxisTicks(store)
		if (key === "Enter") {
			const coordinate = selectCoordinateForDefaultIndex(
				store,
				"axis",
				"hover",
				String(keyboardInteraction.index),
			)
			const payload = {
				active: !keyboardInteraction.active,
				coordinate,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: keyboardInteraction.index,
			}
			setChartState?.("tooltip", "keyboardInteraction", payload)
			return
		}
		const direction = selectChartDirection(store)
		const directionMultiplier = direction === "left-to-right" ? 1 : -1
		const movement = key === "ArrowRight" ? 1 : -1
		const nextIndex = currentIndex + movement * directionMultiplier
		if (tooltipTicks == null || nextIndex >= tooltipTicks.length || nextIndex < 0) {
			return
		}
		const coordinate = selectCoordinateForDefaultIndex(store, "axis", "hover", String(nextIndex))
		const payload = {
			active: true,
			coordinate,
			dataKey: undefined,
			graphicalItemId: undefined,
			index: nextIndex.toString(),
		}
		setChartState?.("tooltip", "keyboardInteraction", payload)
	}
