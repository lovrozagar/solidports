/* eslint-disable import/no-cycle */
import type { LegendPayload } from "../component/DefaultLegendContent"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/useChartState"
import { selectLegendPayload } from "../state/selectors/legendSelectors"

/**
 * Use this hook in Legend, or anywhere else where you want to read the current Legend items.
 * Reactive when called inside a tracked scope. See GOTCHA-011.
 */
export function useLegendPayload(): ReadonlyArray<LegendPayload> | undefined {
	const newCtx = useOptionalChartState()
	/* subscribe to ChartState legend payload so mutations re-render Legend */
	void newCtx?.state.legend.payload
	const ctx = useChartStore()
	if (!ctx) {
		return undefined
	}
	return selectLegendPayload(ctx.store)
}
