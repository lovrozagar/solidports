/* @jsxImportSource @solidjs/web */
import { describe, expect, it } from "vitest"
import { BarChart, XAxis } from "../../../src"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import { assertNotNull } from "../../helper/assertNotNull"
import { getCalculatedXAxisHeight } from "../../../src/util/XAxisUtils"
import { rechartsTestRender } from "../../helper/createSelectorTestCase"

const data = [
	{ amt: 2400, name: "Page A" },
	{ amt: 1398, name: "Page B" },
	{ amt: 9800, name: "Page C" },
]

describe('<XAxis height="auto" />', () => {
	it("should render the x-axis with the given numeric height", () => {
		const xAxisHeight = 40

		const { container } = rechartsTestRender(() => (
			<BarChart width={100} height={100} data={data}>
				<XAxis height={xAxisHeight} />
			</BarChart>
		))

		const xAxis = container.querySelector(".xAxis")
		assertNotNull(xAxis)
		const xAxisLine = xAxis.querySelector("line")

		expect(xAxis).toBeVisible()
		expect(xAxisLine).toHaveAttribute("height", String(xAxisHeight))
	})

	it('should render x-axis with dynamically calculated height when height="auto"', () => {
		/* getBoundingClientRect returns 0 in jsdom, so mock a tick label height of 80px */
		mockGetBoundingClientRect({ height: 80, width: 30 })

		const { container } = rechartsTestRender(() => (
			<BarChart width={400} height={300} data={data}>
				<XAxis dataKey="name" height="auto" />
			</BarChart>
		))

		const tickElements = container.querySelectorAll(".recharts-cartesian-axis-tick-value")

		const xAxis = container.querySelector(".xAxis")
		assertNotNull(xAxis)
		const xAxisLine = xAxis.querySelector("line")

		const calculatedXAxisHeight = getCalculatedXAxisHeight({
			label: undefined,
			labelGapWithTick: 5,
			tickMargin: 2,
			tickSize: 6,
			ticks: Array.from(tickElements),
		})

		expect(calculatedXAxisHeight).toBe(88)
		expect(xAxisLine).toHaveAttribute("height", "88")
	})
})
