import { assertNotNull } from "./assertNotNull"

/**
 * Checks that the `front` element is rendered later in the
 * DOM than `back` element. Because SVG does not support
 * z-index directly we rely on sibling order to determine
 * visual stacking.
 * @param front Element rendered on top of `back`
 * @param back Element rendered below `front`
 */
export function assertZIndexLayerOrder({ back, front }: { back: Element; front: Element }) {
	assertNotNull(front)
	assertNotNull(back)
	const position = back.compareDocumentPosition(front)
	const isFrontOnTop =
		position === Node.DOCUMENT_POSITION_FOLLOWING ||
		position === (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)
	if (isFrontOnTop === false) {
		throw new Error("Expected front element to be rendered on top of back element")
	}
}
