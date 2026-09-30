import { describe, it, expect } from "vitest"
import { getRelativeCoordinate } from "../../src"
import { getMockDomRect } from "../helper/mockGetBoundingClientRect"
import {
	HTMLMousePointer,
	HTMLTouchPointer,
	RelativePointer,
	SVGMousePointer,
	SVGTouchPointer,
} from "../../src/util/types"

describe("getRelativeCoordinate", () => {
	describe("with HTML elements", () => {
		it("should return chart coordinates relative to the top-left corner of the chart", () => {
			const event: HTMLMousePointer = {
				clientX: 100,
				clientY: 100,
				currentTarget: {
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
					offsetHeight: 100,
					offsetWidth: 100,
				},
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer = {
				relativeX: 50,
				relativeY: 50,
			}

			expect(actual).toEqual(expected)
		})
		it("should return chart coordinates relative to the top-left corner of the chart with scale", () => {
			const event: HTMLMousePointer = {
				/*
				 * clientX and clientY are the mouse position relative to the viewport, including scroll.
				 * These ignore scale on whatever is being hovered over,
				 * so while we hover over the same position relative to the viewport,
				 * the chart below has moved because it's now scaled 2x.
				 */
				clientX: 100,
				clientY: 100,
				currentTarget: {
					/*
					 * As one zooms in and out, the rect.width and rect.height will change,
					 * but the offsetWidth and offsetHeight will remain the same.
					 *
					 * So this mock target represents a chart that's been scaled by 2x.
					 */
					getBoundingClientRect: () =>
						getMockDomRect({ height: 200, left: 50, top: 50, width: 200 }),
					offsetHeight: 100,
					offsetWidth: 100,
				},
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer = {
				/*
				 * Since we hover over the same position relative to the viewport,
				 * but the chart is now twice as big, the chart coordinates should be half.
				 */
				relativeX: 25,
				relativeY: 25,
			}

			expect(actual).toEqual(expected)
		})
		it("should handle zero offsetWidth/offsetHeight gracefully", () => {
			const event: HTMLMousePointer = {
				clientX: 100,
				clientY: 100,
				currentTarget: {
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
					offsetHeight: 0,
					offsetWidth: 0,
				},
			}
			const actual = getRelativeCoordinate(event)

			/* When offsetWidth/offsetHeight is 0, scale defaults to 1 */
			const expected: RelativePointer = {
				relativeX: 50,
				relativeY: 50,
			}

			expect(actual).toEqual(expected)
		})
	})
	describe("with SVG elements", () => {
		it("should return chart coordinates relative to the top-left corner of the SVG", () => {
			const event: SVGMousePointer = {
				clientX: 100,
				clientY: 100,
				currentTarget: {
					getBBox: () => getMockDomRect({ height: 100, width: 100, x: 0, y: 0 }),
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
				},
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer = {
				relativeX: 50,
				relativeY: 50,
			}

			expect(actual).toEqual(expected)
		})
		it("should return chart coordinates with SVG scale (CSS transform)", () => {
			const event: SVGMousePointer = {
				clientX: 100,
				clientY: 100,
				currentTarget: {
					/*
					 * The bounding client rect represents the visual size on screen (affected by CSS transform).
					 * getBBox returns the intrinsic SVG coordinate space size (not affected by CSS transform).
					 */
					getBBox: () => getMockDomRect({ height: 100, width: 100, x: 0, y: 0 }),
					getBoundingClientRect: () =>
						getMockDomRect({ height: 200, left: 50, top: 50, width: 200 }),
				},
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer = {
				/* SVG is scaled 2x, so coordinates should be halved */
				relativeX: 25,
				relativeY: 25,
			}

			expect(actual).toEqual(expected)
		})
		it("should handle zero getBBox width/height gracefully", () => {
			const event: SVGMousePointer = {
				clientX: 100,
				clientY: 100,
				currentTarget: {
					getBBox: () => getMockDomRect({ height: 0, width: 0, x: 0, y: 0 }),
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
				},
			}
			const actual = getRelativeCoordinate(event)

			/* When getBBox returns 0, scale defaults to 1 */
			const expected: RelativePointer = {
				relativeX: 50,
				relativeY: 50,
			}

			expect(actual).toEqual(expected)
		})
		it("should handle non-uniform SVG scaling", () => {
			const event: SVGMousePointer = {
				clientX: 100,
				clientY: 100,
				currentTarget: {
					/* SVG is scaled 2x horizontally, 4x vertically */
					getBBox: () => getMockDomRect({ height: 100, width: 100, x: 0, y: 0 }),
					getBoundingClientRect: () => getMockDomRect({ height: 400, left: 0, top: 0, width: 200 }),
				},
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer = {
				relativeX: 50,
				relativeY: 25,
			}

			expect(actual).toEqual(expected)
		})
	})
	describe("with Touch events", () => {
		it("should return array of coordinates for single touch on HTML element", () => {
			const event: HTMLTouchPointer = {
				currentTarget: {
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
					offsetHeight: 100,
					offsetWidth: 100,
				},
				touches: [{ clientX: 100, clientY: 100 }],
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer[] = [
				{
					relativeX: 50,
					relativeY: 50,
				},
			]

			expect(actual).toEqual(expected)
		})
		it("should return array of coordinates for multiple touches on HTML element", () => {
			const event: HTMLTouchPointer = {
				currentTarget: {
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
					offsetHeight: 100,
					offsetWidth: 100,
				},
				touches: [
					{ clientX: 100, clientY: 100 },
					{ clientX: 150, clientY: 150 },
				],
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer[] = [
				{ relativeX: 50, relativeY: 50 },
				{ relativeX: 100, relativeY: 100 },
			]

			expect(actual).toEqual(expected)
		})
		it("should return array of coordinates for touch on SVG element", () => {
			const event: SVGTouchPointer = {
				currentTarget: {
					getBBox: () => getMockDomRect({ height: 100, width: 100, x: 0, y: 0 }),
					getBoundingClientRect: () =>
						getMockDomRect({ height: 100, left: 50, top: 50, width: 100 }),
				},
				touches: [{ clientX: 100, clientY: 100 }],
			}
			const actual = getRelativeCoordinate(event)

			const expected: RelativePointer[] = [
				{
					relativeX: 50,
					relativeY: 50,
				},
			]

			expect(actual).toEqual(expected)
		})
	})
})
