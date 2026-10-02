import type { Component } from "solid-js"

import { AreaChart as OriginalAreaChart } from "../chart/AreaChart"
import { BarChart as OriginalBarChart } from "../chart/BarChart"
import { LineChart as OriginalLineChart } from "../chart/LineChart"
import { ComposedChart as OriginalComposedChart } from "../chart/ComposedChart"
import { ScatterChart as OriginalScatterChart } from "../chart/ScatterChart"
import { FunnelChart as OriginalFunnelChart } from "../chart/FunnelChart"

import type { Props as XAxisProps } from "../cartesian/XAxis"
import type { Props as YAxisProps } from "../cartesian/YAxis"
import type { Props as ZAxisProps } from "../cartesian/ZAxis"
import type { Props as AreaProps } from "../cartesian/Area"
import type { Props as BarProps } from "../cartesian/Bar"
import type { Props as LineProps } from "../cartesian/Line"
import type { Props as ScatterProps } from "../cartesian/Scatter"
import type { Props as FunnelProps } from "../cartesian/Funnel"
import type { CartesianChartProps } from "./types"
import type { TooltipProps } from "../component/Tooltip"
import type { NameType, ValueType } from "../component/DefaultTooltipContent"

type ChartWithoutLayout<TData> = Component<Omit<CartesianChartProps<TData>, "layout">>

export type TypedHorizontalChartContext<TData, TCategorical, TNumerical, TComponents> = {
	AreaChart: ChartWithoutLayout<TData>
	BarChart: ChartWithoutLayout<TData>
	LineChart: ChartWithoutLayout<TData>
	ComposedChart: ChartWithoutLayout<TData>
	ScatterChart: ChartWithoutLayout<TData>
} & Omit<
	{
		[K in keyof TComponents]: K extends "XAxis"
			? Component<XAxisProps<TData, TCategorical>>
			: K extends "YAxis"
				? Component<YAxisProps<TData, TNumerical>>
				: K extends "ZAxis"
					? Component<ZAxisProps<TData, TNumerical>>
					: K extends "Area"
						? Component<AreaProps<TData, TNumerical>>
						: K extends "Bar"
							? Component<BarProps>
							: K extends "Line"
								? Component<LineProps<TData, TNumerical>>
								: K extends "Scatter"
									? Component<ScatterProps<TData, TNumerical>>
									: K extends "Tooltip"
										? Component<TooltipProps<Extract<TNumerical, ValueType>, Extract<keyof TData, NameType>>>
										: TComponents[K]
	},
	"Funnel" | "FunnelChart"
>

export type TypedVerticalChartContext<TData, TCategorical, TNumerical, TComponents> = {
	AreaChart: ChartWithoutLayout<TData>
	BarChart: ChartWithoutLayout<TData>
	LineChart: ChartWithoutLayout<TData>
	ComposedChart: ChartWithoutLayout<TData>
	ScatterChart: ChartWithoutLayout<TData>
	FunnelChart: ChartWithoutLayout<TData>
} & {
	[K in keyof TComponents]: K extends "XAxis"
		? Component<XAxisProps<TData, TNumerical>>
		: K extends "YAxis"
			? Component<YAxisProps<TData, TCategorical>>
			: K extends "ZAxis"
				? Component<ZAxisProps<TData, TNumerical>>
				: K extends "Area"
					? Component<AreaProps<TData, TNumerical>>
					: K extends "Bar"
						? Component<BarProps>
						: K extends "Line"
							? Component<LineProps<TData, TNumerical>>
							: K extends "Scatter"
								? Component<ScatterProps<TData, TNumerical>>
								: K extends "Funnel"
									? Component<FunnelProps<TData, TNumerical>>
									: K extends "Tooltip"
										? Component<TooltipProps<Extract<TNumerical, ValueType>, Extract<keyof TData, NameType>>>
										: TComponents[K]
}

const createCartesianCharts = <TData,>(layout: "horizontal" | "vertical") => ({
	AreaChart: (props: Omit<CartesianChartProps<TData>, "layout">) => (
		<OriginalAreaChart {...props} layout={layout} />
	),
	BarChart: (props: Omit<CartesianChartProps<TData>, "layout">) => (
		<OriginalBarChart {...props} layout={layout} />
	),
	LineChart: (props: Omit<CartesianChartProps<TData>, "layout">) => (
		<OriginalLineChart {...props} layout={layout} />
	),
	ComposedChart: (props: Omit<CartesianChartProps<TData>, "layout">) => (
		<OriginalComposedChart {...props} layout={layout} />
	),
	ScatterChart: (props: Omit<CartesianChartProps<TData>, "layout">) => (
		<OriginalScatterChart {...props} layout={layout} />
	),
})

export type NoFunnel<T> = "Funnel" extends keyof T ? never : "FunnelChart" extends keyof T ? never : T

/**
 * Creates a typed context for horizontal Cartesian charts.
 *
 * The returned chart components bind `layout="horizontal"` and drop the `layout` prop, so a chart
 * cannot be flipped by accident. Strictly vertical components (`Funnel`, `FunnelChart`) are rejected
 * at compile time.
 *
 * @example
 * ```tsx
 * const TypedCharts = createHorizontalChart<MyData, string, number>()({ AreaChart, Area, XAxis, YAxis })
 * ```
 *
 * @since 3.8
 */
export function createHorizontalChart<TData, TCategorical = string, TNumerical = number>() {
	return function withComponents<TComponents extends Record<string, unknown>>(
		components: NoFunnel<TComponents>,
	) {
		return {
			...createCartesianCharts<TData>("horizontal"),
			...components,
		} as unknown as TypedHorizontalChartContext<TData, TCategorical, TNumerical, TComponents>
	}
}

/**
 * Creates a typed context for vertical Cartesian charts.
 *
 * The returned chart components bind `layout="vertical"` and drop the `layout` prop. Strictly
 * vertical components like `Funnel` and `FunnelChart` are supported.
 *
 * @example
 * ```tsx
 * const TypedCharts = createVerticalChart<MyData, number, string>()({ BarChart, Bar, Funnel, XAxis, YAxis })
 * ```
 *
 * @since 3.8
 */
export function createVerticalChart<TData, TCategorical = string, TNumerical = number>() {
	return function withComponents<TComponents extends Record<string, unknown>>(components: TComponents) {
		return {
			...createCartesianCharts<TData>("vertical"),
			FunnelChart: (props: Omit<CartesianChartProps<TData>, "layout">) => (
				<OriginalFunnelChart {...props} layout="vertical" />
			),
			...components,
		} as unknown as TypedVerticalChartContext<TData, TCategorical, TNumerical, TComponents>
	}
}
