import type { ChartState } from "../../src/state/chartState"
import { createInitialChartState } from "../../src/state/chartState"

import { flush } from "solid-js"
import { createStore } from '../../src/util/solid-1-compat';
/**
 * Creates an initial ChartState store, applies mutations via produce,
 * and returns the resulting state snapshot.
 */
export function produceState(cb: (draft: ChartState) => void): ChartState {
	const [store, setStore] = createStore(createInitialChartState())
	setStore(cb)
	flush()
	return store
}
