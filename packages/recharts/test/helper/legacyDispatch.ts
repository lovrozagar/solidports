/* Test helpers. Production reads ChartState via useChartState. */
import { useOptionalChartState } from "../../src/state/useChartState"
import type { ChartState } from "../../src/state/chartState"

import { type SetStoreFunction } from '../../src/util/solid-1-compat';
export type ChartActionThunk = (
	setStore: SetStoreFunction<ChartState>,
	store: ChartState,
) => void

export function useAppSelector<T>(selector: (state: ChartState) => T): T | undefined {
	const ctx = useOptionalChartState()
	if (!ctx) {
		return undefined
	}
	return selector(ctx.state)
}

export function useAppDispatch(): (action: ChartActionThunk) => void {
	const ctx = useOptionalChartState()
	if (!ctx) {
		return () => undefined
	}
	return (action) => action(ctx.setState, ctx.state)
}
