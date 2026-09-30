import { assertNotNull } from "./assertNotNull"

export type ExpectedLabel = {
	height: string | null
	offset: string | null
	textContent: string
	width: string | null
	x: string | null
	y: string | null
}

export function expectLabels(
	container: Element,
	expectedLabels: ReadonlyArray<ExpectedLabel>,
	cssSelector: string = ".recharts-text.recharts-label",
) {
	assertNotNull(container)
	const labels = container.querySelectorAll(cssSelector)

	const actualLabels: ReadonlyArray<ExpectedLabel> = Array.from(labels).map((label) => ({
		height: label.getAttribute("height"),
		offset: label.getAttribute("offset"),
		textContent: label.textContent ?? "",
		width: label.getAttribute("width"),
		x: label.getAttribute("x"),
		y: label.getAttribute("y"),
	}))

	expect(actualLabels).toEqual(expectedLabels)
}
