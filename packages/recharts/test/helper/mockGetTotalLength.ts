/**
 * jsdom does not implement getTotalLength on SVGPathElement:
 * https://github.com/jsdom/jsdom/issues/1330
 * Also, when rendering SVGs, the ref is not the actual
 * SVGPathElement but a SVGElement. The SVGPathElement
 * (or SVGGeometryElement) global objects do not appear
 * to be available in the jsdom environment at all.
 *
 * We can't mock this using vitest because vitest refuses
 * to mock a method on an object that is not supposed to
 * have that method.
 *
 * So we monkey-patch SVGElement instead of SVGPathElement,
 * because SVGPathElement is not available in jsdom.
 *
 * @param length The length to return when getTotalLength
 *   is called.
 * @returns void
 */
export function mockGetTotalLength(length: number): void {
	const proto = SVGElement.prototype as Record<string, unknown>
	if (typeof proto.getTotalLength !== "function") {
		proto.getTotalLength = () => length
	}
}
