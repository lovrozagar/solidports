/*
 * getTotalLength forces path geometry (layout) on every call. The line draw animation asks for it
 * on every frame while the path `d` stays fixed, so the length is cached per element and `d`.
 * Keyed by the element itself: the entry dies with the DOM node.
 */
const measured = new WeakMap<SVGPathElement, { d: string | null; length: number }>()

export function pathTotalLength(path: SVGPathElement | null | undefined): number {
	if (path == null || typeof path.getTotalLength !== "function") {
		return 0
	}
	const d = path.getAttribute("d")
	const cached = measured.get(path)
	if (cached != null && cached.d === d) {
		return cached.length
	}
	let length = 0
	try {
		length = path.getTotalLength() || 0
	} catch {
		length = 0
	}
	measured.set(path, { d, length })
	return length
}
