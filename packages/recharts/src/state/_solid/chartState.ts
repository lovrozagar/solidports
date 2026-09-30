import type { AxisId, XAxisSettings, YAxisSettings, ZAxisSettings } from "../cartesianAxisSlice"
import type { AngleAxisSettings, RadiusAxisSettings } from "../polarAxisSlice"
import type { TooltipState, TooltipInteractionState } from "../tooltipSlice"
import type { LegendState } from "../legendSlice"
import type { BrushSettings } from "../brushSlice"
import type { GraphicalItemId } from "../graphicalItemsSlice"
import type { Margin, LayoutType } from "../../util/types"
import type { LineSettings } from "../types/LineSettings"
import type { AreaSettings } from "../types/AreaSettings"
import type { BarSettings } from "../types/BarSettings"
import type { ScatterSettings } from "../types/ScatterSettings"
import type { PieSettings } from "../types/PieSettings"
import type { RadarSettings } from "../types/RadarSettings"
import type { RadialBarSettings } from "../types/RadialBarSettings"

/** Phase 2+: axis entry wraps settings; leaves room for computed fields (domain, scale) in Phase 3+. */
export type XAxisState = { settings: XAxisSettings }

/** Phase 2+: axis entry wraps settings; leaves room for computed fields (domain, scale) in Phase 3+. */
export type YAxisState = { settings: YAxisSettings }

/** Phase 2+: axis entry wraps settings; leaves room for computed fields (domain, scale) in Phase 3+. */
export type ZAxisState = { settings: ZAxisSettings }

/** Phase 4: wraps settings for fine-grained Solid store reactivity. */
export type AngleAxisState = { settings: AngleAxisSettings }

/** Phase 4: wraps settings for fine-grained Solid store reactivity. */
export type RadiusAxisState = { settings: RadiusAxisSettings }

/** Discriminated union for cartesian graphical item state entries. */
export type LineState = { type: "line"; settings: LineSettings }
/** Discriminated union for cartesian graphical item state entries. */
export type AreaState = { type: "area"; settings: AreaSettings }
/** Discriminated union for cartesian graphical item state entries. */
export type BarState = { type: "bar"; settings: BarSettings }
/** Discriminated union for cartesian graphical item state entries. */
export type ScatterState = { type: "scatter"; settings: ScatterSettings }
/** Union of all cartesian item state shapes. */
export type CartesianItemState = LineState | AreaState | BarState | ScatterState

/** Discriminated union for polar graphical item state entries. */
export type PieState = { type: "pie"; settings: PieSettings }
/** Discriminated union for polar graphical item state entries. */
export type RadarState = { type: "radar"; settings: RadarSettings }
/** Discriminated union for polar graphical item state entries. */
export type RadialBarState = { type: "radialBar"; settings: RadialBarSettings }
/** Union of all polar item state shapes. */
export type PolarItemState = PieState | RadarState | RadialBarState

/** Union of all graphical item state shapes. */
export type ItemState = CartesianItemState | PolarItemState

/** Phase 1 placeholder — expands to per-animation settings in Phase 2+. */
export type AnimationState = {
	isAnimationActive: boolean
	animationDuration: number
	animationEasing: string
}

/** BrushState is BrushSettings for Phase 1; alias for clarity in ChartState. */
export type BrushState = BrushSettings

/** Full chart state held in a Solid createStore. */
export type ChartState = {
	chartSize: { width: number; height: number }
	margin: Margin
	layout: LayoutType
	cartesianAxes: {
		xAxis: Record<AxisId, XAxisState>
		yAxis: Record<AxisId, YAxisState>
		zAxis: Record<AxisId, ZAxisState>
	}
	polarAxes: {
		angleAxis: Record<AxisId, AngleAxisState>
		radiusAxis: Record<AxisId, RadiusAxisState>
	}
	graphicalItems: Record<GraphicalItemId, ItemState>
	tooltip: TooltipState
	legend: LegendState
	brush: BrushState
	animation: AnimationState
}

/* Factories mirror each slice's initial state. Literal construction (not JSON roundtrip) so function
   fields (e.g. LegendItemSorter in Phase 2) survive. Keep in sync with the slice files. */

function makeBrushState(): BrushState {
	return { height: 0, padding: { bottom: 0, left: 0, right: 0, top: 0 }, width: 0, x: 0, y: 0 }
}

function makeLegendState(): LegendState {
	return {
		payload: [],
		settings: { align: "center", itemSorter: "value", layout: "horizontal", verticalAlign: "middle" },
		size: { height: 0, width: 0 },
	}
}

function makeTooltipState(): TooltipState {
	const noInteraction: TooltipInteractionState = {
		active: false,
		coordinate: undefined,
		dataKey: undefined,
		graphicalItemId: undefined,
		index: null,
	}
	return {
		axisInteraction: { click: { ...noInteraction }, hover: { ...noInteraction } },
		itemInteraction: { click: { ...noInteraction }, hover: { ...noInteraction } },
		keyboardInteraction: { ...noInteraction },
		settings: { active: false, axisId: 0, defaultIndex: undefined, shared: undefined, trigger: "hover" },
		syncInteraction: {
			active: false,
			coordinate: undefined,
			dataKey: undefined,
			graphicalItemId: undefined,
			index: null,
			label: undefined,
			sourceViewBox: undefined,
		},
		tooltipItemPayloads: [],
	}
}

/** Returns a fresh ChartState per call. Always use this to seed createStore — never share an instance. */
export function createInitialChartState(overrides?: Partial<ChartState>): ChartState {
	return {
		animation: { animationDuration: 1500, animationEasing: "ease", isAnimationActive: true },
		brush: makeBrushState(),
		cartesianAxes: { xAxis: {}, yAxis: {}, zAxis: {} },
		chartSize: { height: 0, width: 0 },
		graphicalItems: {},
		layout: "horizontal",
		legend: makeLegendState(),
		margin: { bottom: 5, left: 5, right: 5, top: 5 },
		polarAxes: { angleAxis: {}, radiusAxis: {} },
		tooltip: makeTooltipState(),
		...overrides,
	}
}
