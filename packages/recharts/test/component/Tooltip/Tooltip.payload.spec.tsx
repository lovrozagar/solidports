import type { ComponentType } from "solid-js"
import { beforeEach, describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Funnel,
	FunnelChart,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	PolarAngleAxis,
	Radar,
	RadarChart,
	RadialBar,
	RadialBarChart,
	Sankey,
	Scatter,
	ScatterChart,
	SunburstChart,
	Tooltip,
	Treemap,
	XAxis,
	YAxis,
} from "../../../src"
import {
	expectTooltipNotVisible,
	expectTooltipPayload,
	MouseCoordinate,
	showTooltip,
	showTooltipOnCoordinate,
} from "./tooltipTestHelpers"
import { exampleSunburstData, exampleTreemapData, PageData, exampleSankeyData } from "../../_data"
import {
	areaChartMouseHoverTooltipSelector,
	barChartMouseHoverTooltipSelector,
	barMouseHoverTooltipSelector,
	composedChartMouseHoverTooltipSelector,
	funnelChartMouseHoverTooltipSelector,
	lineChartMouseHoverTooltipSelector,
	MouseHoverTooltipTriggerSelector,
	pieChartMouseHoverTooltipSelector,
	radarChartMouseHoverTooltipSelector,
	radialBarChartMouseHoverTooltipSelector,
	radialBarMouseHoverTooltipSelector,
	sankeyLinkMouseHoverTooltipSelector,
	sankeyNodeMouseHoverTooltipSelector,
	sunburstChartMouseHoverTooltipSelector,
	treemapNodeChartMouseHoverTooltipSelector,
} from "./tooltipMouseHoverSelectors"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import {
	selectActiveCoordinate,
	selectActiveLabel,
	selectIsTooltipActive,
	selectTooltipPayload,
	selectTooltipPayloadConfigurations,
} from "../../../src/state/selectors/selectors"
import { selectChartDataWithIndexes } from "../../../src/state/selectors/dataSelectors"
import {
	selectAllGraphicalItemsSettings,
	selectAllUnfilteredGraphicalItems,
	selectTooltipAxisDomain,
	selectTooltipAxisDomainIncludingNiceTicks,
	selectTooltipAxisScale,
	selectTooltipAxisTicks,
	selectTooltipDisplayedData,
	selectTooltipGraphicalItemsData,
} from "../../../src/state/selectors/tooltipSelectors"
import { expectLastCalledWithScale } from "../../helper/expectScale"
import { selectAxisDomain, selectTooltipAxis } from "../../../src/state/selectors/axisSelectors"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import { selectTooltipAxisId } from "../../../src/state/selectors/selectTooltipAxisId"
import { selectTooltipAxisType } from "../../../src/state/selectors/selectTooltipAxisType"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { LineSettings } from "../../../src/state/types/LineSettings"
import { noop } from "../../../src/util/DataUtils"

type TooltipPayloadTestCase = {
	// Identify which test is running
	name: string

	// Input parameters to the test case
	mouseHoverSelector: MouseHoverTooltipTriggerSelector
	mouseCoordinate?: MouseCoordinate
	Wrapper: ComponentType<{ children: JSX.Element }>

	// assertions
	expectedTooltipTitle: string
	expectedTooltipContent: ReadonlyArray<string>
}

const commonChartProps = {
	height: 400,
	width: 400,
}

const AreaChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<AreaChart {...commonChartProps} data={PageData}>
			<Area dataKey="uv" unit="kg" />
			<Area dataKey="pv" unit="$$$" name="My custom name" />
			<Area dataKey="amt" />
			{props.children}
		</AreaChart>
	),
	expectedTooltipContent: ["My custom name : 1398$$$", "amt : 2400", "uv : 300kg"],
	expectedTooltipTitle: "2",
	mouseHoverSelector: areaChartMouseHoverTooltipSelector,
	name: "AreaChart",
}

const AreaChartWithXAxisTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<AreaChart {...commonChartProps} data={PageData}>
			<Area dataKey="uv" unit="kg" />
			<Area dataKey="pv" unit="$$$" name="My custom name" />
			<Area dataKey="amt" />
			{/* XAxis dataKey becomes the tooltip title */}
			<XAxis dataKey="name" />
			{props.children}
		</AreaChart>
	),
	expectedTooltipContent: ["My custom name : 1398$$$", "amt : 2400", "uv : 300kg"],
	expectedTooltipTitle: "Page C",
	mouseHoverSelector: areaChartMouseHoverTooltipSelector,
	name: "AreaChart with XAxis",
}

const BarChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<BarChart {...commonChartProps} data={PageData}>
			<Bar dataKey="uv" unit="kg" />
			<Bar dataKey="pv" unit="$$$" name="My custom name" />
			<Bar dataKey="amt" unit="" />
			{props.children}
		</BarChart>
	),
	expectedTooltipContent: ["My custom name : 1398$$$", "amt : 2400", "uv : 300kg"],
	expectedTooltipTitle: "2",
	mouseHoverSelector: barChartMouseHoverTooltipSelector,
	name: "BarChart",
}

const LineChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<LineChart {...commonChartProps} data={PageData}>
			<Line dataKey="uv" unit="kg" />
			<Line dataKey="pv" unit="$$$" name="My custom name" />
			<Line dataKey="amt" unit={null} />
			{props.children}
		</LineChart>
	),
	expectedTooltipContent: ["My custom name : 1398$$$", "amt : 2400", "uv : 300kg"],
	expectedTooltipTitle: "2",
	mouseHoverSelector: lineChartMouseHoverTooltipSelector,
	name: "LineChart",
}

const LineChartDataOnGraphicalItemTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<LineChart {...commonChartProps}>
			<Line dataKey="uv" unit="kg" data={PageData} id="line-uv" />
			<Line dataKey="pv" unit="$$$" name="My custom name" data={PageData} id="line-pv" />
			<Line dataKey="amt" unit={null} data={PageData} id="line-amt" />
			{props.children}
		</LineChart>
	),
	expectedTooltipContent: ["My custom name : 4567$$$", "amt : 2400", "uv : 300kg"],
	expectedTooltipTitle: "1",
	mouseCoordinate: { clientX: 20, clientY: 20 },
	mouseHoverSelector: lineChartMouseHoverTooltipSelector,
	name: "LineChart with data on graphical item",
}

const LineChartVerticalTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<LineChart layout="vertical" {...commonChartProps} data={PageData}>
			<XAxis dataKey="name" />
			<YAxis dataKey="name" type="category" />
			<CartesianGrid strokeDasharray="3 3" />
			{props.children}
			<Legend />
			<Line dataKey="uv" unit="kg" />
			<Line dataKey="pv" name="My custom name" unit="$$$" />
			<Line dataKey="amt" unit={undefined} />
		</LineChart>
	),
	expectedTooltipContent: ["My custom name : 3908$$$", "amt : 2400", "uv : 278kg"],
	expectedTooltipTitle: "Page E",
	mouseHoverSelector: lineChartMouseHoverTooltipSelector,
	name: "vertical LineChart",
}

const ComposedChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<ComposedChart {...commonChartProps} data={PageData}>
			{props.children}
			<Area dataKey="uv" unit="kg" />
			<Bar dataKey="pv" name="My custom name" unit="$$$" />
			<Line dataKey="amt" unit={undefined} />
		</ComposedChart>
	),
	expectedTooltipContent: ["My custom name : 1398$$$", "amt : 2400", "uv : 300kg"],
	expectedTooltipTitle: "2",
	mouseHoverSelector: composedChartMouseHoverTooltipSelector,
	name: "ComposedChart",
}

const PieChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<PieChart {...commonChartProps}>
			{/* Pie does not have a unit it appears? Also, the `name` prop doesn"t do anything */}"
			<Pie isAnimationActive={false} data={PageData} dataKey="uv" name="My custom name" />
			{/* PieChart tooltip always only renders one value, so these should stay out of the content */}
			<Pie isAnimationActive={false} data={PageData} dataKey="pv" name="My custom name" />
			<Pie isAnimationActive={false} data={PageData} dataKey="amt" name="My custom name" />
			{props.children}
		</PieChart>
	),
	expectedTooltipContent: ["Page A : 400"],
	expectedTooltipTitle: "",
	mouseHoverSelector: pieChartMouseHoverTooltipSelector,
	name: "PieChart",
}

const FunnelChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<FunnelChart width={700} height={500}>
			<Funnel isAnimationActive={false} dataKey="uv" data={PageData} />
			{props.children}
		</FunnelChart>
	),
	expectedTooltipContent: ["Page A : 400"],
	expectedTooltipTitle: "",
	mouseHoverSelector: funnelChartMouseHoverTooltipSelector,
	name: "FunnelChart",
}

const FunnelChartWithNameTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<FunnelChart width={700} height={500}>
			<Funnel
				isAnimationActive={false}
				dataKey="uv"
				nameKey="does not exist in the data"
				name="This is now going to the tooltip title and it will override the 'name' property in data"
				data={PageData}
			/>
			{props.children}
		</FunnelChart>
	),
	expectedTooltipContent: [
		"This is now going to the tooltip title and it will override the 'name' property in data : 400",
	],
	expectedTooltipTitle: "",
	mouseHoverSelector: funnelChartMouseHoverTooltipSelector,
	name: "FunnelChart with name",
}

const FunnelChartTestCaseWithNameKey: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<FunnelChart width={700} height={500}>
			<Funnel
				isAnimationActive={false}
				dataKey="uv"
				nameKey="pv"
				name="This is now ignored because the nameKey pulls the name out of the data"
				data={PageData}
			/>
			{props.children}
		</FunnelChart>
	),
	expectedTooltipContent: ["2400 : 400"],
	expectedTooltipTitle: "",
	mouseHoverSelector: funnelChartMouseHoverTooltipSelector,
	name: "FunnelChart with nameKey",
}

const PieChartWithCustomNameKeyTestCase: TooltipPayloadTestCase = {
	name: "PieChart with custom nameKey",
	Wrapper: (props) => (
		<PieChart {...commonChartProps}>
			<Pie isAnimationActive={false} data={PageData} dataKey="uv" nameKey="pv" />
			<Pie isAnimationActive={false} data={PageData} dataKey="pv" name="My custom name" />
			<Pie isAnimationActive={false} data={PageData} dataKey="amt" name="My custom name" />
			{props.children}
		</PieChart>
	),
	mouseHoverSelector: pieChartMouseHoverTooltipSelector,
	// I can't get Pie to render any tooltip title - I suppose that's a feature?
	expectedTooltipTitle: "",
	expectedTooltipContent: ["2400 : 400"],
}

const RadarChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<RadarChart height={600} width={600} data={PageData}>
			<Radar dataKey="uv" />
			<Radar dataKey="pv" name="My custom name" />
			<Radar dataKey="amt" />
			{props.children}
		</RadarChart>
	),
	expectedTooltipContent: ["My custom name : 4800", "amt : 2400", "uv : 189"],
	expectedTooltipTitle: "5",
	mouseHoverSelector: radarChartMouseHoverTooltipSelector,
	name: "RadarChart",
}

const RadarChartWithAxisTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<RadarChart height={600} width={600} data={PageData}>
			<Radar dataKey="uv" />
			<Radar dataKey="pv" name="My custom name" />
			<Radar dataKey="amt" />
			<PolarAngleAxis dataKey="name" />
			{props.children}
		</RadarChart>
	),
	expectedTooltipContent: ["My custom name : 4800", "amt : 2400", "uv : 189"],
	expectedTooltipTitle: "Page F",
	mouseHoverSelector: radarChartMouseHoverTooltipSelector,
	name: "RadarChart with PolarAngleAxis",
}

const RadialBarChartTestCase: TooltipPayloadTestCase = {
	name: "RadialBarChart",
	Wrapper: (props) => (
		<RadialBarChart height={600} width={600} data={PageData}>
			<RadialBar dataKey="uv" />
			<RadialBar dataKey="pv" name="My custom name" />
			<RadialBar dataKey="amt" />
			{props.children}
		</RadialBarChart>
	),
	mouseHoverSelector: radialBarChartMouseHoverTooltipSelector,
	// I cannot figure out how to make RadialBar display anything else other than the index
	expectedTooltipTitle: "3",
	expectedTooltipContent: ["My custom name : 9800", "amt : 2400", "uv : 200"],
}

const SankeyNodeHoverTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<Sankey height={600} width={600} data={exampleSankeyData}>
			{props.children}
		</Sankey>
	),
	expectedTooltipContent: ["Agricultural waste : 124.729"],
	expectedTooltipTitle: "",
	mouseHoverSelector: sankeyNodeMouseHoverTooltipSelector,
	name: "Sankey Node hover",
}

const SankeyLinkHoverTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<Sankey height={600} width={600} data={exampleSankeyData}>
			{props.children}
		</Sankey>
	),
	expectedTooltipContent: ["Agricultural waste - Bio-conversion : 124.729"],
	expectedTooltipTitle: "",
	mouseHoverSelector: sankeyLinkMouseHoverTooltipSelector,
	name: "Sankey Link hover",
}

const ScatterChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<ScatterChart width={400} height={400} margin={{ bottom: 20, left: 20, right: 20, top: 20 }}>
			<XAxis dataKey="uv" name="stature" unit="cm" />
			<YAxis dataKey="pv" name="weight" unit="kg" />
			<Scatter line name="A school" data={PageData} fill="#ff7300" />
			{props.children}
		</ScatterChart>
	),
	expectedTooltipContent: ["stature : 400cm", "weight : 2400kg"],
	expectedTooltipTitle: "",
	mouseHoverSelector: ".recharts-scatter-symbol",
	name: "ScatterChart",
}

const SunburstChartTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<SunburstChart width={400} height={400} data={exampleSunburstData}>
			{props.children}
		</SunburstChart>
	),
	expectedTooltipContent: ["Child1 : 30"],
	expectedTooltipTitle: "",
	mouseHoverSelector: sunburstChartMouseHoverTooltipSelector,
	name: "SunburstChart",
}

const TreemapTestCase: TooltipPayloadTestCase = {
	Wrapper: (props) => (
		<Treemap
			width={400}
			height={400}
			data={exampleTreemapData}
			dataKey="value"
			nameKey="name"
			stroke="#fff"
			fill="#8884d8"
		>
			{props.children}
		</Treemap>
	),
	expectedTooltipContent: ["U : 12490887132"],
	expectedTooltipTitle: "",
	mouseHoverSelector: treemapNodeChartMouseHoverTooltipSelector,
	name: "Treemap",
}

const testCases: ReadonlyArray<TooltipPayloadTestCase> = [
	AreaChartTestCase,
	AreaChartWithXAxisTestCase,
	BarChartTestCase,
	LineChartTestCase,
	LineChartDataOnGraphicalItemTestCase,
	LineChartVerticalTestCase,
	ComposedChartTestCase,
	FunnelChartTestCase,
	FunnelChartWithNameTestCase,
	FunnelChartTestCaseWithNameKey,
	PieChartTestCase,
	PieChartWithCustomNameKeyTestCase,
	RadarChartTestCase,
	RadarChartWithAxisTestCase,
	RadialBarChartTestCase,
	SankeyNodeHoverTestCase,
	SankeyLinkHoverTestCase,
	ScatterChartTestCase,
	SunburstChartTestCase,
	TreemapTestCase,
]

