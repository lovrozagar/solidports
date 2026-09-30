import { expect } from "vitest"
import { assertNotNull } from "./assertNotNull"

type ExpectedBrush = {
	height: string
	width: string
	x: string
	y: string
}

export function expectBrush(container: Element, expected: ExpectedBrush) {
	assertNotNull(container)
	const brush = container.querySelector(".recharts-brush rect")
	assertNotNull(brush)
	const actual = {
		height: brush.getAttribute("height"),
		width: brush.getAttribute("width"),
		x: brush.getAttribute("x"),
		y: brush.getAttribute("y"),
	}
	expect(actual).toEqual(expected)
}
