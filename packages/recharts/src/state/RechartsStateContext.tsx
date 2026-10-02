import { createContext } from 'solid-js';
import { type SetStoreFunction } from '../util/solid-1-compat';
import type { ChartState } from "./chartState"

/** Shape exposed via context — state for reads, setState for fine-grained writes. */
export type RechartsStateContextValue = {
	state: ChartState
	setState: SetStoreFunction<ChartState>
}

/** Typed context — null outside a RechartsStateProvider. */
export const RechartsStateContext = createContext<RechartsStateContextValue | null>(null)
