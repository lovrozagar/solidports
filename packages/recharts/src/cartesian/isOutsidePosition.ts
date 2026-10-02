const absolutePositions: ReadonlyArray<string> = ["top", "left", "right", "bottom"]

/**
 * True when the legend (or label) sits outside the plot: `top`/`left`/`right`/`bottom`,
 * or a coordinate object. Inside keywords (`insideTop`, …) return false.
 */
export function isOutsidePosition(position: unknown): boolean {
	if (position == null) {
		return false
	}
	if (typeof position === "object") {
		return true
	}
	return typeof position === "string" && absolutePositions.includes(position)
}
