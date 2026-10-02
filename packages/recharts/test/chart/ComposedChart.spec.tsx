/* @jsxImportSource @solidjs/web */
import { fireEvent, render } from "../helper/render"
import { flush } from "solid-js"
import { trackSpy } from "../helper/trackSpy"
import { it, vi } from "vitest"
import {
	Area,
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	Tooltip,
	XAxis,
	YAxis,
} from "../../src"
import { assertNotNull } from "../helper/assertNotNull"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"
import { useChartHeight, useChartWidth, useViewBox } from "../../src/context/chartLayoutContext"

import { useClipPathId } from "../../src/container/ClipPathProvider"

describe("<ComposedChart />", () => {
	const data = [
		{ amt: 1400, name: "Page A", pv: 800, uv: 590 },
		{ amt: 1506, name: "Page B", pv: 967, uv: 868 },
		{ amt: 989, name: "Page C", pv: 1098, uv: 1397 },
		{ amt: 1228, name: "Page D", pv: 1200, uv: 1480 },
		{ amt: 1100, name: "Page E", pv: 1108, uv: 1520 },
		{ amt: 1700, name: "Page F", pv: 680, uv: 1400 },
	]

	test("Render 1 line, 1 area, 1bar in the ComposedChart", () => {
		const { container } = render(() => (
			<ComposedChart
				width={800}
				height={400}
				data={data}
				margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
			>
				<XAxis dataKey="name" />
				<YAxis />
				<CartesianGrid stroke="#f5f5f5" />
				<Area type="monotone" dataKey="amt" fill="#8884d8" stroke="#8884d8" />
				<Bar dataKey="pv" barSize={20} fill="#413ea0" />
				<Line type="monotone" dataKey="uv" stroke="#ff7300" />
			</ComposedChart>
		))

		expect(container.querySelectorAll(".recharts-line .recharts-line-curve")).toHaveLength(1)
		expect(container.querySelectorAll(".recharts-bar")).toHaveLength(1)
		expect(container.querySelectorAll(".recharts-area .recharts-area-area")).toHaveLength(1)
	})
	test("Render 1 bar, 1 dot when data has only one element", () => {
		const singleData = [data[0]]
		const { container } = render(() => (
			<ComposedChart
				width={800}
				height={400}
				data={singleData}
				margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
			>
				<XAxis dataKey="name" />
				<YAxis dataKey="pv" orientation="left" yAxisId="left" />
				<YAxis dataKey="uv" orientation="right" yAxisId="right" />
				<CartesianGrid stroke="#f5f5f5" />
				<Bar dataKey="pv" barSize={20} fill="#413ea0" yAxisId="left" />
				<Line type="monotone" dataKey="uv" stroke="#ff7300" yAxisId="right" />
			</ComposedChart>
		))
		expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(1)
		expect(container.querySelectorAll(".recharts-bar .recharts-bar-rectangle")).toHaveLength(1)
	})
	test("MouseEnter ComposedChart should show tooltip, active dot, and cursor", () => {
		mockGetBoundingClientRect({ height: 100, width: 100 })

		const { container } = render(() => (
			<ComposedChart
				width={800}
				height={400}
				data={data}
				margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
			>
				<XAxis dataKey="name" />
				<YAxis />
				<Legend />
				<Tooltip />
				<CartesianGrid stroke="#f5f5f5" />
				<Area
					isAnimationActive={false}
					type="monotone"
					dataKey="amt"
					fill="#8884d8"
					stroke="#8884d8"
				/>
				<Bar isAnimationActive={false} dataKey="pv" barSize={20} fill="#413ea0" />
				<Line isAnimationActive={false} type="monotone" dataKey="uv" stroke="#ff7300" />
			</ComposedChart>
		))

		const chart = container.querySelector(".recharts-wrapper")
		assertNotNull(chart)
		fireEvent.mouseEnter(chart, { clientX: 200, clientY: 100 })

		vi.advanceTimersByTime(0)
		flush()

		expect(container.querySelectorAll(".recharts-tooltip-cursor")).toHaveLength(1)
		expect(container.querySelectorAll(".recharts-active-dot")).toHaveLength(2)
	})
	describe("ComposedChart layout context", () => {
		it("should provide viewBox", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useViewBox())
				return null
			}
			render(() => (
				<ComposedChart width={100} height={50} barSize={20}>
					<Comp />
				</ComposedChart>
			))

			expect(spy).toHaveBeenCalledWith({ height: 40, width: 90, x: 5, y: 5 })
			expect(spy).toHaveBeenCalledTimes(1)
		})
		it("should provide clipPathId", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useClipPathId())
				return null
			}
			render(() => (
				<ComposedChart width={100} height={50} barSize={20}>
					<Comp />
				</ComposedChart>
			))

			expect(spy).toHaveBeenCalledWith(expect.stringMatching(/recharts\d+-clip/))
			expect(spy).toHaveBeenCalledTimes(1)
		})
		it("should provide width", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useChartWidth())
				return null
			}
			render(() => (
				<ComposedChart width={100} height={50} barSize={20}>
					<Comp />
				</ComposedChart>
			))

			expect(spy).toHaveBeenCalledWith(100)
			expect(spy).toHaveBeenCalledTimes(1)
		})
		it("should provide height", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useChartHeight())
				return null
			}
			render(() => (
				<ComposedChart width={100} height={50} barSize={20}>
					<Comp />
				</ComposedChart>
			))

			expect(spy).toHaveBeenCalledWith(50)
			expect(spy).toHaveBeenCalledTimes(1)
		})
	})
})
