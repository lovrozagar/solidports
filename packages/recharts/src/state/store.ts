/* eslint-disable import/no-cycle */
import { createStore } from "solid-js/store"
import type { ChartState } from "./chartState"
import { createInitialChartState } from "./chartState"

export type { ChartState }
export { createInitialChartState }

/** Alias so existing tests can keep calling createInitialState. */
export function createInitialState(preloadedState?: Partial<ChartState>): ChartState {
	return createInitialChartState(preloadedState)
}

type StoreTuple<T> = [T, (...args: unknown[]) => void]
type ReduxShim<T> = {
	getState: () => T
	dispatch: (action: (setStore: unknown, store: T) => void) => void
}
export type RechartsStoreHandle = StoreTuple<ChartState> & ReduxShim<ChartState>

export function createRechartsStore(preloadedState?: Partial<ChartState>): RechartsStoreHandle {
	const [store, setStore] = createStore<ChartState>(createInitialChartState(preloadedState))
	const result = [store, setStore] as unknown as RechartsStoreHandle
	result.getState = () => store
	result.dispatch = (action) => {
		action(setStore, store)
	}
	return result
}
