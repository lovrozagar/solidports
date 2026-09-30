import { describe, it, expect } from "vitest"
import { CursorRectangle, getCursorRectangle } from "../../../src/util/cursor/getCursorRectangle"
import { ChartCoordinate, ChartOffsetInternal, LayoutType } from "../../../src/util/types"
import { makeChartOffset } from "../../helper/offsetHelpers"

const activeCoordinate: ChartCoordinate = {
	x: 100,
	y: 170,
}
const offset: ChartOffsetInternal = makeChartOffset({
	height: 17,
	left: 10,
	top: 80,
	width: 13,
})

const tooltipAxisBandSize = 256

const otherLayouts: ReadonlyArray<LayoutType> = ["vertical", "centric", "radial"]

describe("getCursorRectangle", () => {
	describe("horizontal layout", () => {
		it("should return rectangle props", () => {
			const layout = "horizontal"
			const result = getCursorRectangle(layout, activeCoordinate, offset, tooltipAxisBandSize)
			const expected: CursorRectangle = {
				fill: "#ccc",
				height: 16,
				stroke: "none",
				width: 256,
				x: -28,
				y: 80.5,
			}
			expect(result).toEqual(expected)
		})
	})
	describe.each(otherLayouts)("%s layout", (layout: LayoutType) => {
		it("should return rectangle props", () => {
			const result = getCursorRectangle(layout, activeCoordinate, offset, tooltipAxisBandSize)
			const expected: CursorRectangle = {
				fill: "#ccc",
				height: 256,
				stroke: "none",
				width: 12,
				x: 10.5,
				y: 42,
			}
			expect(result).toEqual(expected)
		})
	})
})
