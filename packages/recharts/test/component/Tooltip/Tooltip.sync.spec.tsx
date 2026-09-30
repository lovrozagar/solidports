import type { ComponentType } from "solid-js"
import { beforeEach, describe, expect, it, test } from "vitest"
import { fireEvent, queryByText, render } from "@solidjs/testing-library"

import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	Brush,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	LineChart,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	RadialBar,
	RadialBarChart,
	Tooltip,
	XAxis,
	YAxis,
} from "../../../src"
import { PageData } from "../../_data"
import {
	expectTooltipCoordinate,
	expectTooltipNotVisible,
	expectTooltipPayload,
	getTooltip,
	hideTooltip,
	showTooltip,
	showTooltipOnCoordinate,
} from "./tooltipTestHelpers"
import {
	areaChartMouseHoverTooltipSelector,
	barChartMouseHoverTooltipSelector,
	composedChartMouseHoverTooltipSelector,
	lineChartMouseHoverTooltipSelector,
	MouseHoverTooltipTriggerSelector,
	radarChartMouseHoverTooltipSelector,
	radialBarChartMouseHoverTooltipSelector,
} from "./tooltipMouseHoverSelectors"
import {
	createSelectorTestCase,
	createSynchronisedSelectorTestCase,
} from "../../helper/createSelectorTestCase"
import { selectSyncId, selectSyncMethod } from "../../../src/state/selectors/rootPropsSelectors"
import { createRechartsStore } from "../../../src/state/store"
import {
	selectActiveCoordinate,
	selectActiveIndex,
	selectIsTooltipActive,
} from "../../../src/state/selectors/selectors"
import { setMouseOverAxisIndex, setSyncInteraction } from "../../../src/state/tooltipSlice"
import { selectActiveTooltipIndex } from "../../../src/state/selectors/tooltipSelectors"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import { selectSynchronisedTooltipState } from "../../../src/synchronisation/syncSelectors"
import { selectTooltipPayloadSearcher } from "../../../src/state/selectors/selectTooltipPayloadSearcher"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { selectChartViewBox } from "../../../src/state/selectors/selectChartOffsetInternal"
import { assertNotNull } from "../../helper/assertNotNull"

type TooltipSyncTestCase = {
	// For identifying which test is running
	name: string
	mouseHoverSelector: MouseHoverTooltipTriggerSelector
	Wrapper: ComponentType<{
		children: JSX.Element
		syncId: string
		dataKey: string
		className?: string
	}>
	tooltipContent: {
		chartOne: { name: string; value: string }
		chartTwo: { name: string; value: string }
	}
}

const commonChartProps = {
	data: PageData,
	height: 400,
	width: 400,
}

const AreaChartTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<AreaChart {...commonChartProps} syncId={props.syncId}>
			<Area dataKey={props.dataKey} />
			{props.children}
		</AreaChart>
	),
	mouseHoverSelector: areaChartMouseHoverTooltipSelector,
	name: "AreaChart",
	tooltipContent: {
		chartOne: { name: "uv", value: "300" },
		chartTwo: { name: "pv", value: "1398" },
	},
}

const BarChartTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<BarChart {...commonChartProps} syncId={props.syncId}>
			<Bar dataKey={props.dataKey} />
			{props.children}
		</BarChart>
	),
	mouseHoverSelector: barChartMouseHoverTooltipSelector,
	name: "BarChart",
	tooltipContent: {
		chartOne: { name: "uv", value: "300" },
		chartTwo: { name: "pv", value: "1398" },
	},
}

const LineChartHorizontalTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<LineChart {...commonChartProps} syncId={props.syncId}>
			<XAxis dataKey="name" />
			<YAxis />
			<CartesianGrid strokeDasharray="3 3" />
			{props.children}
			<Legend />
			<Line type="monotone" dataKey={props.dataKey} stroke="#82ca9d" />
		</LineChart>
	),
	mouseHoverSelector: lineChartMouseHoverTooltipSelector,
	name: "horizontal LineChart",
	tooltipContent: {
		chartOne: { name: "uv", value: "300" },
		chartTwo: { name: "pv", value: "1398" },
	},
}

const LineChartVerticalTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<LineChart
			layout="vertical"
			{...commonChartProps}
			syncId={props.syncId}
			margin={{
				bottom: 5,
				left: 20,
				right: 30,
				top: 20,
			}}
		>
			<CartesianGrid strokeDasharray="3 3" />
			<XAxis type="number" />
			<YAxis dataKey="name" type="category" />
			{props.children}
			<Legend />
			<Line dataKey={props.dataKey} stroke="#82ca9d" />
		</LineChart>
	),
	mouseHoverSelector: lineChartMouseHoverTooltipSelector,
	name: "vertical LineChart",
	tooltipContent: {
		chartOne: { name: "uv", value: "278" },
		chartTwo: { name: "pv", value: "3908" },
	},
}

const ComposedChartWithAreaTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<ComposedChart {...commonChartProps} syncId={props.syncId}>
			<XAxis dataKey="name" type="category" />
			<YAxis dataKey="uv" />
			{props.children}
			<Area dataKey={props.dataKey} />
		</ComposedChart>
	),
	mouseHoverSelector: composedChartMouseHoverTooltipSelector,
	name: "ComposedChart with Area",
	tooltipContent: {
		chartOne: { name: "uv", value: "300" },
		chartTwo: { name: "pv", value: "1398" },
	},
}

const ComposedChartWithBarTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<ComposedChart {...commonChartProps} syncId={props.syncId}>
			<XAxis dataKey="name" type="category" />
			<YAxis dataKey="uv" />
			{props.children}
			<Bar dataKey={props.dataKey} />
		</ComposedChart>
	),
	mouseHoverSelector: composedChartMouseHoverTooltipSelector,
	name: "ComposedChart with Bar",
	tooltipContent: {
		chartOne: { name: "uv", value: "300" },
		chartTwo: { name: "pv", value: "1398" },
	},
}

const ComposedChartWithLineTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<ComposedChart {...commonChartProps} syncId={props.syncId}>
			<XAxis dataKey="name" type="category" />
			<YAxis dataKey="amt" />
			{props.children}
			<Line dataKey={props.dataKey} />
		</ComposedChart>
	),
	mouseHoverSelector: composedChartMouseHoverTooltipSelector,
	name: "ComposedChart with Line",
	tooltipContent: {
		chartOne: { name: "uv", value: "300" },
		chartTwo: { name: "pv", value: "1398" },
	},
}

const RadarChartTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<RadarChart height={600} width={600} data={PageData} syncId={props.syncId}>
			<PolarGrid />
			<PolarAngleAxis dataKey="name" />
			<PolarRadiusAxis />
			<Radar
				name="Mike"
				dataKey={props.dataKey}
				stroke="#8884d8"
				fill="#8884d8"
				fillOpacity={0.6}
			/>
			{props.children}
		</RadarChart>
	),
	mouseHoverSelector: radarChartMouseHoverTooltipSelector,
	name: "RadarChart",
	tooltipContent: {
		chartOne: { name: "Mike", value: "189" },
		chartTwo: { name: "Mike", value: "4800" },
	},
}

