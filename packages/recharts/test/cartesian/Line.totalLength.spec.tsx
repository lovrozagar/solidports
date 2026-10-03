import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "../helper/render"
import { Line, LineChart } from "../../src"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"

const data = [
	{ x: 10, y: 50 },
	{ x: 50, y: 20 },
	{ x: 90, y: 70 },
]

describe("<Line /> total length measurement", () => {
	// jsdom has no SVGPathElement; paths are SVGElement instances (see helper/mockGetTotalLength)
	const proto = SVGElement.prototype as SVGElement & { getTotalLength?: () => number }
	const original = proto.getTotalLength
	const getTotalLength = vi.fn(() => 100)

	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
		getTotalLength.mockClear()
		proto.getTotalLength = getTotalLength
	})

	afterEach(() => {
		if (original == null) {
			delete proto.getTotalLength
		} else {
			proto.getTotalLength = original
		}
	})

	it("never measures the path when isAnimationActive={false}", () => {
		const { container } = render(() => (
			<LineChart width={500} height={500} data={data}>
				<Line isAnimationActive={false} dataKey="y" />
			</LineChart>
		))
		expect(container.querySelector(".recharts-line-curve")).not.toBeNull()
		expect(getTotalLength).not.toHaveBeenCalled()
	})

	it("measures the path when the draw animation runs", async () => {
		render(() => (
			<LineChart width={500} height={500} data={data}>
				<Line isAnimationActive animationDuration={50} dataKey="y" />
			</LineChart>
		))
		await vi.waitFor(() => expect(getTotalLength).toHaveBeenCalled())
	})
})
