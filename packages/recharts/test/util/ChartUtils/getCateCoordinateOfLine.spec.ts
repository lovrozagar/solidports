import { describe, it, expect } from "vitest"
import { getCateCoordinateOfLine } from "../../../src/util/ChartUtils"
import { RechartsScale } from "../../../src/util/scale/RechartsScale"

// @ts-expect-error incomplete mock data
const mockScale: RechartsScale = { map: (v: number) => v * 2 }

describe("getCateCoordinateOfLine", () => {
	describe("numerical axis", () => {
		it("should return null when passed empty params", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { scale: mockScale },
			})
			expect(actual).toBeNull()
		})

		it("should return scaled value", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { scale: mockScale },
				dataKey: "x",
				entry: { x: 1 },
			})
			expect(actual).toBe(2)
		})

		it("should use axis.dataKey if the root dataKey is undefined", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { dataKey: "x", scale: mockScale },
				entry: { x: 1 },
			})
			expect(actual).toBe(2)
		})

		it("should use root dataKey if two dataKeys are defined", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { dataKey: "x", scale: mockScale },
				dataKey: "y",
				entry: { x: 1, y: 3 },
			})
			expect(actual).toBe(6)
		})
	})

	describe("category axis", () => {
		it("should return null if there are no ticks", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { scale: mockScale, type: "category" },
				ticks: [],
			})
			expect(actual).toBeNull()
		})

		it("should return first tick coordinate with half of bandSize added, if axis.dataKey is undefined", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { scale: mockScale, type: "category" },
				bandSize: 2,
				index: 0,
				ticks: [{ coordinate: 8, index: 0, value: "foo" }],
			})
			expect(actual).toBe(9)
		})

		it("should follow axis.dataKey -> ticks.value -> tick.coordinate and return that", () => {
			// @ts-expect-error incomplete mock data
			const actual = getCateCoordinateOfLine({
				axis: { dataKey: "foo", scale: mockScale, type: "category" },
				bandSize: 4,
				entry: { foo: "bar" },
				ticks: [
					{ coordinate: 8, index: 0, value: "foo" },
					{ coordinate: 16, index: 1, value: "bar" },
				],
			})
			expect(actual).toBe(18)
		})
	})
})