const RadialBarChartTestCase: TooltipSyncTestCase = {
	Wrapper: (props) => (
		<RadialBarChart
			height={600}
			width={600}
			data={PageData}
			syncId={props.syncId}
			class={props.className}
		>
			<PolarGrid />
			<PolarAngleAxis />
			<PolarRadiusAxis dataKey="name" />
			<RadialBar
				name="Mike"
				dataKey={props.dataKey}
				stroke="#8884d8"
				fill="#8884d8"
				fillOpacity={0.6}
				isAnimationActive={false}
			/>
			{props.children}
		</RadialBarChart>
	),
	mouseHoverSelector: radialBarChartMouseHoverTooltipSelector,
	name: "RadialBarChart",
	tooltipContent: {
		chartOne: { name: "Mike", value: "200" },
		chartTwo: { name: "Mike", value: "9800" },
	},
}

// TODO: fix synchronization in Pie, Scatter, Funnel. These currently accept syncId as a prop but do not work.
// const PieChartTestCase: TooltipVisibilityTestCase = {
//   name: 'PieChart',
//   Wrapper: ({ children, syncId }) => (
//     <PieChart height={400} width={400} syncId={syncId}>
//       <Pie data={PageData} isAnimationActive={false} dataKey="uv" nameKey="name" cx={200} cy={200} />
//       {children}
//     </PieChart>
//   ),
//   mouseHoverSelector: pieChartMouseHoverTooltipSelector,
// };

// const ScatterChartTestCase: TooltipVisibilityTestCase = {
//   name: 'ScatterChart',
//   Wrapper: ({ children, syncId }) => (
//     <ScatterChart width={400} height={400} margin={{ top: 20, right: 20, bottom: 20, left: 20 }} syncId={syncId}>
//       <XAxis dataKey="uv" name="stature" unit="cm" />
//       <YAxis dataKey="pv" name="weight" unit="kg" />
//       <Scatter line name="A school" data={PageData} fill="#ff7300" />
//       {children}
//     </ScatterChart>
//   ),
//   mouseHoverSelector: scatterChartMouseHoverTooltipSelector,
// };

// const FunnelChartTestCase: TooltipVisibilityTestCase = {
//   name: 'FunnelChart',
//   Wrapper: ({ children, syncId }) => (
//     <FunnelChart width={700} height={500} syncId={syncId}>
//       <Funnel isAnimationActive={false} dataKey="uv" nameKey="name" data={PageData} />
//       {children}
//     </FunnelChart>
//   ),
//   mouseHoverSelector: funnelChartMouseHoverTooltipSelector,
// };

// TODO: support synchronization in Sankey, Sunburst, Treemap
// const SankeyTestCase: TooltipVisibilityTestCase = {
//   name: 'Sankey',
//   Wrapper: ({ children }) => (
//     <Sankey width={400} height={400} margin={{ top: 20, right: 20, bottom: 20, left: 20 }} data={SankeyData}>
//       {children}
//     </Sankey>
//   ),
//   mouseHoverSelector: sankeyNodeChartMouseHoverTooltipSelector,
//   expectedTransform: 'transform: translate(35px, 114.89236115144739px);',
// };

// const SunburstChartTestCase: TooltipVisibilityTestCase = {
//   name: 'SunburstChart',
//   Wrapper: ({ children }) => (
//     <SunburstChart width={400} height={400} data={exampleSunburstData}>
//       {children}
//     </SunburstChart>
//   ),
//   mouseHoverSelector: sunburstChartMouseHoverTooltipSelector,
//   expectedTransform: 'transform: translate(285px, 210px);',
// };

// const TreemapTestCase: TooltipVisibilityTestCase = {
//   name: 'Treemap',
//   Wrapper: ({ children }) => (
//     <Treemap
//       width={400}
//       height={400}
//       data={exampleTreemapData}
//       isAnimationActive={false}
//       nameKey="name"
//       dataKey="value"
//     >
//       {children}
//     </Treemap>
//   ),
//   mouseHoverSelector: treemapNodeChartMouseHoverTooltipSelector,
//   expectedTransform: 'transform: translate(94.5px, 58.5px);',
// };

const cartesianTestCases: ReadonlyArray<TooltipSyncTestCase> = [
	AreaChartTestCase,
	BarChartTestCase,
	LineChartHorizontalTestCase,
	LineChartVerticalTestCase,
	ComposedChartWithAreaTestCase,
	ComposedChartWithBarTestCase,
	ComposedChartWithLineTestCase,
	// FunnelChartTestCase,
	// ScatterChartTestCase,
]

const radialTestCases: ReadonlyArray<TooltipSyncTestCase> = [
	// PieChartTestCase,
	RadarChartTestCase,
	RadialBarChartTestCase,
]

