import { describe, expect, it, Mock, vi } from "vitest"
import { fireEvent, render } from "../../helper/render"
import {
	Bar,
	BarChart,
	ComposedChart,
	Line,
	LineChart,
	XAxisTickContentProps,
	XAxis,
	YAxis,
} from "../../../src"
import { ExpectAxisDomain, expectXAxisTicks } from "../../helper/expectAxisTicks"
import { expectLastCalledWith, expectNthCalledWith } from "../../helper/expectLastCalledWith"
import { dateWithValueData } from "../../_data"

const data = [
	{ x: 90, y: 90, z: 90 },
	{ x: 100, y: 200, z: 200 },
	{ x: 120, y: 100, z: 260 },
	{ x: 170, y: 300, z: 400 },
	{ x: 140, y: 250, z: 280 },
	{ x: 150, y: 400, z: 500 },
	{ x: 110, y: 280, z: 200 },
]

const lineData = [
	{ amt: 2400, name: "Page A", pv: 2400, uv: 400 },
	{ amt: 2400, name: "Page B", pv: 4567, uv: 300 },
	{ amt: 2400, name: "Page C", pv: 1398, uv: 300 },
	{ amt: 2400, name: "Page D", pv: 9800, uv: 200 },
	{ amt: 2400, name: "Page E", pv: 3908, uv: 278 },
	{ amt: 2400, name: "Page F", pv: 4800, uv: 189 },
]

