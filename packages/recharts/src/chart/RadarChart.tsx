/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { arrayTooltipSearcher } from "../state/optionsSlice"
import type { PolarChartProps, PolarLayout, TooltipEventType } from "../util/types"
import { defaultPolarChartProps, PolarChart } from "./PolarChart"

import { mergeProps } from '../util/solid-1-compat';
const allowedTooltipTypes: ReadonlyArray<TooltipEventType> = ["axis"]

export const defaultRadarChartProps = {
	...defaultPolarChartProps,
	endAngle: -270,
	layout: "centric",
	startAngle: 90,
} as const satisfies Partial<PolarChartProps<never>>

type RadarChartProps<DataPointType> = Omit<
	PolarChartProps<DataPointType>,
	"layout" | "startAngle" | "endAngle"
> & {
	/**
	 * The layout of chart defines the orientation of axes, graphical items, and tooltip.
	 *
	 * @defaultValue centric
	 */
	layout?: PolarLayout
	/**
	 * Angle in degrees from which the chart should start.
	 * @defaultValue 90
	 *
	 */
	startAngle?: number
	/**
	 * Angle, in degrees, at which the chart should end.
	 *
	 * @defaultValue -270
	 */
	endAngle?: number
}

/**
 * @consumes ResponsiveContainerContext
 * @provides PolarViewBoxContext
 * @provides PolarChartContext
 */
export function RadarChart<DataPointType = unknown>(
	props: RadarChartProps<DataPointType> & { ref?: SVGSVGElement | ((el: SVGSVGElement) => void) },
): JSX.Element {
	/* mergeProps preserves the props proxy — see PieChart for the rationale. */
	const propsWithDefaults = mergeProps(defaultRadarChartProps, props) as PolarChartProps<
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
			chartName="RadarChart"
			defaultTooltipEventType="axis"
			validateTooltipEventTypes={allowedTooltipTypes}
			tooltipPayloadSearcher={arrayTooltipSearcher}
			categoricalChartProps={propsWithDefaults}
			ref={props.ref}
		/>
	)
}
