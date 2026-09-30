/* Legacy Redux-style helpers retained ONLY for the ported test corpus. Production
   code reads from the chart store via `useChartStore` directly. */
import type { SetStoreFunction } from "solid-js/store"
import { useChartStore } from "../../src/state/RechartsStoreContext"
import type { RechartsRootState } from "../../src/state/store"

export type ChartActionThunk = (
	setStore: SetStoreFunction<RechartsRootState>,
	store: RechartsRootState,
) => void

export function useAppSelector<T>(selector: (state: RechartsRootState) => T): T | undefined {
	const ctx = useChartStore()
	if (!ctx) {
		return undefined
	}
	return selector(ctx.store)
}

export function useAppDispatch(): (action: ChartActionThunk) => void {
	const ctx = useChartStore()
	if (!ctx) {
		return () => undefined
	}
	return (action) => action(ctx.setStore, ctx.store)
}
