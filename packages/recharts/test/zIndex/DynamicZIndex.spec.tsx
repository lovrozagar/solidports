import { describe, it, expect, vi } from "vitest"
import { createSignal, flush } from "solid-js"
import { render } from "../helper/render"
import { LineChart, Line, XAxis, YAxis } from "../../src"

describe("Dynamic zIndex updates", () => {
	it("should keep the line in the DOM when zIndex changes dynamically", () => {
		const data = [
			{ name: "A", pv: 2400, uv: 400 },
			{ name: "B", pv: 4567, uv: 300 },
		]

		function ChartWithDynamicZIndex() {
			const [zIndex, setZIndex] = createSignal(10)

			return (
				<div>
					<button type="button" onClick={() => setZIndex((z) => z + 1)}>
						Increment zIndex
					</button>
					<LineChart width={400} height={400} data={data}>
						<XAxis dataKey="name" />
						<YAxis />
						<Line dataKey="uv" stroke="#8884d8" zIndex={zIndex()} isAnimationActive={false} />
						<Line dataKey="pv" stroke="#82ca9d" isAnimationActive={false} />
					</LineChart>
				</div>
			)
		}

		const { container, getByText } = render(() => <ChartWithDynamicZIndex />)
		vi.runAllTimers()
		flush()

		const initialLines = container.querySelectorAll(".recharts-line")
		expect(initialLines.length).toBe(2)

		const button = getByText("Increment zIndex")

		// Rapid zIndex updates should not cause lines to disappear
		button.click()
		flush()
		vi.runAllTimers()
		flush()

		let lines = container.querySelectorAll(".recharts-line")
		expect(lines.length).toBe(2)

		button.click()
		flush()
		vi.runAllTimers()
		flush()

		lines = container.querySelectorAll(".recharts-line")
		expect(lines.length).toBe(2)
	})
})
