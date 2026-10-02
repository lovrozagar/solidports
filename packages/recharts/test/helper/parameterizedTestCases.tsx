/* @jsxImportSource @solidjs/web */
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { CartesianLayout, EventThrottlingProps, PolarChartProps } from "../../src/util/types"
import {
	AreaChart,
	BarChart,
	ComposedChart,
	FunnelChart,
	LineChart,
	Pie,
	PieChart,
	Radar,
	RadarChart,
	RadialBar,
	RadialBarChart,
	Sankey,
	Scatter,
	ScatterChart,
	SunburstChart,
	Treemap,
} from "../../src"
import { exampleSankeyData, exampleSunburstData, exampleTreemapData, PageData } from "../_data"
import type { TooltipIndex } from "../../src/state/tooltipSlice"

import { splitProps } from '../../src/util/solid-1-compat';
/**
 * Parameterized test cases for running the same tests
 * across different chart types.
 *
 * Minimal examples that render a chart without errors.
 */
export type CartesianChartTestCase = {
	ChartElement: Component<
		EventThrottlingProps & {
			children?: JSX.Element
			className?: string
			compact?: boolean
			data?: unknown[]
			height?: number
			layout?: CartesianLayout
			onClick?: (param: unknown) => void
			onMouseEnter?: (param: unknown) => void
			onMouseLeave?: (param: unknown) => void
			onMouseMove?: (param: unknown) => void
			onTouchEnd?: (param: unknown) => void
			onTouchMove?: (param: unknown) => void
			onTouchStart?: (param: unknown) => void
			width?: number
		}
	>
	testName: string
	tooltipIndex: NonNullable<TooltipIndex>
}

export type PolarChartTestCase = {
	ChartElement: Component<PolarChartProps>
	testName: string
}

function makeCompact({ ChartElement, testName, tooltipIndex }: CartesianChartTestCase) {
	const compactTestCase: CartesianChartTestCase = {
		ChartElement: (props) => <ChartElement {...props} compact />,
		testName: `compact ${testName}`,
		tooltipIndex,
	}
	return compactTestCase
}

/**
 * Duplicates each test case into regular + compact.
 */
export function includingCompact(
	testCases: ReadonlyArray<CartesianChartTestCase>,
): ReadonlyArray<CartesianChartTestCase> {
	const result: CartesianChartTestCase[] = []
	testCases.forEach((testCase) => {
		result.push(testCase)
		result.push(makeCompact(testCase))
	})
	return result
}

export function onlyCompact(
	testCases: ReadonlyArray<CartesianChartTestCase>,
): ReadonlyArray<CartesianChartTestCase> {
	return testCases.map(makeCompact)
}

export const ComposedChartCase: CartesianChartTestCase = {
	ChartElement: (props) => <ComposedChart width={500} height={500} {...props} />,
	testName: "ComposedChart",
	tooltipIndex: "0",
}

export const AreaChartCase: CartesianChartTestCase = {
	ChartElement: (props) => <AreaChart width={500} height={500} {...props} />,
	testName: "AreaChart",
	tooltipIndex: "0",
}

export const BarChartCase: CartesianChartTestCase = {
	ChartElement: (props) => <BarChart width={500} height={500} {...props} />,
	testName: "BarChart",
	tooltipIndex: "0",
}

export const LineChartCase: CartesianChartTestCase = {
	ChartElement: (props) => <LineChart width={500} height={500} {...props} />,
	testName: "LineChart",
	tooltipIndex: "0",
}

export const ScatterChartCase: CartesianChartTestCase = {
	ChartElement: (props) => (
		<ScatterChart width={500} height={500} {...props}>
			<Scatter />
		</ScatterChart>
	),
	testName: "ScatterChart",
	tooltipIndex: "0",
}

export const PieChartCase: PolarChartTestCase = {
	ChartElement: (props) => (
		<PieChart width={500} height={500} {...props}>
			<Pie data={PageData} dataKey="uv" />
		</PieChart>
	),
	testName: "PieChart",
}

export const RadarChartCase: PolarChartTestCase = {
	ChartElement: (props) => (
		<RadarChart width={500} height={500} {...props}>
			<Radar dataKey="pv" />
		</RadarChart>
	),
	testName: "RadarChart",
}

export const RadialBarChartCase: PolarChartTestCase = {
	ChartElement: (props) => (
		<RadialBarChart width={500} height={500} {...props}>
			<RadialBar dataKey="pv" />
		</RadialBarChart>
	),
	testName: "RadialBarChart",
}

export const FunnelChartCase: CartesianChartTestCase = {
	ChartElement: (props) => <FunnelChart width={500} height={500} {...props} />,
	testName: "FunnelChart",
	tooltipIndex: "0",
}

export const TreemapChartCase: CartesianChartTestCase = {
	ChartElement: (props) => (
		<Treemap
			isAnimationActive={false}
			nameKey="name"
			dataKey="value"
			type="nest"
			width={500}
			height={500}
			data={exampleTreemapData}
			{...props}
		/>
	),
	testName: "Treemap",
	tooltipIndex: "children[0]children[0]",
}

export const SankeyChartCase: CartesianChartTestCase = {
	ChartElement: (props) => {
		const [, rest] = splitProps(props, ["data"])
		return <Sankey width={400} height={400} {...rest} data={exampleSankeyData} />
	},
	testName: "Sankey",
	tooltipIndex: "0",
}

export const SunburstChartCase: CartesianChartTestCase = {
	ChartElement: (props) => {
		const [, rest] = splitProps(props, ["data"])
		return <SunburstChart width={500} height={500} {...rest} data={exampleSunburstData} />
	},
	testName: "Sunburst",
	tooltipIndex: "0",
}

/**
 * All charts using CartesianChartProps.
 * Treemap and Sankey are left out because they use their own props system.
 */
export const allCartesianChartCases: ReadonlyArray<CartesianChartTestCase> = [
	ComposedChartCase,
	AreaChartCase,
	BarChartCase,
	LineChartCase,
	ScatterChartCase,
	FunnelChartCase,
]

export const allPolarChartCases: ReadonlyArray<PolarChartTestCase> = [
	PieChartCase,
	RadarChartCase,
	RadialBarChartCase,
]

export const allCharts: ReadonlyArray<CartesianChartTestCase> = [
	...allCartesianChartCases,
	TreemapChartCase,
	SankeyChartCase,
	SunburstChartCase,
]

/**
 * Exclude certain charts from the test suite.
 * Uses allCartesianChartCases as the base.
 */
export function allCartesianChartsExcept(
	exceptions: ReadonlyArray<CartesianChartTestCase>,
): ReadonlyArray<CartesianChartTestCase> {
	return allCartesianChartCases.filter((testCase) => !exceptions.includes(testCase))
}
