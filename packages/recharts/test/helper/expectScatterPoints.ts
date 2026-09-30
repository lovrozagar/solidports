import { expect } from "vitest"
import { assertNotNull } from "./assertNotNull"

export type ExpectedPoint = {
	cx: string
	cy: string
	d: string
	height: string
	transform: string
	width: string
}

export function getAllScatterPoints(container: Element): ReadonlyArray<SVGPathElement> {
	return Array.from(container.querySelectorAll(".recharts-scatter-symbol .recharts-symbols"))
}

export function expectScatterPoints(
	container: Element,
	expectedPoints: ReadonlyArray<ExpectedPoint>,
) {
	assertNotNull(container)
	const allPoints = getAllScatterPoints(container)
	const actualPoints = allPoints.map((point) => ({
		cx: point.getAttribute("cx"),
		cy: point.getAttribute("cy"),
		d: point.getAttribute("d"),
		height: point.getAttribute("height"),
		transform: point.getAttribute("transform"),
		width: point.getAttribute("width"),
	}))
	expect(actualPoints).toEqual(expectedPoints)
}
