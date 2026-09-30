import { useContext } from "solid-js"
import { RechartsStateContext } from "./RechartsStateContext"
import type { RechartsStateContextValue } from "./RechartsStateContext"

/** Returns state + setState from the nearest RechartsStateProvider. Throws outside one. */
export function useChartState(): RechartsStateContextValue {
	const ctx = useContext(RechartsStateContext)
	if (ctx === undefined) {
		throw new Error("@solidports/recharts: useChartState called outside RechartsStateProvider")
	}
	return ctx
}

/** Returns state + setState from the nearest RechartsStateProvider, or undefined outside one. */
export function useOptionalChartState(): RechartsStateContextValue | undefined {
	return useContext(RechartsStateContext)
}
