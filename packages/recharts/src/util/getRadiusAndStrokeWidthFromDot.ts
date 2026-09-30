/* eslint-disable import/no-cycle */
import { ActiveDotType, DotType } from "./types"
import { svgPropertiesNoEventsFromUnknown } from "./svgPropertiesNoEvents"

export function getRadiusAndStrokeWidthFromDot(dot: ActiveDotType | DotType): {
	r: number
	strokeWidth: number
} {
	const props = svgPropertiesNoEventsFromUnknown(dot) as
		| Record<string, unknown>
		| null
	const defaultR = 3
	const defaultStrokeWidth = 2
	if (props != null) {
		const r = props.r
		/* svgPropertiesNoEvents canonicalizes camelCase → kebab; check both forms. */
		const strokeWidth = props["stroke-width"] ?? props.strokeWidth
		let realR = Number(r)
		let realStrokeWidth = Number(strokeWidth)
		if (Number.isNaN(realR) || realR < 0) {
			realR = defaultR
		}
		if (Number.isNaN(realStrokeWidth) || realStrokeWidth < 0) {
			realStrokeWidth = defaultStrokeWidth
		}
		return {
			r: realR,
			strokeWidth: realStrokeWidth,
		}
	}
	return {
		r: defaultR,
		strokeWidth: defaultStrokeWidth,
	}
}
