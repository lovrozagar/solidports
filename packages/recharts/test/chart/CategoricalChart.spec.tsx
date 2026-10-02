/* @jsxImportSource @solidjs/web */
import { vi } from "vitest"
import { flush } from "solid-js"
import { fireEvent } from "../helper/render"
import {
	Area,
	AreaChart,
	ComposedChart,
	Funnel,
	FunnelChart,
	Line,
	LineChart,
	Pie,
	PieChart,
	Radar,
	RadarChart,
	RadialBar,
	RadialBarChart,
	Scatter,
	ScatterChart,
	XAxis,
	YAxis,
} from "../../src"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"
import { assertNotNull } from "../helper/assertNotNull"
import { rechartsTestRender } from "../helper/createSelectorTestCase"

type WrapperProps = {
	onClick: () => void
	onDoubleClick: () => void
	onContextMenu: () => void
}

const data = [
	{ amt: 2400, name: "Page A", pv: 2400, uv: 400 },
	{ amt: 2400, name: "Page B", pv: 4567, uv: 300 },
	{ amt: 2400, name: "Page C", pv: 1398, uv: 300 },
	{ amt: 2400, name: "Page D", pv: 9800, uv: 200 },
	{ amt: 2400, name: "Page E", pv: 3908, uv: 278 },
	{ amt: 2400, name: "Page F", pv: 4800, uv: 189 },
]

const funnelData1 = [
	{ name: "展现", value: 100 },
	{ name: "点击", value: 80 },
	{ name: "访问", value: 50 },
	{ name: "咨询", value: 40 },
	{ name: "订单", value: 26 },
]

const funnelData2 = [
	{ name: "展现", value: 60 },
	{ name: "点击", value: 50 },
	{ name: "访问", value: 30 },
	{ name: "咨询", value: 20 },
	{ name: "订单", value: 6 },
]

const commonChartProps = {
	data,
	height: 300,
	width: 300,
}

type CategoricalChartTestCase = {
	name: string
	Wrapper: ComponentType<WrapperProps>
}

const AreaChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<AreaChart
			{...commonChartProps}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<Area type="monotone" dataKey="uv" stroke="#ff7300" fill="#ff7300" />
		</AreaChart>
	),
	name: "AreaChart",
}

const ComposedChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<ComposedChart
			{...commonChartProps}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<Area type="monotone" dataKey="uv" stroke="#ff7300" fill="#ff7300" />
			<Line type="monotone" dataKey="uv" stroke="#00EE00" />
		</ComposedChart>
	),
	name: "ComposedChart",
}

const FunnelChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<FunnelChart
			{...commonChartProps}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<Funnel dataKey="uv" data={funnelData1} />
			<Funnel dataKey="uv" data={funnelData2} />
		</FunnelChart>
	),
	name: "FunnelChart",
}

const LineChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<LineChart
			{...commonChartProps}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<Line type="monotone" dataKey="uv" stroke="#ff7300" />
		</LineChart>
	),
	name: "LineChart",
}

const PieChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<PieChart
			width={300}
			height={300}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<Pie
				dataKey="uv"
				isAnimationActive
				data={data}
				cx={200}
				cy={200}
				outerRadius={80}
				fill="#ff7300"
				label
			/>
		</PieChart>
	),
	name: "PieChart",
}

const RadarChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<RadarChart
			{...commonChartProps}
			cx={300}
			cy={250}
			outerRadius={150}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<Radar isAnimationActive={false} dot dataKey="uv" />
		</RadarChart>
	),
	name: "RadarChart",
}

const RadialBarChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<RadialBarChart
			{...commonChartProps}
			cx={150}
			cy={150}
			innerRadius={20}
			outerRadius={140}
			barSize={10}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<RadialBar
				label={{ orientation: "outer" }}
				background
				dataKey="uv"
				isAnimationActive={false}
			/>
		</RadialBarChart>
	),
	name: "RadialBarChart",
}

const ScatterChartTestCase: CategoricalChartTestCase = {
	Wrapper: (props: WrapperProps) => (
		<ScatterChart
			width={400}
			height={400}
			onContextMenu={props.onContextMenu}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
			margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
		>
			<XAxis dataKey="uv" name="stature" unit="cm" />
			<YAxis dataKey="pv" name="weight" unit="kg" />
			<Scatter line name="A school" data={data} fill="#ff7300" />
		</ScatterChart>
	),
	name: "ScatterChart",
}

const testCases = [
	AreaChartTestCase,
	ComposedChartTestCase,
	FunnelChartTestCase,
	LineChartTestCase,
	PieChartTestCase,
	RadarChartTestCase,
	RadialBarChartTestCase,
	ScatterChartTestCase,
]

describe("CategoricalChart", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 50, width: 50 })
	})
	describe.each(testCases)("$name", ({ Wrapper }) => {
		test("should call corresponding callback on mouse events", () => {
			const handleClickMock = vi.fn()
			handleClickMock.mockName("handleClickMock")
			const handleDoubleClickMock = vi.fn()
			const handleContextMenuMock = vi.fn()

			const { container } = rechartsTestRender(() => (
				<Wrapper
					onClick={handleClickMock}
					onDoubleClick={handleDoubleClickMock}
					onContextMenu={handleContextMenuMock}
				/>
			))

			const surface = container.querySelector(".recharts-wrapper")
			assertNotNull(surface)
			fireEvent.click(surface)
			fireEvent.doubleClick(surface)
			fireEvent.contextMenu(surface)

			vi.advanceTimersByTime(0)
			flush()

			expect(handleClickMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
			expect(handleDoubleClickMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
			expect(handleContextMenuMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
		})
	})
})