describe("XAxis tick", () => {
	it("Render duplicated ticks of XAxis", () => {
		const spy = vi.fn()
		const { container } = render(() => (
			<LineChart
				width={600}
				height={300}
				data={lineData}
				margin={{ bottom: 5, left: 20, right: 30, top: 5 }}
			>
				<XAxis dataKey="name" interval={0} />
				<YAxis />
				<Line type="monotone" dataKey="balance" stroke="#8884d8" activeDot={{ r: 8 }} />
				<ExpectAxisDomain assert={spy} axisType="xAxis" />
			</LineChart>
		))

		expectXAxisTicks(container, [
			{
				textContent: "Page A",
				x: "80",
				y: "273",
			},
			{
				textContent: "Page B",
				x: "178",
				y: "273",
			},
			{
				textContent: "Page C",
				x: "276",
				y: "273",
			},
			{
				textContent: "Page D",
				x: "374",
				y: "273",
			},
			{
				textContent: "Page E",
				x: "472",
				y: "273",
			},
			{
				textContent: "Page F",
				x: "570",
				y: "273",
			},
		])
		expectLastCalledWith(spy, ["Page A", "Page B", "Page C", "Page D", "Page E", "Page F"])
	})

	it("Render axis with tick for a single data point", () => {
		const spy = vi.fn()
		const { container } = render(() => (
			<BarChart width={300} height={300} data={data.slice(0, 1)}>
				<Bar dataKey="y" isAnimationActive={false} />
				<XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} />
				<YAxis dataKey="y" />
				<ExpectAxisDomain assert={spy} axisType="xAxis" />
			</BarChart>
		))

		// For a single data point, unless barSize is given, the bar will have no width and thus not be rendered.
		// This test merely confirms this known limitation.
		const bar = container.querySelector(".recharts-rectangle")
		expect(bar).not.toBeInTheDocument()

		expectXAxisTicks(container, [
			{
				textContent: "90",
				x: "180",
				y: "273",
			},
		])
		expectLastCalledWith(spy, [90, 90])
	})

	it("Render no ticks if type is category and data is empty", () => {
		const spy = vi.fn()
		const { container } = render(() => (
			<BarChart width={300} height={300} data={[]}>
				<Bar dataKey="y" isAnimationActive={false} />
				<XAxis dataKey="x" />
				<YAxis dataKey="y" />
				<ExpectAxisDomain assert={spy} axisType="xAxis" />
			</BarChart>
		))

		expect(
			container.querySelectorAll(".recharts-xAxis .recharts-cartesian-axis-tick"),
		).toHaveLength(0)
		expectXAxisTicks(container, [])
		expectLastCalledWith(spy, undefined)
	})

	describe("custom tick components", () => {
		/* Solid evaluates `<CustomTick />` before the axis sees it, so a user component passed as an element cannot receive injected props (upstream clones it); pass the component itself. */
		it("should pass object padding to custom tick component", () => {
			const expectedPadding = { left: 20, right: 30 }
			expect.assertions(6)

			const CustomXAxisTick = (props: any) => {
				expect(props.padding).toEqual(expectedPadding)
				return <text>Custom Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<XAxis padding={expectedPadding} tick={CustomXAxisTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})

		it("should pass string padding to custom tick component", () => {
			const expectedPadding = "gap"
			expect.assertions(6)

			const CustomXAxisTick = (props: any) => {
				expect(props.padding).toBe(expectedPadding)
				return <text>Custom Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<XAxis padding={expectedPadding} tick={CustomXAxisTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})

		it("should pass padding to function-based custom tick", () => {
			const expectedPadding = { left: 15, right: 25 }
			expect.assertions(6)

			const customTickFunction = (props: XAxisTickContentProps) => {
				expect(props.padding).toEqual(expectedPadding)
				return <text>Function Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<XAxis padding={expectedPadding} tick={customTickFunction} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})

		it("should pass default padding when no padding is specified", () => {
			expect.assertions(6)

			const CustomXAxisTick = (props: any) => {
				expect(props.padding).toEqual({ left: 0, right: 0 })
				return <text>Custom Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<XAxis tick={CustomXAxisTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})

		it("should pass all TextProps and index and payload to custom tick component", () => {
			const myCustomTick: Mock<(props: XAxisTickContentProps) => JSX.Element> = vi.fn()

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<XAxis tick={myCustomTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))

			expect(myCustomTick).toHaveBeenCalledTimes(6)
			expectNthCalledWith(myCustomTick, 1, {
				angle: 0,
				className: "recharts-xAxis xAxis recharts-cartesian-axis-tick-value",
				fill: "#666",
				height: 30,
				index: 0,
				name: undefined,
				orientation: "bottom",
				padding: {
					left: 0,
					right: 0,
				},
				payload: {
					coordinate: 5,
					index: 0,
					isShow: true,
					offset: 0,
					tickCoord: 5,
					value: 0,
				},
				stroke: "none",
				textAnchor: "middle",
				tickFormatter: undefined,
				verticalAnchor: "start",
				visibleTicksCount: 6,
				width: 390,
				x: 5,
				y: 373,
			})

			expectNthCalledWith(myCustomTick, 2, {
				angle: 0,
				className: "recharts-xAxis xAxis recharts-cartesian-axis-tick-value",
				fill: "#666",
				height: 30,
				index: 1,
				name: undefined,
				orientation: "bottom",
				padding: {
					left: 0,
					right: 0,
				},
				payload: {
					coordinate: 83,
					index: 1,
					isShow: true,
					offset: 0,
					tickCoord: 83,
					value: 1,
				},
				stroke: "none",
				textAnchor: "middle",
				tickFormatter: undefined,
				verticalAnchor: "start",
				visibleTicksCount: 6,
				width: 390,
				x: 83,
				y: 373,
			})
		})
	})

	it("Render ticks of XAxis when specify ticks", () => {
		const axisDomainSpy = vi.fn()
		const { container } = render(() => (
			<LineChart
				width={400}
				height={400}
				data={lineData}
				margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
			>
				<XAxis ticks={[0, 4]} />
				<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				<ExpectAxisDomain assert={axisDomainSpy} axisType="xAxis" />
			</LineChart>
		))

		expectXAxisTicks(container, [
			{
				textContent: "0",
				x: "20",
				y: "358",
			},
			{
				textContent: "4",
				x: "308",
				y: "358",
			},
		])
		expect(axisDomainSpy).toHaveBeenLastCalledWith([0, 1, 2, 3, 4, 5])
	})

	it("Should render the axis line without any ticks", () => {
		const spy = vi.fn()
		const barData = [{ day: "05-01" }, { day: "05-02" }]
		const { container } = render(() => (
			<BarChart width={300} height={300} data={barData}>
				<Bar dataKey="y" isAnimationActive={false} />
				<XAxis dataKey="y" type="number" />
				<ExpectAxisDomain assert={spy} axisType="xAxis" />
			</BarChart>
		))
		const ticksGroup = container.getElementsByClassName("recharts-cartesian-axis-tick-line")
		expect(ticksGroup).toHaveLength(0)

		const axisLine = container.getElementsByClassName("recharts-cartesian-axis-line")
		expect(axisLine).toHaveLength(1)
		expectXAxisTicks(container, [])
		expectLastCalledWith(spy, undefined)
	})

	it("Should pass data, index, and event to the onClick event handler", () => {
		const onClickFn = vi.fn()
		const { container } = render(() => (
			<LineChart width={400} height={400} data={lineData}>
				<XAxis ticks={[0, 4]} onClick={onClickFn} />
				<Line type="monotone" dataKey="uv" stroke="#ff7300" />
			</LineChart>
		))

		const ticksGroup = container.getElementsByClassName("recharts-cartesian-axis-tick-label")
		expect(ticksGroup).toHaveLength(2)

		const firstTick = ticksGroup[0]

		const eventData = {
			coordinate: 5,
			index: 0,
			isShow: true,
			offset: 0,
			tickCoord: 5,
			value: 0,
		}
		const eventIndex = 0
		const eventExpect = expect.objectContaining({
			pageX: 0,
			pageY: 0,
			target: expect.any(Object),
			type: "click",
		})

		fireEvent.click(firstTick)
		expect(onClickFn).toHaveBeenCalledWith(eventData, eventIndex, eventExpect)
	})

	it("should render ticks formatted by tickFormatter", () => {
		const tickFormatter = (value: number) =>
			new Date(value).toLocaleDateString("en-US", {
				day: "numeric",
				hour: "numeric",
				minute: "numeric",
				month: "numeric",
				year: "numeric",
			})

		const { container } = render(() => (
			<ComposedChart width={600} height={50} data={dateWithValueData}>
				<XAxis
					dataKey="time"
					type="number"
					scale="time"
					domain={["auto", "auto"]}
					tickFormatter={tickFormatter}
				/>
				<Line dataKey="value" />
			</ComposedChart>
		))

		expectXAxisTicks(container, [
			{
				textContent: "12/31/2016, 12:00 AM",
				x: "5",
				y: "23",
			},
			{
				textContent: "12/31/2016, 1:00 AM",
				x: "64",
				y: "23",
			},
			{
				textContent: "12/31/2016, 1:30 AM",
				x: "93.5",
				y: "23",
			},
			{
				textContent: "12/31/2016, 2:00 AM",
				x: "123",
				y: "23",
			},
			{
				textContent: "12/31/2016, 3:00 AM",
				x: "182",
				y: "23",
			},
			{
				textContent: "12/31/2016, 3:30 AM",
				x: "211.5",
				y: "23",
			},
			{
				textContent: "12/31/2016, 4:00 AM",
				x: "241",
				y: "23",
			},
			{
				textContent: "12/31/2016, 5:00 AM",
				x: "300",
				y: "23",
			},
			{
				textContent: "12/31/2016, 6:00 AM",
				x: "359",
				y: "23",
			},
			{
				textContent: "12/31/2016, 7:00 AM",
				x: "418",
				y: "23",
			},
			{
				textContent: "12/31/2016, 8:00 AM",
				x: "477",
				y: "23",
			},
			{
				textContent: "12/31/2016, 8:30 AM",
				x: "506.5",
				y: "23",
			},
			{
				textContent: "12/31/2016, 10:00 AM",
				x: "595",
				y: "23",
			},
		])
	})
})
