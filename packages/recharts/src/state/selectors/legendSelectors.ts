/* eslint-disable import/no-cycle */
import sortBy from "es-toolkit/compat/sortBy"
import type { RechartsRootState } from "../store"
import type { LegendSettings } from "../legendSlice"
import type { LegendPayload } from "../../component/DefaultLegendContent"
import type { Size } from "../../util/types"

/* Detects whether `_solid.legend` was partially overridden in tests (only some keys set)
   vs the full default from createInitialChartState() which always has all three keys.
   In production, dual-write keeps state.legend.settings and state.legend.size current. */
function isSolidLegendPartialOverride(solidLegend: Partial<{ settings: unknown; size: unknown; payload: unknown }>): boolean {
	return !("size" in solidLegend) || !("payload" in solidLegend)
}

export const selectLegendSettings = (state: RechartsRootState): LegendSettings => {
	const solidLegend = (state._solid as Partial<typeof state._solid>).legend
	/* Partial _solid.legend (test fixture override) — explicit new-state takes precedence */
	if (solidLegend != null && isSolidLegendPartialOverride(solidLegend) && solidLegend.settings != null) {
		return solidLegend.settings
	}
	/* Dual-write keeps state.legend.settings current in production */
	return state.legend.settings
}

export const selectLegendSize = (state: RechartsRootState): Size => {
	const solidLegend = (state._solid as Partial<typeof state._solid>).legend
	if (solidLegend != null && isSolidLegendPartialOverride(solidLegend) && solidLegend.size != null) {
		return solidLegend.size
	}
	return state.legend.size
}

const selectAllLegendPayload2DArray = (
	state: RechartsRootState,
): ReadonlyArray<ReadonlyArray<LegendPayload>> => {
	/* Always read from _solid.legend.payload — it is the reactive source that
	   useLegendPayload subscribes to. Mutations via setState on _solid trigger
	   re-renders. Dual-write also keeps state.legend.payload current but it is
	   not used here — use _solid as the single source of truth for payload. */
	return state._solid.legend.payload
}

export function selectLegendPayload(state: RechartsRootState): ReadonlyArray<LegendPayload> {
	const payloads = selectAllLegendPayload2DArray(state)
	const { itemSorter } = selectLegendSettings(state)
	const flat = payloads.flat(1)
	return itemSorter ? sortBy(flat, itemSorter) : flat
}
