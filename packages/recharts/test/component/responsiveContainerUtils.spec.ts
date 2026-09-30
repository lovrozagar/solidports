import {
	calculateChartDimensions,
	getDefaultWidthAndHeight,
	getInnerDivStyle,
} from "../../src/component/responsiveContainerUtils"

describe("calculateChartDimensions", () => {
	it("should handle percentage width and height", () => {
		const dimensions = calculateChartDimensions(200, 100, {
			aspect: undefined,
			height: "50%",
			maxHeight: undefined,
			width: "50%",
		})
		/*
		 * The containerWidth and containerHeight are already percentage based because it's set as that percentage in CSS.
		 * Means we don't have to calculate percentages here.
		 */
		expect(dimensions).toEqual({ calculatedHeight: 100, calculatedWidth: 200 })
	})

	it("should handle fixed width and height", () => {
		const dimensions = calculateChartDimensions(200, 100, {
			aspect: undefined,
			height: 75,
			maxHeight: undefined,
			width: 150,
		})
		expect(dimensions).toEqual({ calculatedHeight: 75, calculatedWidth: 150 })
	})

	it("should handle zero height correctly", () => {
		const dimensions = calculateChartDimensions(500, 500, {
			aspect: 2,
			height: 0,
			maxHeight: undefined,
			width: 300,
		})
		expect(dimensions).toEqual({ calculatedHeight: 150, calculatedWidth: 300 })
	})

	it("should handle zero width correctly", () => {
		const dimensions = calculateChartDimensions(500, 500, {
			aspect: 2,
			height: 300,
			maxHeight: undefined,
			width: 0,
		})
		expect(dimensions).toEqual({ calculatedHeight: 300, calculatedWidth: 600 })
	})

	it("should preserve aspect ratio when oversized", () => {
		const dimensions = calculateChartDimensions(500, 500, {
			aspect: 2,
			height: 100,
			maxHeight: undefined,
			width: 300,
		})
		expect(dimensions).toEqual({ calculatedHeight: 150, calculatedWidth: 300 })
	})

	it("should preserve aspect ratio when undersized", () => {
		const dimensions = calculateChartDimensions(500, 500, {
			aspect: 2,
			height: 300,
			maxHeight: undefined,
			width: 100,
		})
		expect(dimensions).toEqual({ calculatedHeight: 50, calculatedWidth: 100 })
	})

	it("should respect maxHeight when aspect ratio is used", () => {
		const dimensions = calculateChartDimensions(500, 500, {
			aspect: 2,
			height: undefined,
			maxHeight: 150,
			width: 400,
		})
		expect(dimensions).toEqual({ calculatedHeight: 150, calculatedWidth: 400 })
	})

	it("should return container dimensions if width/height are 100%", () => {
		const dimensions = calculateChartDimensions(800, 600, {
			aspect: undefined,
			height: "100%",
			maxHeight: undefined,
			width: "100%",
		})
		expect(dimensions).toEqual({ calculatedHeight: 600, calculatedWidth: 800 })
	})

	it("should ignore negative aspect ratio", () => {
		const dimensions = calculateChartDimensions(200, 100, {
			aspect: -2,
			height: "100%",
			maxHeight: undefined,
			width: "100%",
		})
		expect(dimensions).toEqual({ calculatedHeight: 100, calculatedWidth: 200 })
	})
})

describe("getInnerDivStyle", () => {
	it("should return shrinkable object if both width and height are percentages", () => {
		const style = getInnerDivStyle({ height: "10%", width: "20%" })
		expect(style).toEqual({
			height: 0,
			overflow: "visible",
			width: 0,
		})
	})

	it("should return shrinkable object if width is percentage and height is fixed", () => {
		const style = getInnerDivStyle({ height: 100, width: "20%" })
		expect(style).toEqual({
			overflowX: "visible",
			width: 0,
		})
	})

	it("should return shrinkable object if width is fixed and height is percentage", () => {
		const style = getInnerDivStyle({ height: "10%", width: 200 })
		expect(style).toEqual({
			height: 0,
			overflowY: "visible",
		})
	})

	it("should return empty object if both width and height are fixed", () => {
		const style = getInnerDivStyle({ height: 100, width: 200 })
		expect(style).toEqual({})
	})
})

describe("getDefaultWidthAndHeight", () => {
	it("should return 100% for both width and height if neither is provided", () => {
		const { width, height } = getDefaultWidthAndHeight({
			aspect: undefined,
			height: undefined,
			width: undefined,
		})
		expect(width).toBe("100%")
		expect(height).toBe("100%")
	})

	it("should return provided width and default height if only width is provided", () => {
		const { width, height } = getDefaultWidthAndHeight({
			aspect: undefined,
			height: undefined,
			width: 300,
		})
		expect(width).toBe(300)
		expect(height).toBe("100%")
	})

	it("should return 100% width and provided height if only height is provided but aspect is not", () => {
		const { width, height } = getDefaultWidthAndHeight({
			aspect: undefined,
			height: 150,
			width: undefined,
		})
		expect(width).toBe("100%")
		expect(height).toBe(150)
	})

	it("should return provided width and height if both are provided", () => {
		const { width, height } = getDefaultWidthAndHeight({
			aspect: undefined,
			height: 150,
			width: 300,
		})
		expect(width).toBe(300)
		expect(height).toBe(150)
	})

	it("should return default width and height if aspect is provided without width and height", () => {
		const { width, height } = getDefaultWidthAndHeight({
			aspect: 2,
			height: undefined,
			width: undefined,
		})
		expect(width).toBe("100%")
		expect(height).toBe("100%")
	})

	it("should return provided width and no height if aspect is provided with width", () => {
		const { width, height } = getDefaultWidthAndHeight({ aspect: 2, height: undefined, width: 300 })
		expect(width).toBe(300)
		expect(height).toBe(undefined)
	})

	it("should return undefined width and provided height if aspect is provided with height", () => {
		const { width, height } = getDefaultWidthAndHeight({ aspect: 2, height: 150, width: undefined })
		expect(width).toBe(undefined)
		expect(height).toBe(150)
	})
})
