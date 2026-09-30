import { produce } from "solid-js/store"
import type { SetStoreFunction } from "solid-js/store"
import type { ErrorBarDirection } from "../cartesian/ErrorBar"
import type { DataKey } from "../util/types"
import type { GraphicalItemId } from "./graphicalItemsSlice"
import type { RechartsRootState } from "./store"

/**
 * ErrorBars have lot more settings but all the others are scoped to the component itself.
 * Only some of them required to be reported to the global store because XAxis and YAxis need to know
 * if the error bar is contributing to extending the axis domain.
 */
export type ErrorBarsSettings = {
	/**
	 * The direction is only used in Scatter chart, and decided based on ChartLayout in other charts.
	 */
	direction: ErrorBarDirection
	/**
	 * The dataKey decides which property from the data will each individual ErrorBar use.
	 * If it so happens that the ErrorBar data are bigger than the axis domain,
	 * the error bar data will stretch the axis domain.
	 */
	dataKey: DataKey<unknown>
	/*
	 * ErrorBar props say that it has explicit xAxis and yAxis props,
	 * but actually it always inherits the xAxis and yAxis defined on the parent graphical item.
	 */
}

export type ErrorBarsState = Record<GraphicalItemId, ReadonlyArray<ErrorBarsSettings>>

export const initialErrorBarState: ErrorBarsState = {}

/* GOTCHA-013: callers (ReportErrorBarSettings) dispatch from inside a createEffect.
   Setter-fn form `setStore(path, (prev) => ...)` reads `prev` inside the tracked scope,
   which subscribes the effect to the very key being written → infinite loop. produce()
   mutates in place without registering a read on the array reference, breaking the
   feedback cycle. Same pattern used by SetCartesianGraphicalItem. */

export const addErrorBar =
	(payload: { errorBar: ErrorBarsSettings; itemId: GraphicalItemId }) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		setStore(
			"errorBars",
			produce((errorBars: ErrorBarsState) => {
				const list = errorBars[payload.itemId] ?? []
				errorBars[payload.itemId] = [...list, payload.errorBar]
			}),
		)
	}

export const removeErrorBar =
	(payload: { errorBar: ErrorBarsSettings; itemId: GraphicalItemId }) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		setStore(
			"errorBars",
			produce((errorBars: ErrorBarsState) => {
				const list = errorBars[payload.itemId]
				if (list == null) return
				errorBars[payload.itemId] = list.filter((e) => e !== payload.errorBar)
			}),
		)
	}

export const replaceErrorBar =
	(payload: {
		itemId: GraphicalItemId
		prev: ErrorBarsSettings
		next: ErrorBarsSettings
	}) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		setStore(
			"errorBars",
			produce((errorBars: ErrorBarsState) => {
				const list = errorBars[payload.itemId]
				if (list == null) return
				errorBars[payload.itemId] = list.map((e) => (e === payload.prev ? payload.next : e))
			}),
		)
	}
