/* eslint-disable import/no-cycle */
import type { ChartData } from "./chartDataSlice"
import type { AxisId } from "./cartesianAxisSlice"
import type { DataKey } from "../util/types"
import type { LineSettings } from "./types/LineSettings"
import type { ScatterSettings } from "./types/ScatterSettings"
import type { AreaSettings } from "./types/AreaSettings"
import type { BarSettings } from "./types/BarSettings"
import type { RadialBarSettings } from "./types/RadialBarSettings"
import type { PieSettings } from "./types/PieSettings"
import type { RadarSettings } from "./types/RadarSettings"

/**
 * Unique ID of the graphical item.
 * This is used to identify the graphical item in the state and in the React tree.
 * This is required for every graphical item - it's either provided by the user or generated automatically.
 */
export type GraphicalItemId = string

export interface GraphicalItemSettings {
	/**
	 * Unique ID of the graphical item.
	 * This is used to identify the graphical item in the state and in the React tree.
	 * This is required for every graphical item - it's either provided by the user or generated automatically.
	 */
	id: GraphicalItemId
	/**
	 * If the given graphical item has its own data array, it will appear here.
	 * If this is undefined, the data will be taken from the chart root prop.
	 */
	data: ChartData | undefined
	dataKey: DataKey<unknown> | undefined
	/**
	 * Why not just stop pushing the graphical items to state when they are hidden?
	 * Well some components decide to continue showing them anyway.
	 * Legend for example will keep showing a record for hidden graphical items.
	 * Stacks for example will ignore them.
	 */
	hide: boolean
}

export interface BaseCartesianGraphicalItemSettings extends GraphicalItemSettings {
	/**
	 * Each of the graphical items explicitly says which axis it uses;
	 * this property is optional for users but every graphical item must have a default,
	 * and it is required here.
	 */
	xAxisId: AxisId
	yAxisId: AxisId
	zAxisId: AxisId
	/**
	 * Graphical items that are inside Brush panorama should not interact with the main area graphical items
	 * and vice versa.
	 */
	isPanorama: boolean
}

export type CartesianGraphicalItemSettings =
	| AreaSettings
	| BarSettings
	| LineSettings
	| ScatterSettings

export interface BasePolarGraphicalItemSettings extends GraphicalItemSettings {
	angleAxisId: AxisId
	radiusAxisId: AxisId
}

export type PolarGraphicalItemSettings = PieSettings | RadarSettings | RadialBarSettings

export type ReplacePayload<T> = {
	prev: T
	next: T
}
