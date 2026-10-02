/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { arrayTooltipSearcher } from "../state/optionsSlice"
import { CartesianChart } from "./CartesianChart"
import type { CartesianChartProps, TooltipEventType } from "../util/types"

const allowedTooltipTypes: ReadonlyArray<TooltipEventType> = ["axis"]

/**
 * @consumes ResponsiveContainerContext
 * @provides CartesianViewBoxContext
 * @provides CartesianChartContext
 */
export function AreaChart<DataPointType = unknown>(
	props: CartesianChartProps<DataPointType> & {
		ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
	},
): JSX.Element {
	return (
		<CartesianChart
			chartName="AreaChart"
			defaultTooltipEventType="axis"
			validateTooltipEventTypes={allowedTooltipTypes}
			tooltipPayloadSearcher={arrayTooltipSearcher}
			categoricalChartProps={props}
			ref={props.ref}
		/>
	)
}
