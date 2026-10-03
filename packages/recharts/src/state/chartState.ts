import type { AxisId, XAxisSettings, YAxisSettings, ZAxisSettings } from "./cartesianAxisSlice"
import type { AngleAxisSettings, RadiusAxisSettings } from "./polarAxisSlice"
import type { TooltipState, TooltipInteractionState } from "./tooltipSlice"
import type { LegendState } from "./legendSlice"
import type { BrushSettings } from "./brushSlice"
import type { GraphicalItemId } from "./graphicalItemsSlice"
import type { ChartDataState } from "./chartDataSlice"
import { markRawData } from "./rawData"
import type { ErrorBarsState } from "./errorBarSlice"
import type { EventSettingsState } from "./eventSettingsSlice"
import type { ChartLayoutState } from "./layoutSlice"
import type { ChartOptions } from "./optionsSlice"
import type { PolarChartState } from "./polarOptionsSlice"
import type { ReferenceElementState } from "./referenceElementsSlice"
import type { UpdatableChartOptions } from "./rootPropsSlice"
import type { ZIndexState } from "./zIndexSlice"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { RenderedTicksState } from "./renderedTicksSlice"
import { createInitialRenderedTicksState } from "./renderedTicksSlice"
import type { LineSettings } from "./types/LineSettings"
import type { AreaSettings } from "./types/AreaSettings"
import type { BarSettings } from "./types/BarSettings"
import type { ScatterSettings } from "./types/ScatterSettings"
import type { PieSettings } from "./types/PieSettings"
import type { RadarSettings } from "./types/RadarSettings"
import type { RadialBarSettings } from "./types/RadialBarSettings"

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

/** Chart-level animation defaults. Per-item match/interpolate live on item props. */
export type AnimationState = {
	isAnimationActive: boolean | "auto"
	animationDuration: number
	animationEasing: string
}

/** BrushState is BrushSettings for Phase 1; alias for clarity in ChartState. */
export type BrushState = BrushSettings

/** Full chart state held in a Solid createStore. */
export type ChartState = {
	animation: AnimationState
	brush: BrushState
	cartesianAxes: {
		xAxis: Record<AxisId, XAxisState>
		yAxis: Record<AxisId, YAxisState>
		zAxis: Record<AxisId, ZAxisState>
	}
	chartData: ChartDataState
	chartSize: { width: number; height: number }
	errorBars: ErrorBarsState
	eventSettings: EventSettingsState
	graphicalItems: Record<GraphicalItemId, ItemState>
	layout: ChartLayoutState
	legend: LegendState
	margin: ChartLayoutState["margin"]
	options: ChartOptions
	polarAxes: {
		angleAxis: Record<AxisId, AngleAxisState>
		radiusAxis: Record<AxisId, RadiusAxisState>
	}
	polarOptions: PolarChartState
	referenceElements: ReferenceElementState
	renderedTicks: RenderedTicksState
	rootProps: UpdatableChartOptions
	tooltip: TooltipState
	zIndex: ZIndexState
}

/* Factories mirror each slice's initial state. Literal construction (not JSON roundtrip) so function
   fields (e.g. LegendItemSorter) survive. Keep in sync with the slice files. Never export a singleton. */

function makeBrushState(): BrushState {
	return { height: 0, padding: { bottom: 0, left: 0, right: 0, top: 0 }, width: 0, x: 0, y: 0 }
}

