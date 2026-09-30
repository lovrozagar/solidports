/* eslint-disable import/no-cycle */
import type { TooltipEventType } from "../util/types"
import type { TooltipIndex, TooltipPayloadSearcher } from "./tooltipSlice"
import { isNan } from "../util/DataUtils"

/**
 * These chart options are decided internally, by Recharts,
 * and will not change during the lifetime of the chart.
 *
 * Changing these options can be done by swapping the root element
 * which will make a brand-new store.
 *
 * If you want to store options that can be changed by the user,
 * use UpdatableChartOptions in rootPropsSlice.ts.
 */
export type ChartOptions = {
	chartName: string
	defaultTooltipEventType: TooltipEventType
	validateTooltipEventTypes?: ReadonlyArray<TooltipEventType>
	tooltipPayloadSearcher: TooltipPayloadSearcher
	/**
	 * We use this to identify which chart is sending events when synchronising.
	 * Without it, we can't tell the difference between an action that arrived from another chart
	 * and an action that was dispatched by the chart itself.
	 */
	eventEmitter: symbol | undefined
}

export const arrayTooltipSearcher: TooltipPayloadSearcher = (
	data: unknown,
	strIndex: TooltipIndex,
): unknown | undefined => {
	if (strIndex === null || strIndex === undefined) return undefined
	if (!Array.isArray(data)) return undefined
	const numIndex = Number.parseInt(strIndex, 10)
	if (isNan(numIndex)) {
		return undefined
	}
	return data[numIndex] as unknown
}

export const initialOptionsState: ChartOptions = {
	chartName: "",
	defaultTooltipEventType: "axis",
	eventEmitter: undefined,
	tooltipPayloadSearcher: () => undefined,
}
