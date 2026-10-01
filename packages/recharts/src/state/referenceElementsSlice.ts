import type { SetStoreFunction } from "solid-js/store"
import type { AxisId } from "./cartesianAxisSlice"
import type { IfOverflow } from "../util/IfOverflow"
import type { ReferenceLineSegment } from "../cartesian/ReferenceLine"
import type { ChartState } from "./store"

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

export const addLine =
	(settings: ReferenceLineSettings) =>
	(setStore: SetStoreFunction<ChartState>) =>
		setStore("referenceElements", "lines", (prev) => [...prev, settings])

export const removeLine =
	(settings: ReferenceLineSettings) =>
	(setStore: SetStoreFunction<ChartState>) =>
		setStore("referenceElements", "lines", (prev) => prev.filter((l) => l !== settings))

export const addDot =
	(settings: ReferenceDotSettings) =>
	(setStore: SetStoreFunction<ChartState>) =>
		setStore("referenceElements", "dots", (prev) => [...prev, settings])

export const removeDot =
	(settings: ReferenceDotSettings) =>
	(setStore: SetStoreFunction<ChartState>) =>
		setStore("referenceElements", "dots", (prev) => prev.filter((d) => d !== settings))

export const addArea =
	(settings: ReferenceAreaSettings) =>
	(setStore: SetStoreFunction<ChartState>) =>
		setStore("referenceElements", "areas", (prev) => [...prev, settings])

export const removeArea =
	(settings: ReferenceAreaSettings) =>
	(setStore: SetStoreFunction<ChartState>) =>
		setStore("referenceElements", "areas", (prev) => prev.filter((a) => a !== settings))
