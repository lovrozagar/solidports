import type { SetStoreFunction } from "solid-js/store"
import type { BrushStartEndIndex } from "../context/brushUpdateContext"
import type { RechartsRootState } from "./store"

/**
 * This is the data that's coming through main chart `data` prop
 * Recharts is very flexible in what it accepts so the type is very flexible too.
 * This will typically be an object, and various components will provide various `dataKey`
 * that dictates how to pull data from that object.
 *
 * TL;DR: before dataKey
 *
 * @inline
 */
export type ChartData<DataPointType = unknown> = ReadonlyArray<DataPointType>

/**
 * So this is the same unknown type as ChartData but this is after the dataKey has been applied.
 * We still don't know what the type is - that depends on what exactly it was before the dataKey application,
 * and the dataKey can return whatever anyway - but let's keep it separate as a form of documentation.
 *
 * TL;DR: ChartData after dataKey.
 */
export type AppliedChartData = ReadonlyArray<{ value: unknown }>

export type ChartDataState = {
	chartData: ChartData | undefined
	/**
	 * store a copy of chart data after it has been processed by each chart's specific
	 * compute functions. TODO: add other charts besides Sankey
	 */
	computedData: unknown | undefined
	/**
	 * Using Brush, users can choose where they want to zoom in.
	 * This is zero-based index of the starting data point.
	 */
	dataStartIndex: number
	/**
	 * Using Brush, users can choose where they want to zoom in.
	 * This is zero-based index of the last data point.
	 */
	dataEndIndex: number
}

export const initialChartDataState: ChartDataState = {
	chartData: undefined,
	computedData: undefined,
	dataEndIndex: 0,
	dataStartIndex: 0,
}

export type BrushStartEndIndexActionPayload = Partial<BrushStartEndIndex>

export const setDataStartEndIndexes =
	(payload: BrushStartEndIndexActionPayload) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		if (payload.startIndex !== undefined) {
			setStore("chartData", "dataStartIndex", payload.startIndex)
		}
		if (payload.endIndex !== undefined) {
			setStore("chartData", "dataEndIndex", payload.endIndex)
		}
	}

/* Mirrors upstream: when setting new chart data, sync dataEndIndex to length-1
   so selectors that slice by [start, end] see the whole range by default.
   Upstream: src/state/chartDataSlice.ts reducer setChartData. */
export const setChartData =
	(data: ChartData | undefined) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		setStore("chartData", "chartData", data)
		if (data == null) {
			setStore("chartData", "dataStartIndex", 0)
			setStore("chartData", "dataEndIndex", 0)
			return
		}
		if (data.length > 0) {
			setStore("chartData", "dataEndIndex", (prev: number) =>
				prev !== data.length - 1 ? data.length - 1 : prev,
			)
		}
	}

export const setComputedData =
	(data: unknown) =>
	(setStore: SetStoreFunction<RechartsRootState>) =>
		setStore("chartData", "computedData", data)
