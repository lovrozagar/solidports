/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { computePieSectors, type PieSectorDataItem } from "../../polar/Pie"
import type { RechartsRootState } from "../store"
import { selectChartDataAndAlwaysIgnoreIndexes } from "./dataSelectors"
import type { ChartData, ChartDataState } from "../chartDataSlice"
import type { ChartOffsetInternal } from "../../util/types"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import type { LegendPayload } from "../../component/DefaultLegendContent"
import { getTooltipNameProp, getValueByDataKey } from "../../util/ChartUtils"
import { selectUnfilteredPolarItems } from "./polarSelectors"
import type { PieSettings } from "../types/PieSettings"
import type { GraphicalItemId } from "../graphicalItemsSlice"

function selectSynchronisedPieSettings(
	state: RechartsRootState,
	id: GraphicalItemId,
): PieSettings | undefined {
	const graphicalItems = selectUnfilteredPolarItems(state)
	return graphicalItems.filter((item) => item.type === "pie").find((item) => item.id === id) as
		| PieSettings
		| undefined
}

const emptyArray: ReadonlyArray<Record<string, unknown>> = []

export function selectDisplayedData(
	state: RechartsRootState,
	id: GraphicalItemId,
	cells: ReadonlyArray<Record<string, unknown>> | undefined,
	pieSettingsOverride?: PieSettings,
): ChartData | undefined {
	const { chartData }: ChartDataState = selectChartDataAndAlwaysIgnoreIndexes(state)
	const pieSettings = pieSettingsOverride ?? selectSynchronisedPieSettings(state, id)
	const safeCells = cells?.length === 0 ? emptyArray : cells

	if (pieSettings == null) {
		return undefined
	}
	let displayedData: ChartData | undefined
	if (pieSettings?.data != null && pieSettings.data.length > 0) {
		displayedData = pieSettings.data
	} else {
		displayedData = chartData
	}

	if ((!displayedData || !displayedData.length) && safeCells != null) {
		displayedData = safeCells.map((cell: Record<string, unknown>) =>
			Object.assign({}, pieSettings.presentationProps, cell),
		)
	}

	if (displayedData == null) {
		return undefined
	}

	return displayedData
}

export function selectPieLegend(
	state: RechartsRootState,
	id: GraphicalItemId,
	cells: ReadonlyArray<Record<string, unknown>> | undefined,
): ReadonlyArray<LegendPayload> | undefined {
	const displayedData = selectDisplayedData(state, id, cells)
	const pieSettings = selectSynchronisedPieSettings(state, id)
	const safeCells = cells?.length === 0 ? emptyArray : cells

	if (displayedData == null || pieSettings == null) {
		return undefined
	}
	return displayedData.map((entry, i): LegendPayload => {
		const name = getValueByDataKey(entry, pieSettings.nameKey, pieSettings.name)
		let color: string | undefined
		const cellEntry = safeCells?.[i]
		if (cellEntry != null && typeof cellEntry.fill === "string") {
			color = cellEntry.fill
		} else if (typeof entry === "object" && entry != null && "fill" in entry) {
			color = (entry as Record<string, unknown>).fill as string
		} else {
			color = pieSettings.fill
		}
		return {
			color,
			payload: entry as Record<string, unknown>,
			type: pieSettings.legendType,
			value: getTooltipNameProp(name, pieSettings.dataKey),
		}
	})
}

export function selectPieSectors(
	state: RechartsRootState,
	id: GraphicalItemId,
	cells: ReadonlyArray<Record<string, unknown>> | undefined,
	pieSettingsOverride?: PieSettings,
): ReadonlyArray<PieSectorDataItem> | undefined {
	const pieSettings = pieSettingsOverride ?? selectSynchronisedPieSettings(state, id)
	const displayedData = selectDisplayedData(state, id, cells, pieSettings)
	const offset: ChartOffsetInternal = selectChartOffsetInternal(state)

	if (pieSettings == null || displayedData == null) {
		return undefined
	}
	return computePieSectors({
		cells: (cells?.length === 0 ? emptyArray : cells) as ReadonlyArray<JSX.Element> | undefined,
		displayedData,
		offset,
		pieSettings,
	})
}
