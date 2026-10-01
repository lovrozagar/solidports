import { createContext } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "./chartState"

/** Shape exposed via context — state for reads, setState for fine-grained writes. */
export type RechartsStateContextValue = {
	state: ChartState
	setState: SetStoreFunction<ChartState>
}

/** Typed context — undefined outside a RechartsStateProvider. */
export const RechartsStateContext = createContext<RechartsStateContextValue | undefined>(undefined)
