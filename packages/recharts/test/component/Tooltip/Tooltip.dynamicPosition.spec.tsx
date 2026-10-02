/* @jsxImportSource @solidjs/web */
import { describe, it, expect, beforeEach } from "vitest"
import { render } from "../../helper/render"
import { Line, LineChart, Tooltip } from "../../../src"
import { getTooltip, showTooltipOnCoordinate } from "./tooltipTestHelpers"
import { lineChartMouseHoverTooltipSelector } from "./tooltipMouseHoverSelectors"
import {
	mockGetBoundingClientRect,
	mockSequenceOfGetBoundingClientRect,
} from "../../helper/mockGetBoundingClientRect"

/* Regression: previously the tooltip wrapper measured its bounding box only
   once at mount (0×0 while hidden) and never re-measured, so getTooltipTranslate
   fell into the "tooltipBox.height > 0 && width > 0" guard's else branch and
   left the wrapper at top:0/left:0. Real-browser users saw the tooltip stuck
   at the chart's top-left corner instead of following the cursor. */
describe("Tooltip dynamic position", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 10, width: 10 })
	})

	it("transform updates when payload changes between two hover coordinates", () => {
		const { container } = render(() => (
			<LineChart
				width={100}
				height={100}
				data={[
					{ name: "A", value: 1 },
					{ name: "B", value: 1 },
					{ name: "C", value: 1 },
				]}
				margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
			>
				<Line dataKey="value" />
				<Tooltip />
			</LineChart>
		))

		showTooltipOnCoordinate(container, lineChartMouseHoverTooltipSelector, {
			clientX: 5,
			clientY: 20,
		})
		const firstTransform = getTooltip(container).style.transform
		expect(firstTransform).toMatch(/translate\(/)

		showTooltipOnCoordinate(container, lineChartMouseHoverTooltipSelector, {
			clientX: 95,
			clientY: 20,
		})
		const secondTransform = getTooltip(container).style.transform

		expect(secondTransform).toMatch(/translate\(/)
		expect(secondTransform).not.toBe(firstTransform)
	})

	it("re-measures bounding box once payload becomes available (initial 0×0 → non-zero)", () => {
		/* Simulates the real-browser sequence: tooltip wrapper mounts hidden
		   (0×0), then user hovers and payload arrives (10×10). Without the
		   re-measure, the wrapper stays stuck at translate(0,0). */
		mockSequenceOfGetBoundingClientRect([
			{ height: 0, width: 0 },
			{ height: 0, width: 0 },
			{ height: 10, width: 10 },
		])

		const { container } = render(() => (
			<LineChart
				width={100}
				height={100}
				data={[
					{ name: "A", value: 1 },
					{ name: "B", value: 1 },
				]}
				margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
			>
				<Line dataKey="value" />
				<Tooltip />
			</LineChart>
		))

		showTooltipOnCoordinate(container, lineChartMouseHoverTooltipSelector, {
			clientX: 50,
			clientY: 50,
		})
		const tooltip = getTooltip(container)
		expect(tooltip.style.transform).not.toBe("")
		expect(tooltip.style.transform).toMatch(/translate\(/)
	})
})
