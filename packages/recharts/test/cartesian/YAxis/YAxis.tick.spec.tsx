/* @jsxImportSource @solidjs/web */
import type { JSX } from '@solidjs/web';
import { describe, expect, it, Mock, vi } from "vitest"
import { fireEvent, render } from "../../helper/render"
import {
	Bar,
	BarChart,
	ComposedChart,
	Customized,
	Line,
	LineChart,
	XAxis,
	YAxis,
	YAxisTickContentProps,
} from "../../../src"
import { ExpectAxisDomain, expectYAxisTicks } from "../../helper/expectAxisTicks"
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

describe("YAxis tick", () => {
	it("Render duplicated ticks of YAxis", () => {
		const spy = vi.fn()
		const { container } = render(() => (
			<LineChart
				width={600}
				height={300}
				data={lineData}
				margin={{ bottom: 5, left: 20, right: 30, top: 5 }}
			>
				<XAxis />
				<YAxis type="category" dataKey="name" interval={0} />
				<Line type="monotone" dataKey="balance" stroke="#8884d8" activeDot={{ r: 8 }} />
				<ExpectAxisDomain assert={spy} axisType="yAxis" />
			</LineChart>
		))

		expectYAxisTicks(container, [
			{
				textContent: "Page A",
				x: "72",
				y: "265",
			},
			{
				textContent: "Page B",
				x: "72",
				y: "213",
			},
			{
				textContent: "Page C",
				x: "72",
				y: "161",
			},
			{
				textContent: "Page D",
				x: "72",
				y: "109",
			},
			{
				textContent: "Page E",
				x: "72",
				y: "57",
			},
			{
				textContent: "Page F",
				x: "72",
				y: "5",
			},
		])
		expectLastCalledWith(spy, ["Page A", "Page B", "Page C", "Page D", "Page E", "Page F"])
	})
	it("Render axis with tick for a single data point", () => {
		const spy = vi.fn()
		const { container } = render(() => (
			<BarChart width={300} height={300} data={data.slice(0, 1)}>
				<Bar dataKey="y" isAnimationActive={false} />
				<YAxis dataKey="y" type="number" domain={["dataMin", "dataMax"]} />
				<XAxis dataKey="x" />
				<ExpectAxisDomain assert={spy} axisType="yAxis" />
			</BarChart>
		))

		// For a single data point, unless barSize is given, the bar will have no width and thus not be rendered.
		// This test merely confirms this known limitation.
		const bar = container.querySelector(".recharts-rectangle")
		expect(bar).not.toBeInTheDocument()

		expectYAxisTicks(container, [
			{
				textContent: "90",
				x: "57",
				y: "135",
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
				<YAxis type="category" dataKey="y" />
				<ExpectAxisDomain assert={spy} axisType="yAxis" />
			</BarChart>
		))

		expect(
			container.querySelectorAll(".recharts-yAxis .recharts-cartesian-axis-tick"),
		).toHaveLength(0)
		expectYAxisTicks(container, [])
		expectLastCalledWith(spy, undefined)
	})
	describe("custom tick components", () => {
		/* Solid evaluates `<CustomTick />` before the axis sees it, so a user component passed as an element cannot receive injected props (upstream clones it); pass the component itself. */
		it("should pass object padding to custom tick component", () => {
			const expectedPadding = { bottom: 30, top: 20 }
			expect.assertions(5)

			const CustomYAxisTick = (props: any) => {
				expect(props.padding).toEqual(expectedPadding)
				return <text>Custom Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<YAxis padding={expectedPadding} tick={CustomYAxisTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})
		it("should pass string padding to custom tick component", () => {
			const expectedPadding = "gap"
			expect.assertions(5)

			const CustomYAxisTick = (props: any) => {
				expect(props.padding).toBe(expectedPadding)
				return <text>Custom Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<YAxis padding={expectedPadding} tick={CustomYAxisTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})
		it("should pass padding to function-based custom tick", () => {
			const expectedPadding = { bottom: 25, top: 15 }
			expect.assertions(5)

			const customTickFunction = (props: YAxisTickContentProps) => {
				expect(props.padding).toEqual(expectedPadding)
				return <text>Function Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<YAxis padding={expectedPadding} tick={customTickFunction} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})
		it("should pass default padding when no padding is specified", () => {
			expect.assertions(5)

			const CustomYAxisTick = (props: any) => {
				expect(props.padding).toEqual({ bottom: 0, top: 0 })
				return <text>Custom Tick</text>
			}

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<YAxis tick={CustomYAxisTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))
		})
		it("should pass all TextProps and index and payload to custom tick component", () => {
			const myCustomTick: Mock<(props: YAxisTickContentProps) => JSX.Element> = vi.fn()

			render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<YAxis tick={myCustomTick} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))

			expect(myCustomTick).toHaveBeenCalledTimes(5)
			expectNthCalledWith(myCustomTick, 1, {
				angle: 0,
				className: "recharts-yAxis yAxis recharts-cartesian-axis-tick-value",
				fill: "#666",
				height: 390,
				index: 0,
				name: undefined,
				orientation: "left",
				padding: {
					bottom: 0,
					top: 0,
				},
				payload: {
					coordinate: 395,
					index: 0,
					isShow: true,
					offset: 0,
					tickCoord: 395,
					value: 0,
				},
				stroke: "none",
				textAnchor: "end",
				tickFormatter: undefined,
				verticalAnchor: "middle",
				visibleTicksCount: 5,
				width: 60,
				x: 57,
				y: 395,
			})

			expectNthCalledWith(myCustomTick, 2, {
				angle: 0,
				className: "recharts-yAxis yAxis recharts-cartesian-axis-tick-value",
				fill: "#666",
				height: 390,
				index: 1,
				name: undefined,
				orientation: "left",
				padding: {
					bottom: 0,
					top: 0,
				},
				payload: {
					coordinate: 297.5,
					index: 1,
					isShow: true,
					offset: 0,
					tickCoord: 297.5,
					value: 100,
				},
				stroke: "none",
				textAnchor: "end",
				tickFormatter: undefined,
				verticalAnchor: "middle",
				visibleTicksCount: 5,
				width: 60,
				x: 57,
				y: 297.5,
			})
		})
		it("Render ticks of YAxis when specify ticks", () => {
			const axisDomainSpy = vi.fn()
			const { container } = render(() => (
				<LineChart
					width={400}
					height={400}
					data={lineData}
					margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
				>
					<YAxis ticks={[0, 4]} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
					<ExpectAxisDomain assert={axisDomainSpy} axisType="yAxis" />
				</LineChart>
			))

			// So despite explicitly specifying two ticks, only one is rendered, why?
			expectYAxisTicks(container, [
				{
					textContent: "4",
					x: "72",
					y: "376.4",
				},
			])
			expect(axisDomainSpy).toHaveBeenLastCalledWith([0, 400])
		})
		it("Should render the axis line without any ticks", () => {
			const spy = vi.fn()
			const barData = [{ day: "05-01" }, { day: "05-02" }]
			const { container } = render(() => (
				<BarChart width={300} height={300} data={barData}>
					<Bar dataKey="y" isAnimationActive={false} />
					<YAxis dataKey="y" type="number" />
					<Customized component={() => <ExpectAxisDomain assert={spy} axisType="yAxis" />} />
				</BarChart>
			))
			const ticksGroup = container.getElementsByClassName("recharts-cartesian-axis-tick-line")
			expect(ticksGroup).toHaveLength(0)

			const axisLine = container.getElementsByClassName("recharts-cartesian-axis-line")
			expect(axisLine).toHaveLength(1)
			expectYAxisTicks(container, [])
			expectLastCalledWith(spy, undefined)
		})
		it("Should pass data, index, and event to the onClick event handler", () => {
			const onClickFn = vi.fn()
			const { container } = render(() => (
				<LineChart width={400} height={400} data={lineData}>
					<YAxis ticks={[0, 4]} onClick={onClickFn} />
					<Line type="monotone" dataKey="uv" stroke="#ff7300" />
				</LineChart>
			))

			const ticksGroup = container.getElementsByClassName("recharts-cartesian-axis-tick-label")
			expect(ticksGroup).toHaveLength(1)

			const firstTick = ticksGroup[0]

			const eventData = {
				coordinate: 391.1,
				index: 1,
				isShow: true,
				offset: 0,
				tickCoord: 391.1,
				value: 4,
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
					<YAxis
						dataKey="time"
						type="number"
						scale="time"
						domain={["auto", "auto"]}
						tickFormatter={tickFormatter}
					/>
					<Line dataKey="value" />
				</ComposedChart>
			))

			expectYAxisTicks(container, [
				{
					textContent: "12/31/2016, 12:00 AM",
					x: "57",
					y: "45",
				},
				{
					textContent: "12/31/2016, 3:00 AM",
					x: "57",
					y: "33",
				},
				{
					textContent: "12/31/2016, 6:00 AM",
					x: "57",
					y: "21",
				},
				{
					textContent: "12/31/2016, 9:00 AM",
					x: "57",
					y: "9",
				},
			])
		})
	})
})
