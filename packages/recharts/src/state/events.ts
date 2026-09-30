/* eslint-disable import/no-cycle */
import type { SetStoreFunction } from "solid-js/store"
import type { RechartsRootState } from "./store"
import type { CategoricalChartFunc } from "../chart/types"
import type { HTMLMousePointer } from "../util/types"
import type { ChartState } from "./_solid/chartState"
import {
	mouseClickAction,
	mouseMoveAction,
} from "./mouseEventsMiddleware"
import {
	blurAction,
	focusAction,
	keyDownAction,
} from "./keyboardEventsMiddleware"
import { touchEventAction } from "./touchEventsMiddleware"
import { externalEventAction } from "./externalEventsMiddleware"

export type ChartEventHandlers = {
	handleMouseClick: (mousePointer: HTMLMousePointer) => void
	handleMouseMove: (mousePointer: HTMLMousePointer) => void
	handleFocus: () => void
	handleBlur: () => void
	handleKeyDown: (key: KeyboardEvent["key"]) => void
	handleTouchMove: (touchEvent: TouchEvent) => void
	handleExternalEvent: <E extends Event>(
		event: E,
		handler: CategoricalChartFunc<E> | undefined,
	) => void
}

/**
 * Native Solid event-handler factory. Wraps the per-middleware action thunks
 * (`mouseClickAction`/`mouseMoveAction`/`focusAction`/`blurAction`/
 * `keyDownAction`/`touchEventAction`/`externalEventAction`) into a single
 * composed object exposed on the store context.
 *
 * Behavior matches the underlying action wrappers: synchronous state mutation
 * so that subsequent `handleExternalEvent` reads observe the freshly-updated
 * tooltip state in the same tick (chartEvents contract). The throttled
 * `createMouseEventHandlers` etc. factories remain on their middleware
 * modules for direct consumers but are not used here.
 *
 * `actions` is reserved for a later migration that replaces the direct
 * `setStore` calls inside each thunk with `actions.<method>()`.
 */
export function createEventHandlers(
	store: RechartsRootState,
	setStore: SetStoreFunction<RechartsRootState>,
	setChartState?: SetStoreFunction<ChartState> | undefined,
): ChartEventHandlers {
	return {
		handleBlur(): void {
			blurAction()(setStore, store, setChartState)
		},
		handleExternalEvent<E extends Event>(
			event: E,
			handler: CategoricalChartFunc<E> | undefined,
		): void {
			externalEventAction({ handler, reactEvent: event })(setStore, store)
		},
		handleFocus(): void {
			focusAction()(setStore, store, setChartState)
		},
		handleKeyDown(key: KeyboardEvent["key"]): void {
			keyDownAction(key)(setStore, store, setChartState)
		},
		handleMouseClick(mousePointer: HTMLMousePointer): void {
			mouseClickAction(mousePointer)(setStore, store, setChartState)
		},
		handleMouseMove(mousePointer: HTMLMousePointer): void {
			mouseMoveAction(mousePointer)(setStore, store, setChartState)
		},
		handleTouchMove(touchEvent: TouchEvent): void {
			touchEventAction(touchEvent)(setStore, store, setChartState)
		},
	}
}