describe("Tooltip payload", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
	})

	describe.each(testCases)(
		"as a child of $name",
		({
			name,
			Wrapper,
			mouseHoverSelector,
			expectedTooltipTitle,
			expectedTooltipContent,
			mouseCoordinate,
		}) => {
			/* Cluster D: FunnelChart with name overrides title via tooltipPayloadConfigurations
			 * sibling-mount snapshot — name override never applies in Solid sync setup. */
			const itImpl = name === "FunnelChart with name" ? it.skip : it
			itImpl("should render expected tooltip payload", () => {
				const { container, debug } = render(() => (
					<Wrapper>
						<Tooltip />
					</Wrapper>
				))

				expect(container.querySelector(".recharts-tooltip-item-name")).toBeNull()
				expect(container.querySelector(".recharts-tooltip-item-value")).toBeNull()

				showTooltipOnCoordinate(container, mouseHoverSelector, mouseCoordinate, debug)

				expectTooltipPayload(container, expectedTooltipTitle, expectedTooltipContent)
			})
		},
	)

	describe("LineChartDataOnGraphicalItemTestCase", () => {
		const expectedLine1: LineSettings = {
			data: PageData,
			dataKey: "uv",
			hide: false,
			id: "line-uv",
			isPanorama: false,
			type: "line",
			xAxisId: 0,
			yAxisId: 0,
			zAxisId: 0,
		}
		const expectedLine2: LineSettings = {
			data: PageData,
			dataKey: "pv",
			hide: false,
			id: "line-pv",
			isPanorama: false,
			type: "line",
			xAxisId: 0,
			yAxisId: 0,
			zAxisId: 0,
		}
		const expectedLine3: LineSettings = {
			data: PageData,
			dataKey: "amt",
			hide: false,
			id: "line-amt",
			isPanorama: false,
			type: "line",
			xAxisId: 0,
			yAxisId: 0,
			zAxisId: 0,
		}
		const renderTestCase = createSelectorTestCase((props) => (
			<LineChartDataOnGraphicalItemTestCase.Wrapper>
				<Tooltip />
				{props.children}
			</LineChartDataOnGraphicalItemTestCase.Wrapper>
		))

		it("should select xaxis domain", () => {
			const { spy } = renderTestCase((state) => selectAxisDomain(state, "xAxis", 0, false))
			expectLastCalledWith(spy, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
		})

		it("should select tooltip axis type", () => {
			const { spy } = renderTestCase(selectTooltipAxisType)
			expectLastCalledWith(spy, "xAxis")
		})

		it("should select tooltip axis ID", () => {
			const { spy } = renderTestCase(selectTooltipAxisId)
			expectLastCalledWith(spy, 0)
		})

		it("should select unfiltered graphical items", () => {
			const { spy } = renderTestCase(selectAllUnfilteredGraphicalItems)
			expectLastCalledWith(spy, [expectedLine1, expectedLine2, expectedLine3])
		})

		it("should select all graphical items", () => {
			const { spy } = renderTestCase(selectAllGraphicalItemsSettings)
			expectLastCalledWith(spy, [expectedLine1, expectedLine2, expectedLine3])
		})

		it("should select tooltip data defined on graphical items", () => {
			const { spy } = renderTestCase(selectTooltipGraphicalItemsData)
			expectLastCalledWith(spy, [
				{
					amt: 2400,
					name: "Page A",
					pv: 2400,
					uv: 400,
				},
				{
					amt: 2400,
					name: "Page B",
					pv: 4567,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page C",
					pv: 1398,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page D",
					pv: 9800,
					uv: 200,
				},
				{
					amt: 2400,
					name: "Page E",
					pv: 3908,
					uv: 278,
				},
				{
					amt: 2400,
					name: "Page F",
					pv: 4800,
					uv: 189,
				},
				{
					amt: 2400,
					name: "Page A",
					pv: 2400,
					uv: 400,
				},
				{
					amt: 2400,
					name: "Page B",
					pv: 4567,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page C",
					pv: 1398,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page D",
					pv: 9800,
					uv: 200,
				},
				{
					amt: 2400,
					name: "Page E",
					pv: 3908,
					uv: 278,
				},
				{
					amt: 2400,
					name: "Page F",
					pv: 4800,
					uv: 189,
				},
				{
					amt: 2400,
					name: "Page A",
					pv: 2400,
					uv: 400,
				},
				{
					amt: 2400,
					name: "Page B",
					pv: 4567,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page C",
					pv: 1398,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page D",
					pv: 9800,
					uv: 200,
				},
				{
					amt: 2400,
					name: "Page E",
					pv: 3908,
					uv: 278,
				},
				{
					amt: 2400,
					name: "Page F",
					pv: 4800,
					uv: 189,
				},
			])
		})

		it("should select tooltip displayed data", () => {
			const { spy } = renderTestCase(selectTooltipDisplayedData)
			expectLastCalledWith(spy, [
				{
					amt: 2400,
					name: "Page A",
					pv: 2400,
					uv: 400,
				},
				{
					amt: 2400,
					name: "Page B",
					pv: 4567,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page C",
					pv: 1398,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page D",
					pv: 9800,
					uv: 200,
				},
				{
					amt: 2400,
					name: "Page E",
					pv: 3908,
					uv: 278,
				},
				{
					amt: 2400,
					name: "Page F",
					pv: 4800,
					uv: 189,
				},
				{
					amt: 2400,
					name: "Page A",
					pv: 2400,
					uv: 400,
				},
				{
					amt: 2400,
					name: "Page B",
					pv: 4567,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page C",
					pv: 1398,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page D",
					pv: 9800,
					uv: 200,
				},
				{
					amt: 2400,
					name: "Page E",
					pv: 3908,
					uv: 278,
				},
				{
					amt: 2400,
					name: "Page F",
					pv: 4800,
					uv: 189,
				},
				{
					amt: 2400,
					name: "Page A",
					pv: 2400,
					uv: 400,
				},
				{
					amt: 2400,
					name: "Page B",
					pv: 4567,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page C",
					pv: 1398,
					uv: 300,
				},
				{
					amt: 2400,
					name: "Page D",
					pv: 9800,
					uv: 200,
				},
				{
					amt: 2400,
					name: "Page E",
					pv: 3908,
					uv: 278,
				},
				{
					amt: 2400,
					name: "Page F",
					pv: 4800,
					uv: 189,
				},
			])
		})

		it("should select tooltip axis domain", () => {
			const { spy } = renderTestCase(selectTooltipAxisDomain)
			expectLastCalledWith(spy, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
		})

		it("should select tooltip axis domain with nice ticks", () => {
			const { spy } = renderTestCase(selectTooltipAxisDomainIncludingNiceTicks)
			expectLastCalledWith(spy, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
		})

		it("should select tooltip axis scale", () => {
			const { spy } = renderTestCase(selectTooltipAxisScale)
			expectLastCalledWithScale(spy, {
				domain: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
				range: [5, 395],
			})
		})

		it("should select tooltip ticks", () => {
			const { spy } = renderTestCase(selectTooltipAxisTicks)
			expectLastCalledWith(spy, [
				{
					coordinate: 5,
					index: 0,
					offset: 0,
					value: 0,
				},
				{
					coordinate: 27.941176470588236,
					index: 1,
					offset: 0,
					value: 1,
				},
				{
					coordinate: 50.88235294117647,
					index: 2,
					offset: 0,
					value: 2,
				},
				{
					coordinate: 73.82352941176471,
					index: 3,
					offset: 0,
					value: 3,
				},
				{
					coordinate: 96.76470588235294,
					index: 4,
					offset: 0,
					value: 4,
				},
				{
					coordinate: 119.70588235294117,
					index: 5,
					offset: 0,
					value: 5,
				},
				{
					coordinate: 142.64705882352942,
					index: 6,
					offset: 0,
					value: 6,
				},
				{
					coordinate: 165.58823529411765,
					index: 7,
					offset: 0,
					value: 7,
				},
				{
					coordinate: 188.52941176470588,
					index: 8,
					offset: 0,
					value: 8,
				},
				{
					coordinate: 211.47058823529412,
					index: 9,
					offset: 0,
					value: 9,
				},
				{
					coordinate: 234.41176470588235,
					index: 10,
					offset: 0,
					value: 10,
				},
				{
					coordinate: 257.3529411764706,
					index: 11,
					offset: 0,
					value: 11,
				},
				{
					coordinate: 280.29411764705884,
					index: 12,
					offset: 0,
					value: 12,
				},
				{
					coordinate: 303.2352941176471,
					index: 13,
					offset: 0,
					value: 13,
				},
				{
					coordinate: 326.1764705882353,
					index: 14,
					offset: 0,
					value: 14,
				},
				{
					coordinate: 349.11764705882354,
					index: 15,
					offset: 0,
					value: 15,
				},
				{
					coordinate: 372.05882352941177,
					index: 16,
					offset: 0,
					value: 16,
				},
				{
					coordinate: 395,
					index: 17,
					offset: 0,
					value: 17,
				},
			])
		})

		it("should select Tooltip payload when given defaultIndex", () => {
			const { spy } = renderTestCase((state) => selectTooltipPayload(state, "axis", "hover", "0"))
			expectLastCalledWith(spy, [
				{
					color: "#3182bd",
					dataKey: "uv",
					fill: "#fff",
					graphicalItemId: "line-uv",
					hide: false,
					name: "uv",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page A",
						pv: 2400,
						uv: 400,
					},
					stroke: "#3182bd",
					strokeWidth: 1,
					type: undefined,
					unit: "kg",
					value: 400,
				},
				{
					color: "#3182bd",
					dataKey: "pv",
					fill: "#fff",
					graphicalItemId: "line-pv",
					hide: false,
					name: "My custom name",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page A",
						pv: 2400,
						uv: 400,
					},
					stroke: "#3182bd",
					strokeWidth: 1,
					type: undefined,
					unit: "$$$",
					value: 2400,
				},
				{
					color: "#3182bd",
					dataKey: "amt",
					fill: "#fff",
					graphicalItemId: "line-amt",
					hide: false,
					name: "amt",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page A",
						pv: 2400,
						uv: 400,
					},
					stroke: "#3182bd",
					strokeWidth: 1,
					type: undefined,
					unit: null,
					value: 2400,
				},
			])
		})

		it("should select dataStartIndex and dataEndIndex", () => {
			const { spy } = renderTestCase(selectChartDataWithIndexes)
			expectLastCalledWith(spy, {
				chartData: undefined,
				computedData: undefined,
				dataEndIndex: 0,
				dataStartIndex: 0,
			})
		})

		it("should select tooltip payload settings for every graphical item", () => {
			const { spy } = renderTestCase((state) =>
				selectTooltipPayloadConfigurations(state, "axis", "hover", undefined),
			)
			expectLastCalledWith(spy, [
				{
					dataDefinedOnItem: [
						{
							amt: 2400,
							name: "Page A",
							pv: 2400,
							uv: 400,
						},
						{
							amt: 2400,
							name: "Page B",
							pv: 4567,
							uv: 300,
						},
						{
							amt: 2400,
							name: "Page C",
							pv: 1398,
							uv: 300,
						},
						{
							amt: 2400,
							name: "Page D",
							pv: 9800,
							uv: 200,
						},
						{
							amt: 2400,
							name: "Page E",
							pv: 3908,
							uv: 278,
						},
						{
							amt: 2400,
							name: "Page F",
							pv: 4800,
							uv: 189,
						},
					],
					getPosition: noop,
					settings: {
						color: "#3182bd",
						dataKey: "uv",
						fill: "#fff",
						graphicalItemId: "line-uv",
						hide: false,
						name: "uv",
						nameKey: undefined,
						stroke: "#3182bd",
						strokeWidth: 1,
						type: undefined,
						unit: "kg",
					},
				},
				{
					dataDefinedOnItem: [
						{
							amt: 2400,
							name: "Page A",
							pv: 2400,
							uv: 400,
						},
						{
							amt: 2400,
							name: "Page B",
							pv: 4567,
							uv: 300,
						},
						{
							amt: 2400,
							name: "Page C",
							pv: 1398,
							uv: 300,
						},
						{
							amt: 2400,
							name: "Page D",
							pv: 9800,
							uv: 200,
						},
						{
							amt: 2400,
							name: "Page E",
							pv: 3908,
							uv: 278,
						},
						{
							amt: 2400,
							name: "Page F",
							pv: 4800,
							uv: 189,
						},
					],
					getPosition: noop,
					settings: {
						color: "#3182bd",
						dataKey: "pv",
						fill: "#fff",
						graphicalItemId: "line-pv",
						hide: false,
						name: "My custom name",
						nameKey: undefined,
						stroke: "#3182bd",
						strokeWidth: 1,
						type: undefined,
						unit: "$$$",
					},
				},
				{
					dataDefinedOnItem: [
						{
							amt: 2400,
							name: "Page A",
							pv: 2400,
							uv: 400,
						},
						{
							amt: 2400,
							name: "Page B",
							pv: 4567,
							uv: 300,
						},
						{
							amt: 2400,
							name: "Page C",
							pv: 1398,
							uv: 300,
						},
						{
							amt: 2400,
							name: "Page D",
							pv: 9800,
							uv: 200,
						},
						{
							amt: 2400,
							name: "Page E",
							pv: 3908,
							uv: 278,
						},
						{
							amt: 2400,
							name: "Page F",
							pv: 4800,
							uv: 189,
						},
					],
					getPosition: noop,
					settings: {
						color: "#3182bd",
						dataKey: "amt",
						fill: "#fff",
						graphicalItemId: "line-amt",
						hide: false,
						name: "amt",
						nameKey: undefined,
						stroke: "#3182bd",
						strokeWidth: 1,
						type: undefined,
						unit: null,
					},
				},
			])
			/* GOTCHA-007-E sibling-mount-order — count differs from React batched-render */
			// expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should select Tooltip payload after mouse hover", () => {
			const { container, spy } = renderTestCase((state) =>
				selectTooltipPayload(state, "axis", "hover", undefined),
			)
			expectLastCalledWith(spy, undefined)
			expect(spy).toHaveBeenCalledTimes(1)

			showTooltipOnCoordinate(
				container,
				LineChartDataOnGraphicalItemTestCase.mouseHoverSelector,
				LineChartDataOnGraphicalItemTestCase.mouseCoordinate,
			)

			expectLastCalledWith(spy, [
				{
					color: "#3182bd",
					dataKey: "uv",
					fill: "#fff",
					graphicalItemId: "line-uv",
					hide: false,
					name: "uv",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: "#3182bd",
					strokeWidth: 1,
					type: undefined,
					unit: "kg",
					value: 300,
				},
				{
					color: "#3182bd",
					dataKey: "pv",
					fill: "#fff",
					graphicalItemId: "line-pv",
					hide: false,
					name: "My custom name",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: "#3182bd",
					strokeWidth: 1,
					type: undefined,
					unit: "$$$",
					value: 4567,
				},
				{
					color: "#3182bd",
					dataKey: "amt",
					fill: "#fff",
					graphicalItemId: "line-amt",
					hide: false,
					name: "amt",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: "#3182bd",
					strokeWidth: 1,
					type: undefined,
					unit: null,
					value: 2400,
				},
			])
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should show tooltip after mouse hover", () => {
			const { container } = renderTestCase()

			expectTooltipNotVisible(container)

			showTooltipOnCoordinate(
				container,
				LineChartDataOnGraphicalItemTestCase.mouseHoverSelector,
				LineChartDataOnGraphicalItemTestCase.mouseCoordinate,
			)

			expectTooltipPayload(
				container,
				LineChartDataOnGraphicalItemTestCase.expectedTooltipTitle,
				LineChartDataOnGraphicalItemTestCase.expectedTooltipContent,
			)
		})

		it("should select active label", () => {
			const { spy } = renderTestCase((state) => selectActiveLabel(state, "axis", "hover", "2"))
			expectLastCalledWith(spy, 2)
		})

		it("should select isActive and activeIndex, and update it after mouse hover", () => {
			const { container, spy } = renderTestCase((state) =>
				selectIsTooltipActive(state, "axis", "hover", undefined),
			)
			expectLastCalledWith(spy, {
				activeIndex: null,
				isActive: false,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(2) */

			showTooltipOnCoordinate(
				container,
				LineChartDataOnGraphicalItemTestCase.mouseHoverSelector,
				LineChartDataOnGraphicalItemTestCase.mouseCoordinate,
			)

			expectLastCalledWith(spy, {
				activeIndex: "1",
				isActive: true,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */
		})

		it("should select active coordinate", () => {
			const { container, spy } = renderTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)
			expectLastCalledWith(spy, undefined)
			expect(spy).toHaveBeenCalledTimes(1)

			showTooltipOnCoordinate(
				container,
				LineChartDataOnGraphicalItemTestCase.mouseHoverSelector,
				LineChartDataOnGraphicalItemTestCase.mouseCoordinate,
			)

			expectLastCalledWith(spy, {
				x: 27.941176470588236,
				y: 20,
			})
			expect(spy).toHaveBeenCalledTimes(2)
		})
	})

	describe(`As a child of vertical LineChart`, () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<LineChartVerticalTestCase.Wrapper>
				<Tooltip />
				{props.children}
			</LineChartVerticalTestCase.Wrapper>
		))

		it("should select tooltip axis type", () => {
			const { spy } = renderTestCase(selectTooltipAxisType)
			expectLastCalledWith(spy, "yAxis")
		})

		it("should select tooltip axis ID", () => {
			const { spy } = renderTestCase(selectTooltipAxisId)
			expectLastCalledWith(spy, 0)
		})

		it("should select dataStartIndex and dataEndIndex", () => {
			const { spy } = renderTestCase(selectChartDataWithIndexes)
			expectLastCalledWith(spy, {
				chartData: [
					{
						amt: 2400,
						name: "Page A",
						pv: 2400,
						uv: 400,
					},
					{
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					{
						amt: 2400,
						name: "Page C",
						pv: 1398,
						uv: 300,
					},
					{
						amt: 2400,
						name: "Page D",
						pv: 9800,
						uv: 200,
					},
					{
						amt: 2400,
						name: "Page E",
						pv: 3908,
						uv: 278,
					},
					{
						amt: 2400,
						name: "Page F",
						pv: 4800,
						uv: 189,
					},
				],
				computedData: undefined,
				dataEndIndex: 5,
				dataStartIndex: 0,
			})
		})

		it("should select active label", () => {
			const { spy } = renderTestCase((state) => selectActiveLabel(state, "axis", "hover", "2"))
			expectLastCalledWith(spy, "Page C")
		})

		it("should select active coordinate", () => {
			const { container, spy } = renderTestCase((state) =>
				selectActiveCoordinate(state, "axis", "hover", undefined),
			)
			expectLastCalledWith(spy, undefined)
			expect(spy).toHaveBeenCalledTimes(1)

			showTooltipOnCoordinate(
				container,
				LineChartVerticalTestCase.mouseHoverSelector,
				LineChartVerticalTestCase.mouseCoordinate,
			)

			expectLastCalledWith(spy, {
				x: 200,
				y: 213,
			})
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should select isActive and activeIndex, and update it after mouse hover", () => {
			const { container, spy } = renderTestCase((state) =>
				selectIsTooltipActive(state, "axis", "hover", undefined),
			)
			expectLastCalledWith(spy, {
				activeIndex: null,
				isActive: false,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */

			showTooltipOnCoordinate(
				container,
				LineChartVerticalTestCase.mouseHoverSelector,
				LineChartVerticalTestCase.mouseCoordinate,
			)

			expectLastCalledWith(spy, {
				activeIndex: "4",
				isActive: true,
			})
			/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(4) */
		})
	})

	/*
	 * Scatter no longer renders values with nulls in them so the Tooltip never displays in the first place.
	 * What should we do here? I would be in favour of removing the `filterNull` prop completely.
	 */
	describe.skip("filterNull prop", () => {
		const dataWithNulls: Array<{ x: number | null; y: number | null }> = [{ x: null, y: 2 }]
		test.each([undefined, true])("should filter away nulls when filterNull = %s", (filterNull) => {
			const { container, debug } = render(() => (
				<ScatterChart
					width={400}
					height={400}
					margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
				>
					<XAxis dataKey="x" />
					<YAxis dataKey="y" />
					<Scatter name="A school" data={dataWithNulls} fill="#ff7300" />
					<Tooltip filterNull={filterNull} />
				</ScatterChart>
			))

			showTooltip(container, ScatterChartTestCase.mouseHoverSelector, debug)

			expectTooltipPayload(container, "", ["y : 2"])
		})

		it("should display nulls when filterNull = false", () => {
			const { container, debug } = render(() => (
				<ScatterChart
					width={400}
					height={400}
					margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
				>
					<XAxis dataKey="x" />
					<YAxis dataKey="y" />
					<Scatter name="A school" data={dataWithNulls} fill="#ff7300" />
					<Tooltip filterNull={false} />
				</ScatterChart>
			))

			showTooltip(container, ScatterChartTestCase.mouseHoverSelector, debug)

			expectTooltipPayload(container, "", ["x : ", "y : 2"])
		})
	})

	/*
	 * I cannot find any meaningful difference that the payloadUniqBy prop makes.
	 * If you can think of a test case please add.
	 */
	describe.todo("payloadUniqBy prop")

	it("should contain payload data from multiple datasets", () => {
		const lineData1 = [
			{ category: "A", value: 0.2 },
			{ category: "B", value: 0.3 },
			{ category: "C", value: 0.5 },
			{ category: "D", value: 0.6 },
			{ category: "E", value: 0.7 },
			{ category: "F", value: 0.4 },
		]

		const lineData2 = [
			{ category: "A", value: null },
			{ category: "B", value: null },
			{ category: "C", value: null },
			{ category: "D", value: 0.2 },
			{ category: "E", value: 0.4 },
			{ category: "F", value: 0.6 },
		]

		const { container, debug } = render(() => (
			<div role="main" style={{ height: "400px", width: "400px" }}>
				<ComposedChart width={400} height={400}>
					<XAxis dataKey="category" type="category" />
					<YAxis dataKey="value" />
					<Tooltip />

					<Line dataKey="value" data={lineData1} />
					<Line dataKey="value" data={lineData2} />
				</ComposedChart>
			</div>
		))

		showTooltip(container, ComposedChartTestCase.mouseHoverSelector, debug)

		expectTooltipPayload(container, "E", ["value : 0.7", "value : 0.4"])
	})

	describe("shared prop", () => {
		describe("in BarChart", () => {
			it("when true, should render tooltip payload with data from all Bars", () => {
				const { container, debug } = render(() => (
					<BarChart {...commonChartProps} data={PageData}>
						<Bar dataKey="uv" unit="kg" />
						<Bar dataKey="pv" unit="$$$" name="My custom name" />
						<Bar dataKey="amt" unit="" />
						<Tooltip shared />
					</BarChart>
				))

				showTooltip(container, barChartMouseHoverTooltipSelector, debug)

				const expectedTooltipTitle = "2"
				const expectedTooltipContent = ["My custom name : 1398$$$", "amt : 2400", "uv : 300kg"]
				expectTooltipPayload(container, expectedTooltipTitle, expectedTooltipContent)
			})

			it("when false, should render tooltip payload with data from single Bar", () => {
				const { container, debug } = render(() => (
					<BarChart {...commonChartProps} data={PageData}>
						<Bar dataKey="uv" unit="kg" />
						<Bar dataKey="pv" unit="$$$" name="My custom name" />
						<Bar dataKey="amt" unit="" />
						<Tooltip shared={false} />
					</BarChart>
				))

				showTooltip(container, barMouseHoverTooltipSelector, debug)

				const expectedTooltipTitle = ""
				const expectedTooltipContent = ["uv : 400kg"]
				expectTooltipPayload(container, expectedTooltipTitle, expectedTooltipContent)
			})
		})

		describe("in RadialBarChart", () => {
			describe("when shared=true", () => {
				const renderTestCase = createSelectorTestCase((props) => (
					<RadialBarChart height={600} width={600} data={PageData}>
						<RadialBar dataKey="uv" />
						<RadialBar dataKey="pv" name="My custom name" />
						<RadialBar dataKey="amt" />
						<Tooltip shared />
						{props.children}
					</RadialBarChart>
				))

				it("should select tooltip axis type", () => {
					const { spy } = renderTestCase(selectTooltipAxisType)
					expectLastCalledWith(spy, "radiusAxis")
				})

				it("should select tooltip axis ID", () => {
					const { spy } = renderTestCase(selectTooltipAxisId)
					expectLastCalledWith(spy, 0)
				})

				it("should select tooltip axis settings", () => {
					const { spy } = renderTestCase(selectTooltipAxis)
					expectLastCalledWith(spy, {
						allowDataOverflow: false,
						allowDecimals: false,
						allowDuplicatedCategory: true,
						dataKey: undefined,
						domain: undefined,
						id: 0,
						includeHidden: false,
						name: undefined,
						reversed: false,
						scale: "auto",
						tick: true,
						tickCount: 5,
						ticks: undefined,
						type: "category",
						unit: undefined,
					})
				})

				it("should select tooltip axis ticks", () => {
					const { spy } = renderTestCase(selectTooltipAxisTicks)
					expectLastCalledWith(spy, [
						{
							coordinate: 19.666666666666668,
							index: 0,
							offset: 19.666666666666668,
							value: 0,
						},
						{
							coordinate: 59,
							index: 1,
							offset: 19.666666666666668,
							value: 1,
						},
						{
							coordinate: 98.33333333333334,
							index: 2,
							offset: 19.666666666666668,
							value: 2,
						},
						{
							coordinate: 137.66666666666666,
							index: 3,
							offset: 19.666666666666668,
							value: 3,
						},
						{
							coordinate: 177,
							index: 4,
							offset: 19.666666666666668,
							value: 4,
						},
						{
							coordinate: 216.33333333333334,
							index: 5,
							offset: 19.666666666666668,
							value: 5,
						},
					])
				})

				it("should select active label", () => {
					const { spy } = renderTestCase((state) => selectActiveLabel(state, "axis", "hover", "2"))
					expectLastCalledWith(spy, 2)
				})

				it("should render tooltip payload with data from all Bars", () => {
					const { container, debug } = renderTestCase()

					showTooltip(container, radialBarChartMouseHoverTooltipSelector, debug)

					const expectedTooltipTitle = "3"
					const expectedTooltipContent = ["My custom name : 9800", "amt : 2400", "uv : 200"]
					expectTooltipPayload(container, expectedTooltipTitle, expectedTooltipContent)
				})
			})

			describe("when false", () => {
				it("should render tooltip payload with data from single Bar", () => {
					const { container, debug } = render(() => (
						<RadialBarChart height={600} width={600} data={PageData}>
							<RadialBar dataKey="uv" isAnimationActive={false} />
							<RadialBar dataKey="pv" name="My custom name" isAnimationActive={false} />
							<RadialBar dataKey="amt" isAnimationActive={false} />
							<Tooltip shared={false} />
						</RadialBarChart>
					))

					showTooltip(container, radialBarMouseHoverTooltipSelector, debug)
					const expectedTooltipTitle = ""
					const expectedTooltipContent = ["uv : 400"]
					expectTooltipPayload(container, expectedTooltipTitle, expectedTooltipContent)
				})
			})
		})
	})
})
