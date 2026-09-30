/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "./store"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "./_solid/chartState"
import type { CategoricalChartFunc } from "../chart/types"
import type { MouseHandlerDataParam } from "../synchronisation/types"
import {
	selectActiveLabel,
	selectActiveTooltipCoordinate,
	selectActiveTooltipDataKey,
	selectActiveTooltipIndex,
	selectIsTooltipActive,
} from "./selectors/tooltipSelectors"
import { createEventProxy } from "../util/createEventProxy"

type ExternalEventActionPayload<E = Event> = {
	event: E
	handler: CategoricalChartFunc<E> | undefined
}

export type ExternalEventHandlers = {
	handleExternalEvent: <E extends Event>(
		event: E,
		handler: CategoricalChartFunc<E> | undefined,
	) => void
}

/**
 * Creates external event handler functions that read from the Solid store and call user-provided callbacks.
 * Replaces the Redux createListenerMiddleware pattern for external events.
 *
 * Unlike mouse/touch middleware which handle one event type, this handles MULTIPLE different event types
 * (click, mouseenter, mouseleave, mousedown, mouseup, contextmenu, dblclick, touchstart, touchmove, touchend)
 * from the same DOM element. Different event types should NOT cancel each other's animation frames.
 */
export function createExternalEventHandlers(
	store: RechartsRootState,
	_setStore: SetStoreFunction<RechartsRootState>,
): ExternalEventHandlers {
	/*
	 * We need a Map keyed by event type because this handler handles MULTIPLE different event types
	 * from the same DOM element. Different event types should NOT cancel each other's animation frames.
	 * For example, a click event and a mousemove event can happen in quick succession and both should be processed.
	 * This is different from mouseEventsMiddleware which only handles one event type and uses a single rafId.
	 */
	const rafIdMap = new Map<string, number>()
	const timeoutIdMap = new Map<string, ReturnType<typeof setTimeout>>()
	const latestEventMap = new Map<string, ExternalEventActionPayload>()

	function handleExternalEvent<E extends Event>(
		event: E,
		handler: CategoricalChartFunc<E> | undefined,
	): void {
		if (handler == null) {
			return
		}

		const eventType = event.type
		const eventProxy = createEventProxy(event)

		latestEventMap.set(eventType, {
			event: eventProxy,
			handler: handler as CategoricalChartFunc<Event>,
		})

		/* Cancel any pending execution for this event type */
		const existingRafId = rafIdMap.get(eventType)
		if (existingRafId !== undefined) {
			cancelAnimationFrame(existingRafId)
			rafIdMap.delete(eventType)
		}

		const { throttleDelay, throttledEvents } = store.eventSettings

		/*
		 * event.type gives us the event type as a string, e.g., "click", "mousemove", etc.
		 * which is the same as the names used in throttledEvents array
		 * but that array is strictly typed as ReadonlyArray<keyof GlobalEventHandlersEventMap> | "all" | undefined
		 * so that we can have relevant autocomplete and type checking elsewhere.
		 * To satisfy TypeScript, we widen throttledEvents here.
		 */
		const eventListAsString: "all" | ReadonlyArray<string> | undefined = throttledEvents

		/* Check if this event type should be throttled */
		const isThrottled = eventListAsString === "all" || eventListAsString?.includes(eventType)

		const existingTimeoutId = timeoutIdMap.get(eventType)
		if (existingTimeoutId !== undefined && (typeof throttleDelay !== "number" || !isThrottled)) {
			clearTimeout(existingTimeoutId)
			timeoutIdMap.delete(eventType)
		}

		const callback = () => {
			const latestAction = latestEventMap.get(eventType)

			try {
				if (latestAction == null) {
					/* This happens if the event was consumed by the leading edge and no new event came in */
					return
				}

				const { handler: latestHandler, event: latestEvent } = latestAction
				const nextState: MouseHandlerDataParam = {
					activeCoordinate: selectActiveTooltipCoordinate(store),
					activeDataKey: selectActiveTooltipDataKey(store),
					activeIndex: selectActiveTooltipIndex(store),
					activeLabel: selectActiveLabel(store),
					activeTooltipIndex: selectActiveTooltipIndex(store),
					isTooltipActive: selectIsTooltipActive(store),
				}

				if (latestHandler) {
					latestHandler(nextState, latestEvent)
				}
			} finally {
				rafIdMap.delete(eventType)
				timeoutIdMap.delete(eventType)
				latestEventMap.delete(eventType)
			}
		}

		if (!isThrottled) {
			/* Execute immediately */
			callback()
			return
		}

		if (throttleDelay === "raf") {
			const newRafId = requestAnimationFrame(callback)
			rafIdMap.set(eventType, newRafId)
		} else if (typeof throttleDelay === "number") {
			if (!timeoutIdMap.has(eventType)) {
				/*
				 * Leading edge execution - execute immediately on the first event
				 * and then start the cooldown period to throttle subsequent events.
				 */
				callback()

				/* Start cooldown */
				const newTimeoutId = setTimeout(callback, throttleDelay)
				timeoutIdMap.set(eventType, newTimeoutId)
			}
		} else {
			/* Should not happen based on type, but fallback to immediate */
			callback()
		}
	}

	return { handleExternalEvent }
}