function makeLegendState(): LegendState {
	return {
		payload: [],
		settings: {
			align: "center",
			itemSorter: "value",
			layout: "horizontal",
			offset: 0,
			position: undefined,
			verticalAlign: "middle",
		},
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

function makeChartDataState(): ChartDataState {
	return {
		chartData: undefined,
		computedData: undefined,
		dataEndIndex: 0,
		dataStartIndex: 0,
	}
}

/** Chart data seed for a chart root; ChartDataContextProvider keeps it in sync after mount. */
export function createInitialChartDataState(data: ChartDataState["chartData"]): ChartDataState {
	return {
		...makeChartDataState(),
		chartData: markRawData(data),
		dataEndIndex: data != null && data.length > 0 ? data.length - 1 : 0,
	}
}

function makeEventSettingsState(): EventSettingsState {
	return {
		throttleDelay: "raf",
		throttledEvents: ["mousemove", "touchmove", "pointermove", "scroll", "wheel"],
	}
}

function makeLayoutState(): ChartLayoutState {
	return {
		height: 0,
		layoutType: "horizontal",
		margin: { bottom: 5, left: 5, right: 5, top: 5 },
		scale: 1,
		width: 0,
	}
}

/**
 * Layout seed for a chart root. Report components keep the store in sync after
 * mount; seeding lets the first render use the declared size, margin, and layout.
 */
export function createInitialLayoutState(seed: {
	width?: unknown
	height?: unknown
	margin?: Partial<ChartLayoutState["margin"]>
	layoutType?: ChartLayoutState["layoutType"]
}): ChartLayoutState {
	const layout = makeLayoutState()
	const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0
	return {
		...layout,
		height: isPositive(seed.height) ? seed.height : layout.height,
		layoutType: seed.layoutType ?? layout.layoutType,
		/* Same resolution as ReportChartMargin (upstream setMargin): a provided margin
		   fills missing sides with 0, not with the default margin. */
		margin:
			seed.margin == null
				? layout.margin
				: {
						bottom: seed.margin.bottom ?? 0,
						left: seed.margin.left ?? 0,
						right: seed.margin.right ?? 0,
						top: seed.margin.top ?? 0,
					},
		width: isPositive(seed.width) ? seed.width : layout.width,
	}
}

function makeOptionsState(): ChartOptions {
	return {
		chartName: "",
		defaultTooltipEventType: "axis",
		eventEmitter: undefined,
		tooltipPayloadSearcher: () => undefined,
	}
}

function makeReferenceElementsState(): ReferenceElementState {
	return { areas: [], dots: [], lines: [] }
}

function makeRootPropsState(): UpdatableChartOptions {
	return {
		accessibilityLayer: true,
		barCategoryGap: "10%",
		barGap: 4,
		barSize: undefined,
		baseValue: undefined,
		className: undefined,
		maxBarSize: undefined,
		reverseStackOrder: false,
		stackOffset: "none",
		syncId: undefined,
		syncMethod: "index",
	}
}

function makeZIndexState(): ZIndexState {
	const zIndexMap: ZIndexState["zIndexMap"] = {}
	for (const current of Object.values(DefaultZIndexes)) {
		zIndexMap[current] = { consumers: 0, element: undefined, panoramaElement: undefined }
	}
	return { zIndexMap }
}

/** Identity helper: selectors still call this while ChartState is being deleted. */
export function readChartState(store: ChartState): ChartState {
	return store
}

/** Returns a fresh ChartState per call. Always use this to seed createStore — never share an instance. */
export function createInitialChartState(overrides?: Partial<ChartState>): ChartState {
	const layout = overrides?.layout ?? makeLayoutState()
	return {
		animation: { animationDuration: 1500, animationEasing: "ease", isAnimationActive: "auto" },
		brush: makeBrushState(),
		cartesianAxes: { xAxis: {}, yAxis: {}, zAxis: {} },
		chartData: makeChartDataState(),
		chartSize: { height: layout.height, width: layout.width },
		errorBars: {},
		eventSettings: makeEventSettingsState(),
		graphicalItems: {},
		layout,
		legend: makeLegendState(),
		margin: { bottom: 5, left: 5, right: 5, top: 5 },
		polarAxes: { angleAxis: {}, radiusAxis: {} },
		polarOptions: null,
		referenceElements: makeReferenceElementsState(),
		renderedTicks: createInitialRenderedTicksState(),
		rootProps: makeRootPropsState(),
		tooltip: makeTooltipState(),
		zIndex: makeZIndexState(),
		...overrides,
		options: ownChartOptions(overrides?.options ?? makeOptionsState()),
	}
}

/*
 * Chart modules pass module-level options (and tooltip event type lists). Solid's store maps
 * every raw object it wraps to its target in one global WeakMap, so a shared constant would
 * keep the last store that wrapped it alive and hand the next chart that store's proxy.
 */
function ownChartOptions(options: ChartOptions): ChartOptions {
	const types = options.validateTooltipEventTypes
	return types == null ? { ...options } : { ...options, validateTooltipEventTypes: [...types] }
}
