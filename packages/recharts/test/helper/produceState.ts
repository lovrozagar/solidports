import { createStore, produce } from "solid-js/store"
import type { RechartsRootState } from "../../src/state/store"
import { createInitialState } from "../../src/state/store"

/**
 * Creates an initial Solid store, applies mutations via produce,
 * and returns the resulting state snapshot.
 */
export function produceState(cb: (draft: RechartsRootState) => void): RechartsRootState {
	const [store, setStore] = createStore(createInitialState())
	setStore(produce(cb))
	return store
}
