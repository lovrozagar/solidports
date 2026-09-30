import { vi } from "vitest"
import { mockHTMLElementProperty } from "./mockHTMLElementProperty"
import { NonEmptyArray } from "../../src/util/types"

export function getMockDomRect(partial: Partial<DOMRect> = {}): DOMRect {
	return {
		bottom: 0,
		height: 0,
		left: 0,
		right: 0,
		top: 0,
		width: 0,
		x: 0,
		y: 0,
		...partial,
		toJSON() {
			JSON.stringify(this)
		},
	}
}

/**
 * getBoundingClientRect always returns 0 in jsdom,
 * we can't test for actual returned string size.
 * Execution order matters.
 * https://github.com/jsdom/jsdom/issues/1590#issuecomment-578350151
 *
 * Assumes vitest restoreMock is turned on by default
 * because there is no explicit cleanup available:
 * https://vitest.dev/config/#restoremocks
 *
 * @param rect overrides getBoundingClientRect return value
 * @param mockClientHeightWidth overrides offsetWidth/offsetHeight
 * @returns void
 */
export function mockGetBoundingClientRect(
	rect: Partial<DOMRect>,
	mockClientHeightWidth = true,
): void {
	const mockDomRect = getMockDomRect(rect)
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(mockDomRect)

	if (mockClientHeightWidth) {
		mockHTMLElementProperty("offsetHeight", mockDomRect.height)
		mockHTMLElementProperty("offsetWidth", mockDomRect.width)
	}
}

/**
 * Mock a sequence of getBoundingClientRect calls with
 * different values. Useful for testing Legend and other
 * components that rely on DOM element size and change
 * their layout as rendering progresses.
 * @param rects array of partial DOMRect objects returned
 *   in sequence. The last rect repeats.
 * @param mockClientHeightWidth if true, also mock
 *   offsetHeight and offsetWidth
 * @return void
 */
export function mockSequenceOfGetBoundingClientRect(
	rects: NonEmptyArray<Partial<DOMRect>>,
	mockClientHeightWidth = true,
): void {
	const mockDomRects = rects.map(getMockDomRect)
	for (let i = 0; i < mockDomRects.length - 1; i++) {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValueOnce(mockDomRects[i])
	}
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
		mockDomRects[mockDomRects.length - 1],
	)

	if (mockClientHeightWidth) {
		mockHTMLElementProperty("offsetHeight", mockDomRects[0].height)
		mockHTMLElementProperty("offsetWidth", mockDomRects[0].width)
	}
}
