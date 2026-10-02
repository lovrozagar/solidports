/* eslint-disable import/no-cycle */
import {
	TooltipEntrySettings,
	TooltipIndex,
	TooltipPayload,
	TooltipPayloadConfiguration,
	TooltipPayloadEntry,
	TooltipPayloadSearcher,
} from "../../tooltipSlice"
import { ChartData, ChartDataState } from "../../chartDataSlice"
import { DataKey, TooltipEventType } from "../../../util/types"
import { findEntryInArray } from "../../../util/DataUtils"
import { getTooltipEntry, getValueByDataKey } from "../../../util/ChartUtils"
import { getSliced } from "../../../util/getSliced"
import { ActiveLabel } from "../../../synchronisation/types"

type TooltipPayloadItemLike = {
	name: TooltipEntrySettings["name"]
	unit: TooltipEntrySettings["unit"]
	dataKey: DataKey<unknown> | undefined
	payload: unknown
	color: string | undefined
	fill: string | undefined
}

function parseName(value: unknown): TooltipEntrySettings["name"] {
	if (typeof value === "string" || typeof value === "number") {
		return value
	}
	return undefined
}

function parseUnit(value: unknown): TooltipEntrySettings["unit"] {
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value
	}
	return undefined
}

function parseDataKey(value: unknown): DataKey<unknown> | undefined {
	if (typeof value === "string" || typeof value === "number") {
		return value
	}
	if (typeof value === "function") {
		return (obj: unknown) => value(obj)
	}
	return undefined
}

function parseColor(value: unknown): string | undefined {
	if (typeof value === "string") {
		return value
	}
	return undefined
}

function parseTooltipPayloadItem(item: unknown): TooltipPayloadItemLike | undefined {
	if (item == null || typeof item !== "object") {
		return undefined
	}

	const name = "name" in item ? parseName(item.name) : undefined
	const unit = "unit" in item ? parseUnit(item.unit) : undefined
	const dataKey = "dataKey" in item ? parseDataKey(item.dataKey) : undefined
	const payload = "payload" in item ? item.payload : undefined
	const color = "color" in item ? parseColor(item.color) : undefined
	const fill = "fill" in item ? parseColor(item.fill) : undefined

	return {
		color,
		dataKey,
		fill,
		name,
		payload,
		unit,
	}
}

function selectFinalData(
	dataDefinedOnItem: unknown,
	dataDefinedOnChart: ChartData | undefined,
): unknown {
	/*
	 * If a payload has data specified directly from the graphical item, prefer that.
	 * Otherwise, fill in data from the chart level, using the same index.
	 */
	if (dataDefinedOnItem != null) {
		return dataDefinedOnItem
	}
	return dataDefinedOnChart
}

export const combineTooltipPayload = (
	tooltipPayloadConfigurations: ReadonlyArray<TooltipPayloadConfiguration>,
	activeIndex: TooltipIndex,
	chartDataState: ChartDataState,
	tooltipAxisDataKey: DataKey<unknown> | undefined,
	activeLabel: ActiveLabel,
	tooltipPayloadSearcher: TooltipPayloadSearcher | undefined,
	tooltipEventType: TooltipEventType | undefined,
): TooltipPayload | undefined => {
	if (activeIndex == null || tooltipPayloadSearcher == null) {
		return undefined
	}
	const { chartData, computedData, dataStartIndex, dataEndIndex } = chartDataState

	const init: Array<TooltipPayloadEntry> = []

	return tooltipPayloadConfigurations.reduce(
		(agg, { dataDefinedOnItem, settings }): Array<TooltipPayloadEntry> => {
			const finalData = selectFinalData(dataDefinedOnItem, chartData)

			const sliced = Array.isArray(finalData)
				? getSliced(finalData, dataStartIndex, dataEndIndex)
				: finalData

			const finalDataKey: DataKey<unknown> | undefined = settings?.dataKey ?? tooltipAxisDataKey
			const finalNameKey: DataKey<unknown> | undefined = settings?.nameKey
			let tooltipPayload: unknown
			if (
				tooltipAxisDataKey &&
				Array.isArray(sliced) &&
				/*
				 * findEntryInArray won't work for Scatter because Scatter provides an array of arrays
				 * as tooltip payloads and findEntryInArray is not prepared to handle that.
				 * Sad but also ScatterChart only allows 'item' tooltipEventType
				 * and also this is only a problem if there are multiple Scatters and each has its own data array
				 * so let's fix that some other time.
				 */
				!Array.isArray(sliced[0]) &&
				/*
				 * If the tooltipEventType is 'axis', we should search for the dataKey in the sliced data
				 * because thanks to allowDuplicatedCategory=false, the order of elements in the array
				 * no longer matches the order of elements in the original data
				 * and so we need to search by the active dataKey + label rather than by index.
				 *
				 * The same happens if multiple graphical items are present in the chart
				 * and each of them has its own data array. Those arrays get concatenated
				 * and again the tooltip index no longer matches the original data.
				 *
				 * On the other hand the tooltipEventType 'item' should always search by index
				 * because we get the index from interacting over the individual elements
				 * which is always accurate, irrespective of the allowDuplicatedCategory setting.
				 */
				tooltipEventType === "axis"
			) {
				tooltipPayload = findEntryInArray(sliced, tooltipAxisDataKey, activeLabel)
				if (tooltipPayload == null) {
					tooltipPayload = tooltipPayloadSearcher(
						sliced,
						activeIndex,
						computedData,
						finalNameKey,
					)
				}
			} else {
				/*
				 * This is a problem because it assumes that the index is pointing to the displayed data
				 * which it isn't because the index is pointing to the tooltip ticks array.
				 * The above approach (with findEntryInArray) is the correct one, but it only works
				 * if the axis dataKey is defined explicitly, and if the data is an array of objects.
				 */
				tooltipPayload = tooltipPayloadSearcher(sliced, activeIndex, computedData, finalNameKey)
			}

			if (Array.isArray(tooltipPayload)) {
				tooltipPayload.forEach((item) => {
					const parsedItem = parseTooltipPayloadItem(item)
					const itemName = parsedItem?.name
					const itemDataKey = parsedItem?.dataKey
					const itemPayload = parsedItem?.payload
					const newSettings: TooltipEntrySettings = {
						...settings,
						/* Preserve item-level color/fill from graphical items. */
						color: parsedItem?.color ?? settings?.color,
						fill: parsedItem?.fill ?? settings?.fill,
						name: itemName,
						unit: parsedItem?.unit,
					}
					agg.push(
						getTooltipEntry({
							dataKey: itemDataKey,
							name: itemName == null ? undefined : String(itemName),
							payload: itemPayload,
							tooltipEntrySettings: newSettings,
							value: getValueByDataKey(itemPayload, itemDataKey),
						}),
					)
				})
			} else {
				agg.push(
					getTooltipEntry({
						dataKey: finalDataKey,
						name: getValueByDataKey(tooltipPayload, finalNameKey) ?? settings?.name,
						payload: tooltipPayload,
						tooltipEntrySettings: settings,
						value: getValueByDataKey(tooltipPayload, finalDataKey),
					}),
				)
			}
			return agg
		},
		init,
	)
}
