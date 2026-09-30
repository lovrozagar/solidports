/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { mergeProps } from "solid-js"
import { arrayTooltipSearcher } from "../state/optionsSlice"
import type { PolarChartProps, TooltipEventType } from "../util/types"
import { defaultPolarChartProps, PolarChart } from "./PolarChart"

const allowedTooltipTypes: ReadonlyArray<TooltipEventType> = ["axis", "item"]

export const defaultRadialBarChartProps = {
	...defaultPolarChartProps,
	endAngle: 360,
	layout: "radial",
	startAngle: 0,
} as const satisfies Partial<PolarChartProps<never>>

/**
 * @consumes ResponsiveContainerContext
 * @provides PolarViewBoxContext
 * @provides PolarChartContext
 */
export function RadialBarChart<DataPointType = unknown>(
	props: PolarChartProps<DataPointType> & { ref?: SVGSVGElement | ((el: SVGSVGElement) => void) },
): JSX.Element {
	/* mergeProps preserves the props proxy — see PieChart for the rationale. */
	const propsWithDefaults = mergeProps(defaultRadialBarChartProps, props) as PolarChartProps<
		DataPointType
	> & {
		cx: NonNullable<PolarChartProps["cx"]>
		cy: NonNullable<PolarChartProps["cy"]>
		startAngle: NonNullable<PolarChartProps["startAngle"]>
		endAngle: NonNullable<PolarChartProps["endAngle"]>
		innerRadius: NonNullable<PolarChartProps["innerRadius"]>
		outerRadius: NonNullable<PolarChartProps["outerRadius"]>
	}
	return (
		<PolarChart
			chartName="RadialBarChart"
			defaultTooltipEventType="axis"
			validateTooltipEventTypes={allowedTooltipTypes}
			tooltipPayloadSearcher={arrayTooltipSearcher}
			categoricalChartProps={propsWithDefaults}
			ref={props.ref}
		/>
	)
}
