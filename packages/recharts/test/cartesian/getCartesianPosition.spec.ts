import { describe, it, expect } from "vitest"
import {
	getCartesianPosition,
	GetCartesianPositionOptions,
	CartesianPosition,
} from "../../src/cartesian/getCartesianPosition"
import { CartesianViewBoxRequired, TrapezoidViewBox } from "../../src/util/types"

describe("useCartesianPosition", () => {
	describe("in a rectangle", () => {
		const viewBox: TrapezoidViewBox = {
			height: 100,
			lowerWidth: 200,
			upperWidth: 200,
			width: 200,
			x: 100,
			y: 50,
		}
		const offset = 5

		it('should return correct attributes for position "insideTop"', () => {
			const options: GetCartesianPositionOptions = {
				offset: 0,
				position: "insideTop",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 200,
				y: 50,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "top"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "top",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 200,
				y: 45,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "bottom"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "bottom",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 200,
				y: 155,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "left"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "left",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "middle",
				x: 95,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "right"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "right",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 305,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideLeft"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 105,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideRight"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideRight",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "middle",
				x: 295,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottom"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideBottom",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 200,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideTopLeft"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideTopLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "start",
				x: 105,
				y: 55,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideTopRight"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideTopRight",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "start",
				x: 295,
				y: 55,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottomLeft"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideBottomLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "end",
				x: 105,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottomRight"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideBottomRight",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 295,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it("should return correct attributes for position as an object with number coordinates", () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: { x: 10, y: 20 },
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 110,
				y: 70,
			}
			expect(actual).toEqual(expected)
		})
		it("should return correct attributes for position as an object with percentage coordinates", () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: { x: "50%", y: "50%" },
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 200,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "center"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "center",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "middle",
				x: 200,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
	})
	describe("in regular Funnel (wide on top, narrow on bottom)", () => {
		const viewBox: TrapezoidViewBox = {
			height: 100,
			lowerWidth: 150,
			upperWidth: 200,
			width: 175,
			x: 100,
			y: 50,
		}
		const offset = 5

		it('should return correct attributes for position "insideTop"', () => {
			const options: GetCartesianPositionOptions = {
				offset: 0,
				position: "insideTop",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 200,
				y: 50,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "top"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "top",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 200,
				y: 45,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "bottom"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "bottom",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 200,
				y: 155,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "left"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "left",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "middle",
				x: 107.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "right"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "right",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 292.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideLeft"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 117.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideRight"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideRight",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "middle",
				x: 282.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottom"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideBottom",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 200,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideTopLeft"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideTopLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "start",
				x: 105,
				y: 55,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideTopRight"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideTopRight",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "start",
				x: 295,
				y: 55,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottomLeft"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideBottomLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "end",
				x: 130,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottomRight"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "insideBottomRight",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 270,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it("should return correct attributes for position as an object with number coordinates", () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: { x: 10, y: 20 },
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 110,
				y: 70,
			}
			expect(actual).toEqual(expected)
		})
		it("should return correct attributes for position as an object with percentage coordinates", () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: { x: "50%", y: "50%" },
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 187.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "center"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "center",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "middle",
				x: 200,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
	})
	describe("with negative height", () => {
		const negativeHeightViewBox: TrapezoidViewBox = {
			height: -100,
			lowerWidth: 150,
			upperWidth: 200,
			width: 175,
			x: 100,
			y: 150,
		}
		const offset = 5

		it('should return correct attributes for position "top"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "top",
				viewBox: negativeHeightViewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 200,
				y: 155,
			}
			expect(actual).toEqual(expected)
		})
	})
	describe("with negative width", () => {
		const negativeWidthViewBox: TrapezoidViewBox = {
			height: 100,
			lowerWidth: -150,
			upperWidth: -200,
			width: -175,
			x: 300,
			y: 50,
		}
		const offset = 5

		it('should return correct attributes for position "left"', () => {
			const options: GetCartesianPositionOptions = {
				offset,
				position: "left",
				viewBox: negativeWidthViewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 292.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
	})
	describe("with parentViewBox and clamp=true", () => {
		const viewBox: TrapezoidViewBox = {
			height: 100,
			lowerWidth: 200,
			upperWidth: 200,
			width: 200,
			x: 100,
			y: 50,
		}
		const parentViewBox: CartesianViewBoxRequired = { height: 500, width: 500, x: 0, y: 0 }
		const offset = 5

		it('should return correct attributes for position "top"', () => {
			const options: GetCartesianPositionOptions = {
				clamp: true,
				offset,
				parentViewBox,
				position: "top",
				viewBox,
			}
			const actual = getCartesianPosition(options)
			const expected: CartesianPosition = {
				height: 50,
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				width: 200,
				x: 200,
				y: 45,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideLeft"', () => {
			const options: GetCartesianPositionOptions = {
				clamp: true,
				offset,
				parentViewBox,
				position: "insideLeft",
				viewBox,
			}
			const actual = getCartesianPosition(options)

			const expected: CartesianPosition = {
				x: 105,
				y: 100,
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				width: 200, // midHeightWidth -> (200+200)/2 = 200
				height: 100,
			}
			expect(actual).toEqual(expected)
		})
	})
	describe("with parentViewBox and clamp=false", () => {
		const viewBox: TrapezoidViewBox = {
			height: 100,
			lowerWidth: 200,
			upperWidth: 200,
			width: 200,
			x: 100,
			y: 50,
		}
		const parentViewBox: CartesianViewBoxRequired = { height: 500, width: 500, x: 0, y: 0 }
		const offset = 5

		it('should NOT clamp attributes for position "top"', () => {
			const options: GetCartesianPositionOptions = {
				clamp: false,
				offset,
				parentViewBox,
				position: "top",
				viewBox,
			}
			const actual = getCartesianPosition(options)

			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 200,
				y: 45,
			}
			expect(actual).toEqual(expected)
		})
	})
	describe("in reversed Funnel (narrow on top, wide on bottom", () => {
		const viewBox: TrapezoidViewBox = {
			height: 100,
			lowerWidth: 200,
			upperWidth: 150,
			width: 175,
			x: 100,
			y: 50,
		}
		const offset = 5

		it('should return correct attributes for position "insideTop"', () => {
			const input: GetCartesianPositionOptions = {
				offset: 0,
				position: "insideTop",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 175,
				y: 50,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "top"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "top",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 175,
				y: 45,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "bottom"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "bottom",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "start",
				x: 175,
				y: 155,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "left"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "left",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "middle",
				x: 82.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "right"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "right",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 267.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideLeft"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideLeft",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "middle",
				x: 92.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideRight"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideRight",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "middle",
				x: 257.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottom"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideBottom",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "end",
				x: 175,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideTopLeft"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideTopLeft",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "start",
				x: 105,
				y: 55,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideTopRight"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideTopRight",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "start",
				x: 245,
				y: 55,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottomLeft"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideBottomLeft",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "start",
				verticalAnchor: "end",
				x: 80,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "insideBottomRight"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "insideBottomRight",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 270,
				y: 145,
			}
			expect(actual).toEqual(expected)
		})
		it("should return correct attributes for position as an object with number coordinates", () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: { x: 10, y: 20 },
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 110,
				y: 70,
			}
			expect(actual).toEqual(expected)
		})
		it("should return correct attributes for position as an object with percentage coordinates", () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: { x: "50%", y: "50%" },
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "end",
				verticalAnchor: "end",
				x: 187.5,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
		it('should return correct attributes for position "center"', () => {
			const input: GetCartesianPositionOptions = {
				offset,
				position: "center",
				viewBox,
			}
			const actual = getCartesianPosition(input)
			const expected: CartesianPosition = {
				horizontalAnchor: "middle",
				verticalAnchor: "middle",
				x: 175,
				y: 100,
			}
			expect(actual).toEqual(expected)
		})
	})
})
