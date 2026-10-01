import { createStore, produce } from "solid-js/store"
import type { ChartState } from "../../src/state/chartState"
import { createInitialChartState } from "../../src/state/chartState"

/**
 * Creates an initial ChartState store, applies mutations via produce,
 * and returns the resulting state snapshot.
 */
export function produceState(cb: (draft: ChartState) => void): ChartState {
	const [store, setStore] = createStore(createInitialChartState())
	setStore(produce(cb))
	return store
}
