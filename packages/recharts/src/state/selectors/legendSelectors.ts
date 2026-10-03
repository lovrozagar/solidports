/* eslint-disable import/no-cycle */
import sortBy from "es-toolkit/compat/sortBy"
import type { ChartState } from "../store"
import type { LegendSettings } from "../legendSlice"
import type { LegendPayload } from "../../component/DefaultLegendContent"
import type { Size } from "../../util/types"
import { chartSelector } from "./chartSelector"
import { readChartState } from "../chartState"

export const selectLegendSettings = (state: ChartState): LegendSettings => {
	return readChartState(state).legend.settings
}

export const selectLegendSize = (state: ChartState): Size => {
	return readChartState(state).legend.size
}

const selectAllLegendPayload2DArray = (
	state: ChartState,
): ReadonlyArray<ReadonlyArray<LegendPayload>> => {
	return readChartState(state).legend.payload
}

export const selectLegendPayload = chartSelector(function selectLegendPayload(state: ChartState): ReadonlyArray<LegendPayload> {
	const payloads = selectAllLegendPayload2DArray(state)
	const { itemSorter } = selectLegendSettings(state)
	const flat = payloads.flat(1)
	return itemSorter ? sortBy(flat, itemSorter) : flat
})
