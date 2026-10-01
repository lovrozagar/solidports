import { createEffect, onCleanup } from "solid-js"
import type { ChartData } from "../state/chartDataSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import type { ChartState } from "../state/store"
import type { BrushStartEndIndex } from "./brushUpdateContext"
import { useIsPanorama } from "./PanoramaContext"

export const ChartDataContextProvider = (props: { chartData: ChartData | undefined }): null => {
	const ctx = useChartStore()
	const isPanorama = useIsPanorama()
	createEffect(() => {
		if (isPanorama) {
			/* Panorama mode reuses data from the main chart, so we must not overwrite it here. */
			return
		}
		const data = props.chartData
		ctx?.setStore("chartData", "chartData", data)
		if (data == null) {
			ctx?.setStore("chartData", "dataStartIndex", 0)
			ctx?.setStore("chartData", "dataEndIndex", 0)
		} else if (data.length > 0) {
			ctx?.setStore("chartData", "dataEndIndex", (prev: number) =>
				prev !== data.length - 1 ? data.length - 1 : prev,
			)
		}
		onCleanup(() => {
			ctx?.setStore("chartData", "chartData", undefined)
			ctx?.setStore("chartData", "dataStartIndex", 0)
			ctx?.setStore("chartData", "dataEndIndex", 0)
		})
	})
	return null
}

export const SetComputedData = (props: { computedData: unknown }): null => {
	const ctx = useChartStore()
	createEffect(() => {
		ctx?.setStore("chartData", "computedData", props.computedData)
		onCleanup(() => {
			ctx?.setStore("chartData", "chartData", undefined)
			ctx?.setStore("chartData", "dataStartIndex", 0)
			ctx?.setStore("chartData", "dataEndIndex", 0)
		})
	})
	return null
}

const selectChartData = (state: ChartState): ChartData | undefined =>
	state.chartData.chartData

/**
 * "data" is the data of the chart - it has no type because this part of recharts is very flexible.
 * Basically it's an array of "something" and then there's the dataKey property in various places
 * that's meant to pull other things away from the data.
 *
 * Some charts have `data` defined on the chart root, and they will return the array through this hook.
 * For example: <ComposedChart data={data} />.
 *
 * Other charts, such as Pie, have data defined on individual graphical elements.
 * These charts will return `undefined` through this hook, and you need to read the data from children.
 * For example: <PieChart><Pie data={data} />
 *
 * Some charts also allow setting both - data on the parent, and data on the children at the same time!
 * However, this particular selector will only return the ones defined on the parent.
 *
 * @deprecated use one of the other selectors instead - which one, depends on how do you identify the applicable graphical items.
 *
 * @return data array for some charts and undefined for other
 */
export const useChartData = (): ChartData | undefined => {
	const ctx = useChartStore()
	return ctx ? selectChartData(ctx.store) : undefined
}

const selectDataIndex = (state: ChartState): BrushStartEndIndex => {
	const { dataStartIndex, dataEndIndex } = state.chartData
	return { endIndex: dataEndIndex, startIndex: dataStartIndex }
}

/**
 * Returns data boundaries set through Brush. Reactive when called inside a tracked scope.
 */
export const useDataIndex = (): BrushStartEndIndex | undefined => {
	const ctx = useChartStore()
	return ctx ? selectDataIndex(ctx.store) : undefined
}
