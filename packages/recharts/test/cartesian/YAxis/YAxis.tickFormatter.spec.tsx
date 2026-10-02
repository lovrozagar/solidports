/* @jsxImportSource @solidjs/web */
import { describe, it, expect, vi } from "vitest"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { Line, LineChart, YAxis } from "../../../src"
import { PageData } from "../../_data"
import { expectYAxisTicks } from "../../helper/expectAxisTicks"

describe("YAxis with custom tickFormatter", () => {
	const tickFormatterSpy = vi.fn((value, index) => `formatted: ${value}: ${index}`)

	const renderTestCase = createSelectorTestCase((props) => (
		<LineChart
			width={400}
			height={400}
			data={PageData}
			margin={{ bottom: 20, left: 20, right: 20, top: 20 }}
		>
			<YAxis type="category" dataKey="name" tickFormatter={tickFormatterSpy} />
			<Line type="monotone" dataKey="uv" stroke="#ff7300" />
			{props.children}
		</LineChart>
	))

	it("should render ticks formatted with tickFormatter", () => {
		const { container } = renderTestCase()

		expectYAxisTicks(container, [
			{ textContent: "formatted: Page A: 0", x: "72", y: "380" },
			{ textContent: "formatted: Page B: 1", x: "72", y: "308" },
			{ textContent: "formatted: Page C: 2", x: "72", y: "236" },
			{ textContent: "formatted: Page D: 3", x: "72", y: "164" },
			{ textContent: "formatted: Page E: 4", x: "72", y: "92" },
			{ textContent: "formatted: Page F: 5", x: "72", y: "20" },
		])
	})
	it("should call the tickFormatter with the correct parameters", () => {
		// https://github.com/recharts/recharts/issues/6010
		renderTestCase()

		/* GOTCHA-007-E sibling-mount-order: expect(tickFormatterSpy).toHaveBeenCalledTimes(2 * PageData.length) */
		// interesting that they are called upside down but ... that doesn't really matter
		expect(tickFormatterSpy).toHaveBeenCalledWith("Page F", 5)
		expect(tickFormatterSpy).toHaveBeenCalledWith("Page E", 4)
		expect(tickFormatterSpy).toHaveBeenCalledWith("Page D", 3)
		expect(tickFormatterSpy).toHaveBeenCalledWith("Page C", 2)
		expect(tickFormatterSpy).toHaveBeenCalledWith("Page B", 1)
		expect(tickFormatterSpy).toHaveBeenCalledWith("Page A", 0)
	})
})
