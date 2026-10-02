/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { arrayTooltipSearcher } from "../state/optionsSlice"
import type { CartesianChartProps, TooltipEventType } from "../util/types"
import { CartesianChart } from "./CartesianChart"

const allowedTooltipTypes: ReadonlyArray<TooltipEventType> = ["axis", "item"]

/**
 * @consumes ResponsiveContainerContext
 * @provides CartesianViewBoxContext
 * @provides CartesianChartContext
 */
export function BarChart<DataPointType = unknown>(
	props: CartesianChartProps<DataPointType> & {
		ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
	},
): JSX.Element {
	return (
		<CartesianChart
			chartName="BarChart"
			defaultTooltipEventType="axis"
			validateTooltipEventTypes={allowedTooltipTypes}
			tooltipPayloadSearcher={arrayTooltipSearcher}
			categoricalChartProps={props}
			ref={props.ref}
		/>
	)
}