/* Module-level maps mirror upstream Redux middleware behavior — single shared
   set of pending rAF/timeout handles per event type across all stores. Different
   event types must NOT cancel each other's frames. */
const actionRafIdMap = new Map<string, number>()
const actionTimeoutIdMap = new Map<string, ReturnType<typeof setTimeout>>()
const actionLatestEventMap = new Map<
	string,
	{ handler: CategoricalChartFunc<Event>; reactEvent: Event }
>()

type ExternalEventActionInput<E extends Event> = {
	handler: CategoricalChartFunc<E> | undefined
	reactEvent: E
}

/**
 * Action thunk wrapper for external events, used with the dispatch pattern.
 * 1:1 port of upstream `externalEventsMiddleware` raf-throttled scheduler —
 * pending callbacks per event type, latest payload wins on cancel.
 */
export const externalEventAction =
	<E extends Event>(payload: ExternalEventActionInput<E>) =>
	(_setStore: SetStoreFunction<RechartsRootState>, store: RechartsRootState, _setChartState?: SetStoreFunction<ChartState> | undefined) => {
		const { handler, reactEvent } = payload
		if (handler == null) {
			return
		}

		/* React 16 compatibility — pooled SyntheticEvent stays alive for async use. */
		;(reactEvent as Event & { persist?: () => void }).persist?.()

		const eventType = reactEvent.type
		const eventProxy = createEventProxy(reactEvent)

		actionLatestEventMap.set(eventType, {
			handler: handler as CategoricalChartFunc<Event>,
			reactEvent: eventProxy,
		})

		const existingRafId = actionRafIdMap.get(eventType)
		if (existingRafId !== undefined) {
			cancelAnimationFrame(existingRafId)
			actionRafIdMap.delete(eventType)
		}

		const { throttleDelay, throttledEvents } = store.eventSettings
		const eventListAsString: "all" | ReadonlyArray<string> | undefined = throttledEvents
		const isThrottled =
			eventListAsString === "all" || eventListAsString?.includes(eventType)

		const existingTimeoutId = actionTimeoutIdMap.get(eventType)
		if (
			existingTimeoutId !== undefined &&
			(typeof throttleDelay !== "number" || !isThrottled)
		) {
			clearTimeout(existingTimeoutId)
			actionTimeoutIdMap.delete(eventType)
		}

		const callback = () => {
			const latestAction = actionLatestEventMap.get(eventType)
			try {
				if (latestAction == null) {
					return
				}
				const { handler: latestHandler, reactEvent: latestEvent } = latestAction
				const nextState: MouseHandlerDataParam = {
					activeCoordinate: selectActiveTooltipCoordinate(store),
					activeDataKey: selectActiveTooltipDataKey(store),
					activeIndex: selectActiveTooltipIndex(store),
					activeLabel: selectActiveLabel(store),
					activeTooltipIndex: selectActiveTooltipIndex(store),
					isTooltipActive: selectIsTooltipActive(store),
				}
				latestHandler(nextState, latestEvent)
			} finally {
				actionRafIdMap.delete(eventType)
				actionTimeoutIdMap.delete(eventType)
				actionLatestEventMap.delete(eventType)
			}
		}

		if (!isThrottled) {
			callback()
			return
		}

		if (throttleDelay === "raf") {
			const rafId = requestAnimationFrame(callback)
			actionRafIdMap.set(eventType, rafId)
		} else if (typeof throttleDelay === "number") {
			if (!actionTimeoutIdMap.has(eventType)) {
				callback()
				const timeoutId = setTimeout(callback, throttleDelay)
				actionTimeoutIdMap.set(eventType, timeoutId)
			}
		} else {
			callback()
		}
	}
