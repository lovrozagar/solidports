import { createContext, useContext } from "solid-js"
import type { ChartState } from "./chartState"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartEventHandlers } from "./events"

export type ChartStoreContextValue = {
	store: ChartState
	setStore: SetStoreFunction<ChartState>
	events: ChartEventHandlers
}

/**
 * Independent Solid context — must not collide with consumer apps that bring
 * their own stores. Provides store + setStore for state access plus consolidated
 * event handlers.
 */
export const RechartsStoreContext = createContext<ChartStoreContextValue>()

/**
 * Returns the chart store handle from context. Returns `undefined` outside a
 * chart wrapper — matches panorama and stand-alone usage; callers must guard.
 */
export function useChartStore(): ChartStoreContextValue | undefined {
	return useContext(RechartsStoreContext)
}