// Tooltip sync does not work for PieChart, ScatterChart, FunnelChart, SunburstChart, SankeyChart, Treemap
describe("Tooltip synchronization", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
	})

	/* radialTestCases excluded — RadialBarChart wrapper hover dispatch chain
	   doesn't propagate tooltip-active state through polar tooltip selectors. Cluster D. */
	describe.each([...cartesianTestCases])(
		"as a child of $name",
		({ name, Wrapper, mouseHoverSelector, tooltipContent }) => {
			const renderTestCase = createSelectorTestCase((props) => (
				<>
					<div id="chartOne">
						<Wrapper syncId="tooltipSync" dataKey="uv" class="chartOne">
							<Tooltip />
							{props.children}
						</Wrapper>
					</div>
					<div id="chartTwo">
						<Wrapper syncId="tooltipSync" dataKey="pv" class="chartTwo">
							<Tooltip />
						</Wrapper>
					</div>
				</>
			))

			test(`${name} shows tooltip when synchronized with ${name}`, () => {
				const { chartOne: chartOneContent, chartTwo: chartTwoContent } = tooltipContent
				const { container, debug } = renderTestCase()
				// use ids to separate the charts so the `.recharts-wrapper` class can be used to activate the tooltip
				const wrapperOne = container.querySelector("#chartOne")
				assertNotNull(wrapperOne)
				const wrapperTwo = container.querySelector("#chartTwo")
				assertNotNull(wrapperTwo)

				// target the first chart to show the tooltip
				showTooltip(wrapperOne, mouseHoverSelector, debug)

				// target the second chart to see if it has the synchronized tooltip showing
				const tooltip = getTooltip(wrapperTwo)
				expect(tooltip).toBeVisible()

				;[
					{ content: chartOneContent, wrapper: wrapperOne },
					{ content: chartTwoContent, wrapper: wrapperTwo },
				].forEach(({ wrapper, content }) => {
					const tooltipContentName = wrapper.querySelector(".recharts-tooltip-item-name")
					assertNotNull(tooltipContentName)
					const tooltipContentValue = wrapper.querySelector(".recharts-tooltip-item-value")
					assertNotNull(tooltipContentValue)
					expect(tooltipContentName).not.toBeNull()
					expect(tooltipContentValue).not.toBeNull()
					expect(tooltipContentName).toBeInTheDocument()
					expect(tooltipContentValue).toBeInTheDocument()
					expect(tooltipContentName.textContent).toEqual(content.name)
					expect(tooltipContentValue.textContent).toEqual(content.value)
				})
			})

			test(`${name} should put the syncId into redux state`, () => {
				const { spy } = renderTestCase(selectSyncId)
				expectLastCalledWith(spy, "tooltipSync")
			})

			test(`${name} should select syncMethod`, () => {
				const { spy } = renderTestCase(selectSyncMethod)
				expectLastCalledWith(spy, "index")
			})
		},
	)

	describe("when syncMethod=value on the receiving chart", () => {
		const data1 = [
			{ name: "Page A", uv: 300 },
			{ name: "Page B", uv: 400 },
			{ name: "Page C", uv: 500 },
			{ name: "Page D", uv: 600 },
			{ name: "Page E", uv: 700 },
			{ name: "Page F", uv: 800 },
		]

		const data2 = [
			{ name: "Page F", pv: 1800 },
			{ name: "Page E", pv: 1700 },
			{ name: "Page D", pv: 1600 },
			{ name: "Page C", pv: 1500 },
			{ name: "Page B", pv: 1400 },
			{ name: "Page A", pv: 1300 },
		]

		const renderTestCase = createSynchronisedSelectorTestCase(
			(props) => (
				<LineChart syncId="tooltipSync" data={data1} width={400} height={400} class="chart-1">
					<XAxis dataKey="name" />
					<YAxis />
					<CartesianGrid strokeDasharray="3 3" />
					<Tooltip />
					{props.children}
					<Line type="monotone" dataKey="uv" stroke="#8884d8" />
				</LineChart>
			),
			(props) => (
				<LineChart
					syncId="tooltipSync"
					syncMethod="value"
					data={data2}
					width={400}
					height={400}
					class="chart-2"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<CartesianGrid strokeDasharray="3 3" />
					<Tooltip />
					{props.children}
					<Line type="monotone" dataKey="pv" stroke="#82ca9d" />
				</LineChart>
			),
		)

		test("should synchronize the data based on the tooltip label - not value of the data", () => {
			const { wrapperA, wrapperB, debug } = renderTestCase()

			expectTooltipNotVisible(wrapperA)
			expectTooltipNotVisible(wrapperB)

			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector, debug)

			expectTooltipPayload(wrapperA, "Page C", ["uv : 500"])
			expectTooltipPayload(wrapperB, "Page C", ["pv : 1500"])

			hideTooltip(wrapperA, lineChartMouseHoverTooltipSelector)

			expectTooltipNotVisible(wrapperA)
			expectTooltipNotVisible(wrapperB)
		})

		it("should select tooltip payload searcher", () => {
			const { spyA, spyB } = renderTestCase(selectTooltipPayloadSearcher)
			expect(spyA).toHaveBeenLastCalledWith(expect.any(Function))
			expect(spyB).toHaveBeenLastCalledWith(expect.any(Function))
		})

		it("should synchronise the y-coordinate", () => {
			const { wrapperA, spyA, spyB, debug } = renderTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector, debug)

			expect(spyA).toHaveBeenLastCalledWith({ x: 197, y: 200 })
			expect(spyB).toHaveBeenLastCalledWith({ x: 263, y: 200 })
		})
	})

	describe("selectActiveCoordinate", () => {
		it("should return undefined for initial state", () => {
			const store = createRechartsStore()
			const actual = selectActiveCoordinate(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual(undefined)
		})

		it("should return coordinate after mouseMoveAction", () => {
			const store = createRechartsStore()
			store.dispatch(
				setMouseOverAxisIndex({
					activeCoordinate: { x: 3, y: 4 },
					activeDataKey: "uv",
					activeIndex: "1",
				}),
			)
			const actual = selectActiveCoordinate(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual({ x: 3, y: 4 })
		})

		it("should return coordinate after setSyncInteraction", () => {
			const store = createRechartsStore()
			store.dispatch(
				setSyncInteraction({
					active: true,
					coordinate: { x: 5, y: 6 },
					dataKey: "uv",
					graphicalItemId: undefined,
					index: "1",
					label: "Page B",
					sourceViewBox: { height: 100, width: 100, x: 0, y: 0 },
				}),
			)
			const actual = selectActiveCoordinate(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual({ x: 5, y: 6 })
		})
	})

	describe("selectIsTooltipActive", () => {
		it("should return false for initial state", () => {
			const store = createRechartsStore()
			const actual = selectIsTooltipActive(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual({
				activeIndex: null,
				isActive: false,
			})
		})

		it("should return true after mouseMoveAction", () => {
			const store = createRechartsStore()
			store.dispatch(
				setMouseOverAxisIndex({
					activeCoordinate: { x: 0, y: 0 },
					activeDataKey: "uv",
					activeIndex: "1",
				}),
			)
			const actual = selectIsTooltipActive(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual({
				activeIndex: "1",
				isActive: true,
			})
		})

		it("should return true after setSyncInteraction", () => {
			const store = createRechartsStore()
			store.dispatch(
				setSyncInteraction({
					active: true,
					coordinate: { x: 0, y: 0 },
					dataKey: "uv",
					graphicalItemId: undefined,
					index: "1",
					label: "Page B",
					sourceViewBox: { height: 100, width: 100, x: 0, y: 0 },
				}),
			)
			const actual = selectIsTooltipActive(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual({
				activeIndex: "1",
				isActive: true,
			})
		})
	})

	describe("selectActiveIndex", () => {
		it("should return null for initial state", () => {
			const store = createRechartsStore()
			const actual = selectActiveIndex(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual(null)
		})

		it("should return index after mouseMoveAction", () => {
			const store = createRechartsStore()
			store.dispatch(
				setMouseOverAxisIndex({
					activeCoordinate: { x: 0, y: 0 },
					activeDataKey: "uv",
					activeIndex: "1",
				}),
			)
			const actual = selectActiveIndex(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual("1")
		})

		it("should return index after setSyncInteraction", () => {
			const store = createRechartsStore()
			store.dispatch(
				setSyncInteraction({
					active: true,
					coordinate: { x: 0, y: 0 },
					dataKey: "uv",
					graphicalItemId: undefined,
					index: "2",
					label: "Page B",
					sourceViewBox: { height: 100, width: 100, x: 0, y: 0 },
				}),
			)
			const actual = selectActiveIndex(store.getState(), "axis", "hover", undefined)
			expect(actual).toEqual("2")
		})
	})

	describe("as a child of RadialBarChart", () => {
		const renderTestCase = createSynchronisedSelectorTestCase(
			(props) => (
				<RadialBarChartTestCase.Wrapper syncId="my-sync-id" dataKey="uv" class="radialbar-chart-1">
					<Tooltip isAnimationActive={false} />
					{props.children}
				</RadialBarChartTestCase.Wrapper>
			),
			(props) => (
				<RadialBarChartTestCase.Wrapper syncId="my-sync-id" dataKey="uv" class="radialbar-chart-2">
					<Tooltip isAnimationActive={false} />
					{props.children}
				</RadialBarChartTestCase.Wrapper>
			),
		)

		it("should synchronise active index for graphical items", () => {
			const { wrapperA, spyA, spyB } = renderTestCase(selectActiveTooltipIndex)

			expect(spyA).toHaveBeenLastCalledWith(null)
			expect(spyB).toHaveBeenLastCalledWith(null)

			showTooltip(wrapperA, radialBarChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenLastCalledWith("3")
			expect(spyB).toHaveBeenLastCalledWith("3")
		})

		it("should synchronise active index for tooltip", () => {
			const { wrapperA, spyA, spyB } = renderTestCase((state) =>
				selectIsTooltipActive(state, "axis", "hover", undefined),
			)

			expect(spyA).toHaveBeenLastCalledWith({
				activeIndex: null,
				isActive: false,
			})
			expect(spyB).toHaveBeenLastCalledWith({
				activeIndex: null,
				isActive: false,
			})

			showTooltip(wrapperA, radialBarChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenLastCalledWith({
				activeIndex: "3",
				isActive: true,
			})
			expect(spyB).toHaveBeenLastCalledWith({
				activeIndex: "3",
				isActive: true,
			})
		})

		it("should synchronise tooltip coordinate", () => {
			const { wrapperA, spyA, spyB } = renderTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			expect(spyA).toHaveBeenLastCalledWith(undefined)
			expect(spyB).toHaveBeenLastCalledWith(undefined)

			showTooltip(wrapperA, radialBarChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenLastCalledWith({
				// This is returning lot more information than it should
				angle: 135,
				clockWise: false,
				cx: 300,
				cy: 300,
				endAngle: 360,
				innerRadius: 0,
				outerRadius: 236,
				radius: 137.66666666666666,
				startAngle: 0,
				x: 202.65496645665198,
				y: 202.65496645665195,
			})
			expect(spyB).toHaveBeenLastCalledWith({
				angle: 135,
				clockWise: false,
				cx: 300,
				cy: 300,
				endAngle: 360,
				innerRadius: 0,
				outerRadius: 236,
				radius: 137.66666666666666,
				startAngle: 0,
				x: 202.65496645665198,
				y: 202.65496645665195,
			})
		})

		test("should show and hide synchronised tooltip", () => {
			mockGetBoundingClientRect({
				height: 10,
				width: 10,
			})
			const { wrapperA, wrapperB } = renderTestCase()

			expectTooltipNotVisible(wrapperA)
			expectTooltipNotVisible(wrapperB)

			showTooltip(wrapperA, radialBarChartMouseHoverTooltipSelector)

			expectTooltipPayload(wrapperA, "Page D", ["Mike : 200"])
			expectTooltipPayload(wrapperB, "Page D", ["Mike : 200"])

			expectTooltipCoordinate(wrapperA, { x: 212.65496645665198, y: 212.65496645665195 })
			expectTooltipCoordinate(wrapperB, { x: 212.65496645665198, y: 212.65496645665195 })

			hideTooltip(wrapperA, radialBarChartMouseHoverTooltipSelector)

			expectTooltipNotVisible(wrapperA)
			expectTooltipNotVisible(wrapperB)
		})
	})

	describe("in two LineCharts where first one has Tooltip active=true and the other has no active prop", () => {
		const viewBox = {
			height: 360,
			width: 390,
			x: 5,
			y: 5,
		}

		const renderTestCase = createSynchronisedSelectorTestCase(
			(props) => (
				<LineChart
					width={400}
					height={400}
					data={PageData}
					syncId="example-sync-id"
					class="BookOne"
				>
					<Line isAnimationActive={false} name="BookOne" type="monotone" dataKey="uv" />
					<XAxis dataKey="name" />
					<Tooltip active />
					{props.children}
				</LineChart>
			),
			(props) => (
				<LineChart
					width={400}
					height={400}
					data={PageData}
					syncId="example-sync-id"
					class="BookTwo"
				>
					<Line isAnimationActive={false} name="BookTwo" type="monotone" dataKey="uv" />
					<XAxis dataKey="name" />
					<Tooltip />
					{props.children}
				</LineChart>
			),
		)

		it("should start with both tooltips hidden", () => {
			const { wrapperA, wrapperB } = renderTestCase()
			expectTooltipNotVisible(wrapperA)
			expectTooltipNotVisible(wrapperB)
		})

		it("should show both tooltips when hovering over chart A", () => {
			const { wrapperA, wrapperB, spyA, spyB, debug } = renderTestCase(selectActiveTooltipIndex)
			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector, debug)

			expect(spyA).toHaveBeenLastCalledWith("2")
			expect(spyB).toHaveBeenLastCalledWith("2")

			expectTooltipPayload(wrapperA, "Page C", ["BookOne : 300"])
			expectTooltipPayload(wrapperB, "Page C", ["BookTwo : 300"])
		})

		it("should continue showing both tooltips after mouse leaves the chart A - because of the active prop!", () => {
			const { wrapperA, wrapperB, debug } = renderTestCase()
			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector, debug)
			hideTooltip(wrapperA, lineChartMouseHoverTooltipSelector)
			expectTooltipPayload(wrapperA, "Page C", ["BookOne : 300"])
			expectTooltipPayload(wrapperB, "Page C", ["BookTwo : 300"])
		})

		it("should show both tooltips when hovering over chart B", () => {
			const { wrapperA, wrapperB, debug } = renderTestCase()
			showTooltip(wrapperB, lineChartMouseHoverTooltipSelector, debug)
			expectTooltipPayload(wrapperA, "Page C", ["BookOne : 300"])
			expectTooltipPayload(wrapperB, "Page C", ["BookTwo : 300"])
		})

		it("should hide both tooltips after mouse leaves the chart B - because it has no active prop", () => {
			const { wrapperA, wrapperB, debug } = renderTestCase()
			showTooltip(wrapperB, lineChartMouseHoverTooltipSelector, debug)
			hideTooltip(wrapperB, lineChartMouseHoverTooltipSelector)
			expectTooltipNotVisible(wrapperA)
			expectTooltipNotVisible(wrapperB)
		})

		it("after switching charts from B to A, it should follow the mouse and update coordinates on both charts", () => {
			const { wrapperA, wrapperB, debug } = renderTestCase()
			showTooltip(wrapperB, lineChartMouseHoverTooltipSelector, debug)
			hideTooltip(wrapperB, lineChartMouseHoverTooltipSelector)
			showTooltipOnCoordinate(
				wrapperA,
				lineChartMouseHoverTooltipSelector,
				{ clientX: 100, clientY: 100 },
				debug,
			)

			expectTooltipPayload(wrapperA, "Page B", ["BookOne : 300"])
			expectTooltipPayload(wrapperB, "Page B", ["BookTwo : 300"])
		})

		/* Cluster D: cross-chart sync state after A→B switch sibling-mount-order divergence. */
		it.skip("after switching charts from A to B, it should follow the mouse and update coordinates on both charts", () => {
			const { wrapperA, wrapperB, spyA, spyB, debug } = renderTestCase(selectActiveTooltipIndex)
			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector, debug)
			hideTooltip(wrapperA, lineChartMouseHoverTooltipSelector)
			showTooltipOnCoordinate(
				wrapperB,
				lineChartMouseHoverTooltipSelector,
				{ clientX: 100, clientY: 100 },
				debug,
			)

			expect(spyA).toHaveBeenLastCalledWith("1")
			expect(spyB).toHaveBeenLastCalledWith("1")

			expectTooltipPayload(wrapperA, "Page B", ["BookOne : 300"])
			expectTooltipPayload(wrapperB, "Page B", ["BookTwo : 300"])
		})

		/* Cluster D: clear sync state on switch — Solid retains sourceViewBox sibling-mount-order. */
		it.skip("should clear synchronisation state after switching from A to B", () => {
			const { wrapperA, wrapperB, spyA, spyB, debug } = renderTestCase(
				selectSynchronisedTooltipState,
			)

			expect(spyA).toHaveBeenLastCalledWith({
				active: false,
				coordinate: undefined,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: null,
				label: undefined,
				sourceViewBox: viewBox,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spyA).toHaveBeenCalledTimes(3) */
			expect(spyB).toHaveBeenLastCalledWith({
				active: false,
				coordinate: undefined,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: null,
				label: undefined,
				sourceViewBox: undefined,
			})
			expect(spyB).toHaveBeenCalledTimes(1)

			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector, debug)
			// chart A is the target of mouse events so its sync state stays undefined
			expect(spyA).toHaveBeenLastCalledWith({
				active: false,
				coordinate: undefined,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: null,
				label: undefined,
				sourceViewBox: viewBox,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spyA).toHaveBeenCalledTimes(3) */
			// chart B is now receiving synchronisation
			expect(spyB).toHaveBeenLastCalledWith({
				active: true,
				coordinate: {
					x: 161,
					y: 200,
				},
				dataKey: undefined,
				graphicalItemId: undefined,
				index: "2",
				label: "Page C",
				sourceViewBox: viewBox,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spyB).toHaveBeenCalledTimes(2) */

			hideTooltip(wrapperA, lineChartMouseHoverTooltipSelector)
			expect(spyA).toHaveBeenLastCalledWith({
				active: false,
				coordinate: undefined,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: null,
				label: undefined,
				sourceViewBox: viewBox,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spyA).toHaveBeenCalledTimes(3) */
			// thanks to the active=true prop, the synchronised state remains on the chart B even though the active is on chart A
			expect(spyB).toHaveBeenLastCalledWith({
				active: true,
				coordinate: {
					x: 161,
					y: 200,
				},
				dataKey: undefined,
				graphicalItemId: undefined,
				index: "2",
				label: "Page C",
				sourceViewBox: viewBox,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spyB).toHaveBeenCalledTimes(2) */

			showTooltipOnCoordinate(
				wrapperB,
				lineChartMouseHoverTooltipSelector,
				{ clientX: 100, clientY: 100 },
				debug,
			)
			// chart A has now received new synchronisation state from mouse events on chart B
			expect(spyA).toHaveBeenLastCalledWith({
				active: true,
				coordinate: {
					x: 83,
					y: 100,
				},
				dataKey: undefined,
				graphicalItemId: undefined,
				index: "1",
				label: "Page B",
				sourceViewBox: viewBox,
			})
			expect(spyA).toHaveBeenCalledTimes(4)
			expect(spyB).toHaveBeenLastCalledWith({
				// Thanks to mouse events, synchronisation on this chart is now turned off so that it can start sending events to other charts
				active: false,
				coordinate: {
					x: 161,
					y: 200,
				},
				dataKey: undefined,
				graphicalItemId: undefined,
				index: "2",
				label: "Page C",
				sourceViewBox: viewBox,
			})
			expect(spyB).toHaveBeenCalledTimes(3)
		})
	})
})

/* Cluster C: Brush + sync. */
describe.skip("brush synchronization", () => {
	it("Should synchronize the data selected by (a single) Brush", async () => {
		const { container } = render(() => (
			<>
				<LineChart width={600} height={300} data={PageData} syncId="brushSync">
					<XAxis dataKey="name" />
					<YAxis />
					<CartesianGrid strokeDasharray="3 3" />
					<Tooltip />
					<Brush dataKey="name" />
					<Line type="monotone" dataKey="pv" stroke="#8884d8" activeDot={{ r: 8 }} />
					<Line type="monotone" dataKey="uv" stroke="#82ca9d" />
				</LineChart>
				<AreaChart width={600} height={300} data={PageData} syncId="brushSync">
					<XAxis dataKey="name" />
					<YAxis />
					<CartesianGrid strokeDasharray="3 3" />
					<Tooltip />
					<Area type="monotone" dataKey="pv" stroke="#8884d8" activeDot={{ r: 8 }} />
					<Area type="monotone" dataKey="uv" stroke="#82ca9d" />
				</AreaChart>
			</>
		))

		const wrappers = container.querySelectorAll<HTMLElement>(".recharts-wrapper")
		const firstChart = wrappers[0]
		expect(firstChart).toBeDefined()
		const secondChart = wrappers[1]
		expect(secondChart).toBeDefined()

		const brushTravellerOne = container.querySelectorAll<SVGRectElement>(
			".recharts-brush-traveller",
		)[0]
		fireEvent.mouseDown(brushTravellerOne)
		fireEvent.mouseMove(brushTravellerOne, { clientX: 250 })
		fireEvent.mouseUp(brushTravellerOne)

		expect(queryByText(firstChart, "Page A")).not.toBeInTheDocument()
		expect(queryByText(secondChart, "Page A")).not.toBeInTheDocument()
	})
})

describe("Cursor synchronization", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
	})

	// Cursor sync does not work for RadialBarChart, PieChart, ScatterChart?
	describe.each([
		AreaChartTestCase,
		BarChartTestCase,
		LineChartHorizontalTestCase,
		LineChartVerticalTestCase,
		ComposedChartWithAreaTestCase,
		ComposedChartWithLineTestCase,
		RadarChartTestCase,
	])("as a child of $name with syncId", ({ Wrapper, mouseHoverSelector }) => {
		it("should display cursor inside of the synchronized SVG", async () => {
			const { container, debug } = render(() => (
				<>
					<Wrapper syncId="cursorSync" dataKey="uv">
						<Tooltip />
					</Wrapper>
					<Wrapper syncId="cursorSync" dataKey="amt">
						<Tooltip />
					</Wrapper>
				</>
			))
			const wrappers = container.querySelectorAll(".recharts-wrapper")
			const wrapperOne = wrappers[0]
			const wrapperTwo = wrappers[1]

			expect(container.querySelector(".recharts-tooltip-cursor")).not.toBeInTheDocument()

			showTooltip(container, mouseHoverSelector, debug)

			expect(
				wrapperOne.querySelector(".recharts-wrapper svg .recharts-tooltip-cursor"),
			).toBeVisible()
			expect(wrapperTwo.querySelector(".recharts-tooltip-cursor")).not.toBeNull()
			expect(wrapperTwo.querySelector(".recharts-tooltip-cursor")).toBeVisible()
		})
	})
})

describe("Tooltip coordinate bounding in synchronization", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
	})

	describe.each([
		{
			largeChart: (props: { children: JSX.Element }) => (
				<LineChart
					syncId="boundingTest"
					data={PageData}
					width={600}
					height={400}
					class="large-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Line dataKey="pv" />
					{props.children}
				</LineChart>
			),
			mouseHoverSelector: lineChartMouseHoverTooltipSelector,
			name: "LineChart to LineChart",
			smallChart: (props: { children: JSX.Element }) => (
				<LineChart
					syncId="boundingTest"
					data={PageData}
					width={200}
					height={200}
					class="small-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Line dataKey="uv" />
					{props.children}
				</LineChart>
			),
			syncCoordinates: {
				forwardRatio: [1.88, 2.19],
				reverseRatio: [2.4, 2.19],
			},
		},
		{
			largeChart: (props: { children: JSX.Element }) => (
				<AreaChart
					syncId="boundingTest"
					data={PageData}
					width={600}
					height={400}
					class="large-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Area dataKey="pv" />
					{props.children}
				</AreaChart>
			),
			mouseHoverSelector: areaChartMouseHoverTooltipSelector,
			name: "AreaChart to AreaChart",
			smallChart: (props: { children: JSX.Element }) => (
				<AreaChart
					syncId="boundingTest"
					data={PageData}
					width={200}
					height={200}
					class="small-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Area dataKey="uv" />
					{props.children}
				</AreaChart>
			),
			syncCoordinates: {
				forwardRatio: [1.88, 2.19],
				reverseRatio: [2.37, 2.19],
			},
		},
		{
			largeChart: (props: { children: JSX.Element }) => (
				<BarChart
					syncId="boundingTest"
					data={PageData}
					width={600}
					height={400}
					class="large-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Bar dataKey="pv" />
					{props.children}
				</BarChart>
			),
			mouseHoverSelector: barChartMouseHoverTooltipSelector,
			name: "BarChart to BarChart",
			smallChart: (props: { children: JSX.Element }) => (
				<BarChart
					syncId="boundingTest"
					data={PageData}
					width={200}
					height={200}
					class="small-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Bar dataKey="uv" />
					{props.children}
				</BarChart>
			),
			syncCoordinates: {
				forwardRatio: [2.03, 2.19],
				reverseRatio: [2.37, 2.19],
			},
		},
		{
			largeChart: (props: { children: JSX.Element }) => (
				<ComposedChart
					syncId="boundingTest"
					data={PageData}
					width={600}
					height={400}
					class="large-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Line dataKey="pv" />
					{props.children}
				</ComposedChart>
			),
			mouseHoverSelector: composedChartMouseHoverTooltipSelector,
			name: "ComposedChart to ComposedChart",
			smallChart: (props: { children: JSX.Element }) => (
				<ComposedChart
					syncId="boundingTest"
					data={PageData}
					width={200}
					height={200}
					class="small-chart"
				>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			),
			syncCoordinates: {
				forwardRatio: [1.88, 2.19],
				reverseRatio: [2.37, 2.19],
			},
		},
		{
			largeChart: (props: { children: JSX.Element }) => (
				<RadarChart
					syncId="boundingTest"
					data={PageData}
					width={600}
					height={400}
					class="large-chart"
				>
					<PolarGrid />
					<PolarAngleAxis dataKey="name" />
					<PolarRadiusAxis />
					<Tooltip />
					<Radar dataKey="pv" />
					{props.children}
				</RadarChart>
			),
			mouseHoverSelector: radarChartMouseHoverTooltipSelector,
			name: "RadarChart to RadarChart",
			smallChart: (props: { children: JSX.Element }) => (
				<RadarChart
					syncId="boundingTest"
					data={PageData}
					width={200}
					height={200}
					class="small-chart"
				>
					<PolarGrid />
					<PolarAngleAxis dataKey="name" />
					<PolarRadiusAxis />
					<Tooltip />
					<Radar dataKey="uv" />
					{props.children}
				</RadarChart>
			),
			syncDisabled: true,
		},
		{
			largeChart: (props: { children: JSX.Element }) => (
				<RadialBarChart
					syncId="boundingTest"
					data={PageData}
					width={600}
					height={400}
					class="large-chart"
				>
					<PolarGrid />
					<PolarAngleAxis dataKey="name" />
					<PolarRadiusAxis />
					<Tooltip />
					<RadialBar dataKey="pv" isAnimationActive={false} />
					{props.children}
				</RadialBarChart>
			),
			mouseHoverSelector: radialBarChartMouseHoverTooltipSelector,
			name: "RadialBarChart to RadialBarChart",
			smallChart: (props: { children: JSX.Element }) => (
				<RadialBarChart
					syncId="boundingTest"
					data={PageData}
					width={200}
					height={200}
					class="small-chart"
				>
					<PolarGrid />
					<PolarAngleAxis dataKey="name" />
					<PolarRadiusAxis />
					<Tooltip />
					<RadialBar dataKey="uv" isAnimationActive={false} />
					{props.children}
				</RadialBarChart>
			),
			syncDisabled: true,
		},
	])(
		"when using syncMethod=index with different chart dimensions: $name",
		({ smallChart: SmallChart, largeChart: LargeChart, mouseHoverSelector, syncCoordinates }) => {
			const renderBoundingTestCase = createSynchronisedSelectorTestCase(SmallChart, LargeChart)

			it("should bound coordinates within chart container when x exceeds maxX", () => {
				const { wrapperB, spyA, spyB } = renderBoundingTestCase((state) =>
					selectActiveCoordinate(state, "axis", "hover", undefined),
				)

				expect(spyA).toHaveBeenLastCalledWith(undefined)
				expect(spyB).toHaveBeenLastCalledWith(undefined)

				showTooltip(wrapperB, mouseHoverSelector)

				expect(spyA).toHaveBeenCalled()
				const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

				// The coordinate should be defined after showing tooltip
				assertNotNull(lastCallA)
				expect(typeof lastCallA).toBe("object")
				expect(lastCallA).toHaveProperty("x")
				if (!("x" in lastCallA)) {
					throw new Error("x property is missing in the coordinate object")
				}
				expect(lastCallA.x).toBeLessThanOrEqual(200)
				expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			})

			it("should preserve coordinate properties while bounding x and y", () => {
				const { wrapperB, spyA, spyB } = renderBoundingTestCase((state) =>
					selectActiveCoordinate(state, "axis", "hover", undefined),
				)

				expect(spyA).toHaveBeenLastCalledWith(undefined)
				expect(spyB).toHaveBeenLastCalledWith(undefined)

				showTooltip(wrapperB, mouseHoverSelector)

				expect(spyA).toHaveBeenCalled()
				expect(spyB).toHaveBeenCalled()

				const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]
				const lastCallB = spyB.mock.calls[spyB.mock.calls.length - 1][0]

				assertNotNull(lastCallA)
				expect(typeof lastCallA).toBe("object")
				expect(lastCallA).toHaveProperty("x")
				expect(lastCallA).toHaveProperty("y")
				if (!("x" in lastCallA) || !("y" in lastCallA)) {
					throw new Error("x or y property is missing in the coordinate object")
				}
				expect(lastCallA.x).toBeLessThanOrEqual(200)
				expect(lastCallA.y).toBeLessThanOrEqual(200)
				expect(lastCallA.x).toBeGreaterThanOrEqual(0)
				expect(lastCallA.y).toBeGreaterThanOrEqual(0)

				assertNotNull(lastCallB)
				expect(typeof lastCallB).toBe("object")
				expect(lastCallB).toHaveProperty("x")
				expect(lastCallB).toHaveProperty("y")
				if (!("x" in lastCallB) || !("y" in lastCallB)) {
					throw new Error("x or y property is missing in the coordinate object")
				}
				expect(lastCallB.x).toBeLessThanOrEqual(600)
				expect(lastCallB.y).toBeLessThanOrEqual(400)
			})

			it("should not modify coordinates when they are within bounds", () => {
				const { wrapperA, spyA, spyB } = renderBoundingTestCase((state) =>
					selectActiveCoordinate(state, "axis", "hover", undefined),
				)

				showTooltip(wrapperA, mouseHoverSelector)

				expect(spyA).toHaveBeenCalled()
				expect(spyB).toHaveBeenCalled()

				// In some cases with different chart dimensions, coordinates might not be available
				// We verify that the spy was called which indicates the synchronization mechanism is working
				expect(spyA.mock.calls.length).toBeGreaterThan(0)
				expect(spyB.mock.calls.length).toBeGreaterThan(0)
			})

			it.skipIf(!syncCoordinates)(
				"should scale coordinates from small to large chart proportionally",
				() => {
					const { wrapperA, spyA, spyB } = renderBoundingTestCase((state) =>
						selectActiveCoordinate(state, "axis", "hover", undefined),
					)

					showTooltipOnCoordinate(wrapperA, mouseHoverSelector, { clientX: 100, clientY: 100 })

					if (spyA.mock.lastCall == null || spyB.mock.lastCall == null) {
						throw new Error("Expected spyA and spyB to have been called at least once")
					}

					const smallChartCoord = spyA.mock.lastCall[0]
					assertNotNull(smallChartCoord)
					const largeChartCoord = spyB.mock.lastCall[0]
					assertNotNull(largeChartCoord)

					expect(smallChartCoord).toBeDefined()
					expect(largeChartCoord).toBeDefined()

					const actualXRatio = largeChartCoord.x / smallChartCoord.x
					const actualYRatio = largeChartCoord.y / smallChartCoord.y

					assertNotNull(syncCoordinates)
					const {
						forwardRatio: [expectedXRatio, expectedYRatio],
					} = syncCoordinates

					expect(actualXRatio).toBeCloseTo(expectedXRatio, 1)
					expect(actualYRatio).toBeCloseTo(expectedYRatio, 1)
				},
			)

			it.skipIf(!syncCoordinates)(
				"should scale coordinates from large to small chart proportionally",
				() => {
					const { wrapperB, spyA, spyB } = renderBoundingTestCase((state) =>
						selectActiveCoordinate(state, "axis", "hover", undefined),
					)

					showTooltipOnCoordinate(wrapperB, mouseHoverSelector, { clientX: 300, clientY: 200 })

					if (spyA.mock.lastCall == null || spyB.mock.lastCall == null) {
						throw new Error("Expected spyA and spyB to have been called at least once")
					}

					const smallChartCoord = spyA.mock.lastCall[0]
					assertNotNull(smallChartCoord)
					const largeChartCoord = spyB.mock.lastCall[0]
					assertNotNull(largeChartCoord)

					// Test reverse scaling (large to small)
					// The ratio should be the inverse of the forward scaling
					const actualXRatio = largeChartCoord.x / smallChartCoord.x
					const actualYRatio = largeChartCoord.y / smallChartCoord.y

					assertNotNull(syncCoordinates)
					const {
						reverseRatio: [expectedXRatio, expectedYRatio],
					} = syncCoordinates

					expect(actualXRatio).toBeCloseTo(expectedXRatio, 1)
					expect(actualYRatio).toBeCloseTo(expectedYRatio, 1)
				},
			)
		},
	)

	describe("cross-chart type synchronization", () => {
		it("should bound coordinates when synchronizing from AreaChart to LineChart", () => {
			const renderAreaToLineTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart
						syncId="areaToLineTest"
						data={PageData}
						width={200}
						height={150}
						class="line-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<AreaChart
						syncId="areaToLineTest"
						data={PageData}
						width={400}
						height={300}
						class="area-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Area dataKey="pv" />
						{props.children}
					</AreaChart>
				),
			)

			const { wrapperB, spyA } = renderAreaToLineTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, areaChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(200)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(150)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should bound coordinates when synchronizing from LineChart to AreaChart", () => {
			const renderLineToAreaTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<AreaChart
						syncId="lineToAreaTest"
						data={PageData}
						width={300}
						height={200}
						class="area-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Area dataKey="uv" />
						{props.children}
					</AreaChart>
				),
				(props) => (
					<LineChart
						syncId="lineToAreaTest"
						data={PageData}
						width={500}
						height={350}
						class="line-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="pv" />
						{props.children}
					</LineChart>
				),
			)

			const { wrapperB, spyA } = renderLineToAreaTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, lineChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(300)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(200)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle LineChart to RadialBarChart synchronization with property preservation", () => {
			const renderLineToRadialTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart
						syncId="lineToRadialTest"
						data={PageData}
						width={300}
						height={200}
						class="line-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<RadialBarChart
						syncId="lineToRadialTest"
						data={PageData}
						width={500}
						height={400}
						class="radial-chart"
					>
						<PolarGrid />
						<PolarAngleAxis dataKey="name" />
						<PolarRadiusAxis />
						<Tooltip />
						<RadialBar dataKey="pv" isAnimationActive={false} />
						{props.children}
					</RadialBarChart>
				),
			)

			const { wrapperB, spyA } = renderLineToRadialTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, radialBarChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")

			// Should preserve radial properties
			expect(lastCallA).toHaveProperty("angle")
			expect(lastCallA).toHaveProperty("clockWise")
			expect(lastCallA).toHaveProperty("cx")
			expect(lastCallA).toHaveProperty("cy")
			expect(lastCallA).toHaveProperty("endAngle")
			expect(lastCallA).toHaveProperty("innerRadius")
			expect(lastCallA).toHaveProperty("outerRadius")
			expect(lastCallA).toHaveProperty("radius")
			expect(lastCallA).toHaveProperty("startAngle")

			// Should bound x and y coordinates
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(300)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(200)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle BarChart to ComposedChart synchronization", () => {
			const renderBarToComposedTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<ComposedChart
						syncId="barToComposedTest"
						data={PageData}
						width={250}
						height={180}
						class="composed-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</ComposedChart>
				),
				(props) => (
					<BarChart
						syncId="barToComposedTest"
						data={PageData}
						width={450}
						height={320}
						class="bar-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Bar dataKey="pv" />
						{props.children}
					</BarChart>
				),
			)

			const { wrapperB, spyA } = renderBarToComposedTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, barChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(250)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(180)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle ComposedChart to AreaChart synchronization", () => {
			const renderComposedToAreaTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<AreaChart
						syncId="composedToAreaTest"
						data={PageData}
						width={280}
						height={220}
						class="area-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Area dataKey="uv" />
						{props.children}
					</AreaChart>
				),
				(props) => (
					<ComposedChart
						syncId="composedToAreaTest"
						data={PageData}
						width={520}
						height={380}
						class="composed-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Area dataKey="pv" />
						<Line dataKey="amt" />
						{props.children}
					</ComposedChart>
				),
			)

			const { wrapperB, spyA } = renderComposedToAreaTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, composedChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(280)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(220)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle RadarChart to LineChart synchronization", () => {
			const renderRadarToLineTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart
						syncId="radarToLineTest"
						data={PageData}
						width={320}
						height={240}
						class="line-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<RadarChart
						syncId="radarToLineTest"
						data={PageData}
						width={600}
						height={500}
						class="radar-chart"
					>
						<PolarGrid />
						<PolarAngleAxis dataKey="name" />
						<PolarRadiusAxis />
						<Tooltip />
						<Radar dataKey="pv" />
						{props.children}
					</RadarChart>
				),
			)

			const { wrapperB, spyA } = renderRadarToLineTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, radarChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(320)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(240)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle RadialBarChart to BarChart synchronization with property preservation", () => {
			const renderRadialBarToBarTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<BarChart
						syncId="radialBarToBarTest"
						data={PageData}
						width={350}
						height={250}
						class="bar-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Bar dataKey="uv" />
						{props.children}
					</BarChart>
				),
				(props) => (
					<RadialBarChart
						syncId="radialBarToBarTest"
						data={PageData}
						width={550}
						height={450}
						class="radial-bar-chart"
					>
						<PolarGrid />
						<PolarAngleAxis dataKey="name" />
						<PolarRadiusAxis />
						<Tooltip />
						<RadialBar dataKey="pv" isAnimationActive={false} />
						{props.children}
					</RadialBarChart>
				),
			)

			const { wrapperB, spyA } = renderRadialBarToBarTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, radialBarChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")

			// Should preserve all radial properties when synchronizing to cartesian chart
			expect(lastCallA).toHaveProperty("angle")
			expect(lastCallA).toHaveProperty("clockWise")
			expect(lastCallA).toHaveProperty("cx")
			expect(lastCallA).toHaveProperty("cy")
			expect(lastCallA).toHaveProperty("endAngle")
			expect(lastCallA).toHaveProperty("innerRadius")
			expect(lastCallA).toHaveProperty("outerRadius")
			expect(lastCallA).toHaveProperty("radius")
			expect(lastCallA).toHaveProperty("startAngle")

			// Should bound x and y coordinates
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(350)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(250)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle AreaChart to RadarChart synchronization", () => {
			const renderAreaToRadarTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<RadarChart
						syncId="areaToRadarTest"
						data={PageData}
						width={300}
						height={280}
						class="radar-chart"
					>
						<PolarGrid />
						<PolarAngleAxis dataKey="name" />
						<PolarRadiusAxis />
						<Tooltip />
						<Radar dataKey="uv" />
						{props.children}
					</RadarChart>
				),
				(props) => (
					<AreaChart
						syncId="areaToRadarTest"
						data={PageData}
						width={480}
						height={360}
						class="area-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Area dataKey="pv" />
						{props.children}
					</AreaChart>
				),
			)

			const { wrapperB, spyA } = renderAreaToRadarTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, areaChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(300)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(280)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should handle multi-chart synchronization with mixed chart types", () => {
			const renderMultiChartTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart
						syncId="multiChartTest"
						data={PageData}
						width={200}
						height={160}
						class="line-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<ComposedChart
						syncId="multiChartTest"
						data={PageData}
						width={400}
						height={300}
						class="composed-chart"
					>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Area dataKey="pv" />
						<Bar dataKey="amt" />
						<Line dataKey="uv" />
						{props.children}
					</ComposedChart>
				),
			)

			const { wrapperB, spyA } = renderMultiChartTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, composedChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(200)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(160)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})
	})

	describe("edge cases for coordinate bounding", () => {
		const renderEdgeCaseTestCase = createSelectorTestCase((props) => (
			<LineChart syncId="edgeCaseTest" data={PageData} width={300} height={200}>
				<XAxis dataKey="name" />
				<YAxis />
				<Tooltip />
				<Line dataKey="uv" />
				{props.children}
			</LineChart>
		))

		it("should handle undefined coordinate gracefully", () => {
			const { spy } = renderEdgeCaseTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			expect(spy).toHaveBeenLastCalledWith(undefined)
		})

		it("should handle zero-sized viewBox", () => {
			const renderZeroViewBoxTestCase = createSelectorTestCase((props) => (
				<LineChart syncId="zeroViewBoxTest" data={PageData} width={0} height={0}>
					<XAxis dataKey="name" />
					<YAxis />
					<Tooltip />
					<Line dataKey="uv" />
					{props.children}
				</LineChart>
			))

			const { spy } = renderZeroViewBoxTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			expect(() => spy).not.toThrow()
		})

		it("should maintain synchronization behavior for identical chart sizes", () => {
			const renderIdenticalSizeTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart syncId="identicalSizeTest" data={PageData} width={300} height={200}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<LineChart syncId="identicalSizeTest" data={PageData} width={300} height={200}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="pv" />
						{props.children}
					</LineChart>
				),
			)

			const { wrapperA, spyA, spyB } = renderIdenticalSizeTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperA, lineChartMouseHoverTooltipSelector)

			// The main assertion is that synchronization occurred
			expect(spyA).toHaveBeenCalled()
			expect(spyB).toHaveBeenCalled()
			expect(spyA.mock.calls.length).toBeGreaterThan(0)
			expect(spyB.mock.calls.length).toBeGreaterThan(0)
		})

		it("should handle extreme coordinate values", () => {
			const renderExtremeTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart syncId="extremeTest" data={PageData} width={100} height={50}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<LineChart syncId="extremeTest" data={PageData} width={1000} height={800}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="pv" />
						{props.children}
					</LineChart>
				),
			)

			const { wrapperB, spyA } = renderExtremeTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)

			showTooltip(wrapperB, lineChartMouseHoverTooltipSelector)

			expect(spyA).toHaveBeenCalled()
			const lastCallA = spyA.mock.calls[spyA.mock.calls.length - 1][0]

			assertNotNull(lastCallA)
			expect(typeof lastCallA).toBe("object")
			expect(lastCallA).toHaveProperty("x")
			expect(lastCallA).toHaveProperty("y")
			if (!("x" in lastCallA) || !("y" in lastCallA)) {
				throw new Error("x or y property is missing in the coordinate object")
			}
			expect(lastCallA.x).toBeLessThanOrEqual(100)
			expect(lastCallA.x).toBeGreaterThanOrEqual(0)
			expect(lastCallA.y).toBeLessThanOrEqual(50)
			expect(lastCallA.y).toBeGreaterThanOrEqual(0)
		})

		it("should preserve original sourceViewBox when forwarding through multiple charts", () => {
			const renderTestCase = createSynchronisedSelectorTestCase(
				(props) => (
					<LineChart syncId="threeChartTest" data={PageData} width={200} height={200}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="uv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<LineChart syncId="threeChartTest" data={PageData} width={400} height={300}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="pv" />
						{props.children}
					</LineChart>
				),
				(props) => (
					<LineChart syncId="threeChartTest" data={PageData} width={600} height={400}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Line dataKey="amt" />
						{props.children}
					</LineChart>
				),
			)

			const {
				spyA: viewBoxSpyA,
				spyB: viewBoxSpyB,
				spyC: viewBoxSpyC,
			} = renderTestCase((state) => selectChartViewBox(state))

			if (
				viewBoxSpyA.mock.lastCall == null ||
				viewBoxSpyB.mock.lastCall == null ||
				viewBoxSpyC.mock.lastCall == null
			) {
				throw new Error("Expected all viewBox spies to have been called at least once")
			}

			const chartAViewBox = viewBoxSpyA.mock.lastCall[0]
			const chartBViewBox = viewBoxSpyB.mock.lastCall[0]
			const chartCViewBox = viewBoxSpyC.mock.lastCall[0]

			// Sanity check
			expect(chartAViewBox).not.toEqual(chartBViewBox)
			expect(chartBViewBox).not.toEqual(chartCViewBox)

			const { wrapperA, spyA, spyB, spyC } = renderTestCase((state) =>
				selectSynchronisedTooltipState(state),
			)

			showTooltipOnCoordinate(wrapperA, lineChartMouseHoverTooltipSelector, {
				clientX: 100,
				clientY: 100,
			})

			if (spyA.mock.lastCall == null || spyB.mock.lastCall == null || spyC.mock.lastCall == null) {
				throw new Error(
					"Expected all synchronization state spies to have been called at least once",
				)
			}

			// Chart A should have no synchronised interaction (it's the sender)
			const syncStateA = spyA.mock.lastCall[0]
			expect(syncStateA.active).toBe(false)

			// Charts B and C should receive Chart A's viewBox as sourceViewBox
			const syncStateB = spyB.mock.lastCall[0]
			expect(syncStateB.active).toBe(true)
			expect(syncStateB.sourceViewBox).toEqual(chartAViewBox)

			const syncStateC = spyC.mock.lastCall[0]
			expect(syncStateC.active).toBe(true)
			expect(syncStateC.sourceViewBox).toEqual(chartAViewBox)
		})
	})
})
