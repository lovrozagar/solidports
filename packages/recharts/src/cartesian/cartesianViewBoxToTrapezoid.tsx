import type { CartesianViewBoxRequired, TrapezoidViewBox } from "../util/types"

export function cartesianViewBoxToTrapezoid(box: undefined): undefined
export function cartesianViewBoxToTrapezoid(
	box: CartesianViewBoxRequired | TrapezoidViewBox,
): TrapezoidViewBox
export function cartesianViewBoxToTrapezoid(
	box: CartesianViewBoxRequired | TrapezoidViewBox | undefined,
): TrapezoidViewBox | undefined {
	if (box == null) {
		return undefined
	}
	return {
		height: box.height,
		lowerWidth: "lowerWidth" in box ? box.lowerWidth : box.width,
		upperWidth: "upperWidth" in box ? box.upperWidth : box.width,
		width: box.width,
		x: box.x,
		y: box.y,
	}
}
