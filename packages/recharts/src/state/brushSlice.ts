import type { Padding } from "../util/types"

/**
 * From all Brush properties, only height has a default value and will always be defined.
 * Other properties are nullable and will be computed from offsets and margins if they are not set.
 */
export type BrushSettings = {
	x: number | undefined
	y: number | undefined
	width: number | undefined
	height: number
	padding: Padding
}
