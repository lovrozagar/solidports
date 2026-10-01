import type { AxisId } from "./cartesianAxisSlice"
import type { IfOverflow } from "../util/IfOverflow"
import type { ReferenceLineSegment } from "../cartesian/ReferenceLine"

export type ReferenceElementSettings = {
	yAxisId: AxisId
	xAxisId: AxisId
	ifOverflow: IfOverflow
}

export type ReferenceDotSettings = ReferenceElementSettings & {
	x: unknown
	y: unknown
	r: number
}

export type ReferenceAreaSettings = ReferenceElementSettings & {
	x1: unknown
	x2: unknown
	y1: unknown
	y2: unknown
}

export type ReferenceLineSettings = ReferenceElementSettings & {
	x: unknown
	y: unknown
	segment: ReferenceLineSegment | undefined
}

export type ReferenceElementState = {
	dots: ReadonlyArray<ReferenceDotSettings>
	areas: ReadonlyArray<ReferenceAreaSettings>
	lines: ReadonlyArray<ReferenceLineSettings>
}

export const initialReferenceElementsState: ReferenceElementState = {
	areas: [],
	dots: [],
	lines: [],
}
