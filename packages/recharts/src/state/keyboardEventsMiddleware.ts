/* eslint-disable import/no-cycle */
import type { ChartState } from "./chartState"
import { readChartState } from "./chartState"
import type { TooltipIndex, TooltipInteractionState } from "./tooltipSlice"
import type { Coordinate } from "../util/types"
import {
	selectTooltipAxisDomain,
	selectTooltipAxisTicks,
	selectTooltipDisplayedData,
} from "./selectors/tooltipSelectors"
import { selectCoordinateForDefaultIndex } from "./selectors/selectors"
import { selectChartDirection, selectTooltipAxisDataKey } from "./selectors/axisSelectors"
import { combineActiveTooltipIndex } from "./selectors/combiners/combineActiveTooltipIndex"
import { selectTooltipEventType } from "./selectors/selectTooltipEventType"

import { type SetStoreFunction } from '../util/solid-1-compat';
export type KeyboardEventHandlers = {
	handleKeyDown: (key: KeyboardEvent["key"]) => void
	handleFocus: () => void
	handleBlur: () => void
}

/* Mirrors upstream's setKeyboardInteraction reducer: only active/index/coordinate change. */
function setKeyboardInteraction(
	setStore: SetStoreFunction<ChartState>,
	active: boolean,
	index: TooltipIndex | undefined,
	coordinate: Coordinate | undefined,
): void {
	setStore("tooltip", "keyboardInteraction", "active", active)
	setStore("tooltip", "keyboardInteraction", "index", index)
	setStore("tooltip", "keyboardInteraction", "coordinate", coordinate)
}

function coordinateForIndex(store: ChartState, index: TooltipIndex | undefined): Coordinate | undefined {
	const tooltipEventType = selectTooltipEventType(store, store.tooltip.settings.shared)
	return selectCoordinateForDefaultIndex(store, tooltipEventType, "hover", String(index))
}

/* Builds a minimal TooltipInteractionState for the candidate-index check. */
function candidateInteraction(i: number): TooltipInteractionState {
	return {
		active: false,
		coordinate: undefined,
		dataKey: undefined,
		graphicalItemId: undefined,
		index: String(i),
	}
}

function applyKeyDown(
	store: ChartState,
	setStore: SetStoreFunction<ChartState>,
	key: KeyboardEvent["key"] | null,
): void {
	const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
	if (!accessibilityLayerIsActive) {
		return
	}
	const keyboardInteraction = readChartState(store).tooltip.keyboardInteraction
	if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Enter") {
		return
	}

	/* TODO this is lacking index for charts that do not support numeric indexes */
	const displayedData = selectTooltipDisplayedData(store)
	const axisDataKey = selectTooltipAxisDataKey(store)
	const domain = selectTooltipAxisDomain(store)
	const resolvedIndex = combineActiveTooltipIndex(keyboardInteraction, displayedData, axisDataKey, domain)
	const currentIndex = resolvedIndex == null ? -1 : Number(resolvedIndex)
	const isOutsideDomain = !Number.isFinite(currentIndex) || currentIndex < 0
	if (key === "Enter") {
		if (isOutsideDomain) {
			return
		}
		setKeyboardInteraction(
			setStore,
			!keyboardInteraction.active,
			keyboardInteraction.index,
			coordinateForIndex(store, keyboardInteraction.index),
		)
		return
	}

	const directionMultiplier = selectChartDirection(store) === "left-to-right" ? 1 : -1
	const movement = key === "ArrowRight" ? 1 : -1
	let nextIndex: number
	if (isOutsideDomain) {
		/* Snap back to the first/last index that is visible in the current domain. */
		const isVisible = (i: number) =>
			combineActiveTooltipIndex(candidateInteraction(i), displayedData, axisDataKey, domain) != null
		nextIndex = -1
		if (movement * directionMultiplier > 0) {
			for (let i = 0; i < displayedData.length; i++) {
				if (isVisible(i)) {
					nextIndex = i
					break
				}
			}
		} else {
			for (let i = displayedData.length - 1; i >= 0; i--) {
				if (isVisible(i)) {
					nextIndex = i
					break
				}
			}
		}
		if (nextIndex < 0) {
			return
		}
	} else {
		nextIndex = currentIndex + movement * directionMultiplier
		const dataLength = selectTooltipAxisTicks(store)?.length || displayedData.length
		if (dataLength === 0 || nextIndex >= dataLength || nextIndex < 0) {
			return
		}
	}
	const index = nextIndex.toString()
	setKeyboardInteraction(setStore, true, index, coordinateForIndex(store, index))
}

function applyFocus(store: ChartState, setStore: SetStoreFunction<ChartState>): void {
	const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
	if (!accessibilityLayerIsActive) {
		return
	}
	const keyboardInteraction = readChartState(store).tooltip.keyboardInteraction
	if (keyboardInteraction.active) {
		return
	}
	if (keyboardInteraction.index == null) {
		const nextIndex = "0"
		setKeyboardInteraction(setStore, true, nextIndex, coordinateForIndex(store, nextIndex))
	}
}

function applyBlur(store: ChartState, setStore: SetStoreFunction<ChartState>): void {
	const accessibilityLayerIsActive = store.rootProps.accessibilityLayer !== false
	if (!accessibilityLayerIsActive) {
		return
	}
	const keyboardInteraction = readChartState(store).tooltip.keyboardInteraction
	if (keyboardInteraction.active) {
		setKeyboardInteraction(setStore, false, keyboardInteraction.index, keyboardInteraction.coordinate)
	}
}

/**
 * Creates keyboard event handler functions that read from the Solid store and update it directly.
 * Replaces the Redux createListenerMiddleware pattern for keyboard navigation.
 */
export function createKeyboardEventHandlers(
	store: ChartState,
	setStore: SetStoreFunction<ChartState>,
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
				applyKeyDown(store, setStore, latestKeyboardActionPayload)
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

	return {
		handleBlur: () => applyBlur(store, setStore),
		handleFocus: () => applyFocus(store, setStore),
		handleKeyDown,
	}
}

/**
 * Action thunk wrappers for keyboard events, used with the dispatch pattern.
 * Note: these are simplified versions without throttling. For full throttling, use createKeyboardEventHandlers.
 */
export const focusAction = () => (setStore: SetStoreFunction<ChartState>, store: ChartState) =>
	applyFocus(store, setStore)

export const blurAction = () => (setStore: SetStoreFunction<ChartState>, store: ChartState) =>
	applyBlur(store, setStore)

export const keyDownAction =
	(key: string) => (setStore: SetStoreFunction<ChartState>, store: ChartState) =>
		applyKeyDown(store, setStore, key)
