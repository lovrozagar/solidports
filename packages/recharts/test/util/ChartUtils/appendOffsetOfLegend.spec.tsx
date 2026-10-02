import { describe, expect, it, vi } from "vitest"
import { appendOffsetOfLegend } from "../../../src/util/ChartUtils"
import { OffsetHorizontal, OffsetVertical, Size } from "../../../src/util/types"
import { LegendSettings } from "../../../src/state/legendSlice"

const emptyOffset: OffsetVertical & OffsetHorizontal = {
	bottom: 9,
	left: 5,
	right: 2,
	top: 1,
}

vi.mock("../../../src/util/ReactUtils")

describe("appendOffsetOfLegend", () => {
	it("should add extra space for a vertical legend", () => {
		const settings: LegendSettings = {
			align: "left",
			itemSorter: "value",
			layout: "vertical",
			verticalAlign: "bottom",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}
		const result = appendOffsetOfLegend(emptyOffset, settings, size)
		expect(result).toEqual({
			...emptyOffset,
			left: 105,
		})
	})
	it("should add extra space for a horizontal legend, middle aligned", () => {
		const settings: LegendSettings = {
			align: "left",
			itemSorter: "value",
			layout: "horizontal",
			verticalAlign: "middle",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}
		const result = appendOffsetOfLegend(emptyOffset, settings, size)
		expect(result).toEqual({
			...emptyOffset,
			left: 105,
		})
	})
	it("should not modify the original offset that was passed as an argument", () => {
		const clone: OffsetVertical & OffsetHorizontal = { ...emptyOffset }
		const settings: LegendSettings = {
			align: "left",
			itemSorter: "value",
			layout: "horizontal",
			verticalAlign: "middle",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}
		appendOffsetOfLegend(emptyOffset, settings, size)

		expect(emptyOffset).toEqual(clone)
	})
	it("should add extra space for a horizontal legend", () => {
		const settings: LegendSettings = {
			align: "left",
			itemSorter: "value",
			layout: "horizontal",
			verticalAlign: "bottom",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}
		const result = appendOffsetOfLegend(emptyOffset, settings, size)
		expect(result).toEqual({ ...emptyOffset, bottom: 209 })
	})
	it("should add extra space for a vertical legend, center aligned", () => {
		const settings: LegendSettings = {
			align: "center",
			itemSorter: "value",
			layout: "vertical",
			verticalAlign: "bottom",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}
		const result = appendOffsetOfLegend(emptyOffset, settings, size)
		expect(result).toEqual({ ...emptyOffset, bottom: 209 })
	})
	it("should do nothing for vertical legend with align: center", () => {
		const settings: LegendSettings = {
			align: "center",
			itemSorter: "value",
			layout: "vertical",
			verticalAlign: "middle",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}
		const result = appendOffsetOfLegend(emptyOffset, settings, size)
		expect(result).toEqual(emptyOffset)
	})
	it("should add space for horizontal legend with verticalAlign: middle and align:left", () => {
		const settings: LegendSettings = {
			align: "left",
			itemSorter: "value",
			layout: "horizontal",
			verticalAlign: "middle",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}

		const result = appendOffsetOfLegend(emptyOffset, settings, size)
		expect(result).toEqual({ ...emptyOffset, left: 105 })
	})
	it("should reserve chart space for an outside position-based legend", () => {
		const settings: LegendSettings = {
			align: "center",
			itemSorter: "value",
			layout: "horizontal",
			offset: 30,
			position: "bottom",
			verticalAlign: "bottom",
		}
		const size: Size = {
			height: 200,
			width: 100,
		}

		expect(appendOffsetOfLegend(emptyOffset, settings, size)).toEqual({
			...emptyOffset,
			bottom: 239,
		})
	})
})
