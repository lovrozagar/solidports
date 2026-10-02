import type { Component } from "solid-js"

import { RadialBarChart as OriginalRadialBarChart } from "../chart/RadialBarChart"
import { RadarChart as OriginalRadarChart } from "../chart/RadarChart"
import { PieChart as OriginalPieChart } from "../chart/PieChart"
import type { RadialBarProps } from "../polar/RadialBar"
import type { Props as PolarAngleAxisProps } from "../polar/PolarAngleAxis"
import type { Props as PolarRadiusAxisProps } from "../polar/PolarRadiusAxis"
import type { Props as RadarProps } from "../polar/Radar"
import type { Props as PieProps } from "../polar/Pie"
import type { PolarChartProps } from "./types"
import type { TooltipProps } from "../component/Tooltip"
import type { NameType, ValueType } from "../component/DefaultTooltipContent"

type PolarChartWithoutLayout<TData> = Component<Omit<PolarChartProps<TData>, "layout">>

type TypedPolarComponents<TData, TAngle, TRadius, TNumerical, TComponents> = {
	[K in keyof TComponents]: K extends "PolarAngleAxis"
		? Component<PolarAngleAxisProps<TData, TAngle>>
		: K extends "PolarRadiusAxis"
			? Component<PolarRadiusAxisProps<TData, TRadius>>
			: K extends "RadialBar"
				? Component<RadialBarProps<TData, TNumerical>>
				: K extends "Radar"
					? Component<RadarProps<TData, TNumerical>>
					: K extends "Pie"
						? Component<PieProps<TData, TNumerical>>
						: K extends "Tooltip"
							? Component<TooltipProps<Extract<TNumerical, ValueType>, Extract<keyof TData, NameType>>>
							: TComponents[K]
}

/* Centric: angle axis is categorical, radius axis numerical. */
export type TypedCentricChartContext<TData, TCategorical, TNumerical, TComponents> = {
	RadarChart: PolarChartWithoutLayout<TData>
} & Omit<
	TypedPolarComponents<TData, TCategorical, TNumerical, TNumerical, TComponents>,
	"RadialBar" | "RadialBarChart" | "Pie" | "PieChart"
>

/* Radial: angle axis is numerical, radius axis categorical. */
export type TypedRadialChartContext<TData, TCategorical, TNumerical, TComponents> = {
	RadialBarChart: PolarChartWithoutLayout<TData>
	PieChart: PolarChartWithoutLayout<TData>
} & Omit<TypedPolarComponents<TData, TNumerical, TCategorical, TNumerical, TComponents>, "Radar" | "RadarChart">

export type NoRadial<T> = "RadialBar" extends keyof T
	? never
	: "RadialBarChart" extends keyof T
		? never
		: "Pie" extends keyof T
			? never
			: "PieChart" extends keyof T
				? never
				: T

export type NoCentric<T> = "Radar" extends keyof T ? never : "RadarChart" extends keyof T ? never : T

/**
 * Creates a typed context for centric Polar charts.
 *
 * The returned `RadarChart` binds `layout="centric"` and drops the `layout` prop. Radial-only
 * components (`RadialBar`, `Pie`, and their charts) are rejected at compile time.
 *
 * @example
 * ```tsx
 * const TypedCentric = createCentricChart<MyData, string, number>()({ RadarChart, Radar })
 * ```
 *
 * @since 3.8
 */
export function createCentricChart<TData, TCategorical = string, TNumerical = number>() {
	return function withComponents<TComponents extends Record<string, unknown>>(
		components: NoRadial<TComponents>,
	) {
		return {
			RadarChart: (props: Omit<PolarChartProps<TData>, "layout">) => (
				<OriginalRadarChart {...props} layout="centric" />
			),
			...components,
		} as unknown as TypedCentricChartContext<TData, TCategorical, TNumerical, TComponents>
	}
}

/**
 * Creates a typed context for radial Polar charts.
 *
 * The returned `RadialBarChart` and `PieChart` bind `layout="radial"` and drop the `layout` prop.
 * Centric-only components (`Radar`, `RadarChart`) are rejected at compile time.
 *
 * @example
 * ```tsx
 * const TypedRadial = createRadialChart<MyData, string, number>()({ RadialBarChart, RadialBar })
 * ```
 *
 * @since 3.8
 */
export function createRadialChart<TData, TCategorical = string, TNumerical = number>() {
	return function withComponents<TComponents extends Record<string, unknown>>(
		components: NoCentric<TComponents>,
	) {
		return {
			RadialBarChart: (props: Omit<PolarChartProps<TData>, "layout">) => (
				<OriginalRadialBarChart {...props} layout="radial" />
			),
			PieChart: (props: Omit<PolarChartProps<TData>, "layout">) => (
				<OriginalPieChart {...props} layout="radial" />
			),
			...components,
		} as unknown as TypedRadialChartContext<TData, TCategorical, TNumerical, TComponents>
	}
}
