/* @jsxImportSource @solidjs/web */
import { describe, it, test, expect } from "vitest"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { Line, LineChart, Tooltip, useActiveTooltipDataPoints } from "../../src"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"

const data1 = [
	{ amt: undefined, date: new Date("2024-10-01"), numberIndex: 1, uv: 4000 },
	{ amt: 2210, date: new Date("2024-10-02"), numberIndex: 2, uv: 3000 },
	{ amt: 2290, date: new Date("2024-10-03"), numberIndex: 3, uv: 2000 },
	{ amt: 2000, date: new Date("2024-10-04"), numberIndex: 4, uv: 2780 },
	{ amt: 2181, date: new Date("2024-10-05"), numberIndex: 5, uv: 1890 },
]

const data2 = [
	{ amt: 2210, date: new Date("2024-10-02"), numberIndex: 2 },
	{ amt: 2290, date: new Date("2024-10-03"), numberIndex: 3 },
	{ amt: 2000, date: new Date("2024-10-04"), numberIndex: 4 },
	{ amt: 2181, date: new Date("2024-10-05"), numberIndex: 5 },
]

describe("LineChart with multiple data series", () => {
	// https://github.com/recharts/recharts/issues/3797
	const renderTestCase = createSelectorTestCase((props) => (
		<LineChart width={500} height={300}>
			<Line data={data1} dataKey="uv" activeDot={{ r: 1 }} fill="red" />
			<Line data={data2} dataKey="amt" activeDot={{ r: 2 }} fill="green" />
			<Tooltip defaultIndex={1} />
			{props.children}
		</LineChart>
	))

	test("useActiveTooltipDataPoints", () => {
		const { spy } = renderTestCase(useActiveTooltipDataPoints)
		expectLastCalledWith(spy, [data1[1], data2[1]])
	})
	it("should activate dots on both lines when hovering over the chart", () => {
		const { container } = renderTestCase()
		const allActiveDots = container.querySelectorAll(".recharts-active-dot circle")
		expect(allActiveDots.length).toBe(2)
	})
})
