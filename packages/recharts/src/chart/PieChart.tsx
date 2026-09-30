/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { mergeProps } from "solid-js"
import { arrayTooltipSearcher } from "../state/optionsSlice"
import { defaultPolarChartProps, PolarChart } from "./PolarChart"
import type { PolarChartProps, TooltipEventType } from "../util/types"

const allowedTooltipTypes: ReadonlyArray<TooltipEventType> = ["item"]

export const defaultPieChartProps = {
	...defaultPolarChartProps,
	endAngle: 360,
	layout: "centric",
	startAngle: 0,
} as const satisfies Partial<PolarChartProps<never>>

/**
 * @consumes ResponsiveContainerContext
 * @provides PolarViewBoxContext
 * @provides PolarChartContext
 */
export function PieChart<DataPointType = unknown>(
	props: PolarChartProps<DataPointType> & { ref?: SVGSVGElement | ((el: SVGSVGElement) => void) },
): JSX.Element {
	/* mergeProps preserves the props proxy — do NOT resolveDefaultProps here.
	   resolveDefaultProps spreads `{...realProps}` which enumerates own keys including
	   `children`; reading the children getter eagerly instantiates user JSX (Legend,
	   Tooltip, etc.) under PieChart's owner — which sits ABOVE RechartsStoreProvider
	   and the portal Providers, breaking every downstream context lookup. */
	const propsWithDefaults = mergeProps(defaultPieChartProps, props) as PolarChartProps<
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
			chartName="PieChart"
			defaultTooltipEventType="item"
			validateTooltipEventTypes={allowedTooltipTypes}
			tooltipPayloadSearcher={arrayTooltipSearcher}
			categoricalChartProps={propsWithDefaults}
			ref={props.ref}
		/>
	)
}
