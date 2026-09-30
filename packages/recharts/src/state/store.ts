/* eslint-disable import/no-cycle */
import { createStore } from "solid-js/store"
import type { ChartState } from "./_solid/chartState"
import { createInitialChartState } from "./_solid/chartState"
import type { ChartDataState } from "./chartDataSlice"
import { initialChartDataState } from "./chartDataSlice"
import type { ErrorBarsState } from "./errorBarSlice"
import { initialErrorBarState } from "./errorBarSlice"
import type { EventSettingsState } from "./eventSettingsSlice"
import { initialEventSettingsState } from "./eventSettingsSlice"
import type { GraphicalItemsState } from "./graphicalItemsSlice"
import type { AxisMapState } from "./cartesianAxisSlice"
import type { PolarAxisState } from "./polarAxisSlice"
import type { LegendState } from "./legendSlice"
import type { BrushSettings } from "./brushSlice"
import type { ChartLayoutState } from "./layoutSlice"
import { initialLayoutState } from "./layoutSlice"
import type { ChartOptions } from "./optionsSlice"
import { initialOptionsState } from "./optionsSlice"
import type { PolarChartState } from "./polarOptionsSlice"
import { initialPolarOptionsState } from "./polarOptionsSlice"
import type { ReferenceElementState } from "./referenceElementsSlice"
import { initialReferenceElementsState } from "./referenceElementsSlice"
import type { UpdatableChartOptions } from "./rootPropsSlice"
import { initialRootPropsState } from "./rootPropsSlice"
import type { TooltipState } from "./tooltipSlice"
import { noInteraction } from "./tooltipSlice"
import type { ZIndexState } from "./zIndexSlice"
import { initialZIndexState } from "./zIndexSlice"

/* Post-Phase-7 RechartsRootState: holds the non-migrated slices.
   Migrated subtrees live in _solid (ChartState). Selectors prefer _solid;
   legacy fields are compat shims — components dual-write so tests reading
   legacy slice shapes keep working.
   `graphicalItems`, `tooltip`, `cartesianAxis`, `polarAxis`, `legend`, and
   `brush` are compat shims. */
export type RechartsRootState = {
	_solid: ChartState
	brush: BrushSettings
	cartesianAxis: AxisMapState
	chartData: ChartDataState
	errorBars: ErrorBarsState
	eventSettings: EventSettingsState
	graphicalItems: GraphicalItemsState
	layout: ChartLayoutState
	legend: LegendState
	options: ChartOptions
	polarAxis: PolarAxisState
	polarOptions: PolarChartState
	referenceElements: ReferenceElementState
	rootProps: UpdatableChartOptions
	tooltip: TooltipState
	zIndex: ZIndexState
}

/* Deep-clone helper that preserves function values (structuredClone throws on functions).
   createStore mutates its input via setStore — if multiple charts share a slice
   reference (the module-level `initial*State` constants), one chart's dispatch leaks
   into every other chart sharing the same object. Symptom: cross-instance contamination
   — Legend payload accumulates, graphical items duplicate. Each store needs its own
   isolated state graph. */
function deepCloneState<T>(value: T): T {
	if (value === null || typeof value !== "object") {
		return value
	}
	if (Array.isArray(value)) {
		return value.map((v) => deepCloneState(v)) as unknown as T
	}
	const out: Record<string, unknown> = {}
	for (const key of Object.keys(value as Record<string, unknown>)) {
		out[key] = deepCloneState((value as Record<string, unknown>)[key])
	}
	return out as T
}

export function createInitialState(preloadedState?: Partial<RechartsRootState>): RechartsRootState {
	return {
		_solid: preloadedState?._solid ?? createInitialChartState(),
		brush: { height: 0, padding: { bottom: 0, left: 0, right: 0, top: 0 }, width: 0, x: 0, y: 0 },
		cartesianAxis: { xAxis: {}, yAxis: {}, zAxis: {} },
		chartData: deepCloneState(initialChartDataState),
		errorBars: deepCloneState(initialErrorBarState),
		eventSettings: deepCloneState(initialEventSettingsState),
		graphicalItems: { cartesianItems: [], polarItems: [] },
		layout: deepCloneState(initialLayoutState),
		legend: {
			payload: [],
			settings: { align: "center", itemSorter: "value", layout: "horizontal", verticalAlign: "middle" },
			size: { height: 0, width: 0 },
		},
		options: deepCloneState(initialOptionsState),
		polarAxis: { angleAxis: {}, radiusAxis: {} },
		polarOptions: deepCloneState(initialPolarOptionsState),
		referenceElements: deepCloneState(initialReferenceElementsState),
		rootProps: deepCloneState(initialRootPropsState),
		tooltip: {
			axisInteraction: { click: { ...noInteraction }, hover: { ...noInteraction } },
			itemInteraction: { click: { ...noInteraction }, hover: { ...noInteraction } },
			keyboardInteraction: { ...noInteraction },
			settings: { active: false, axisId: 0, defaultIndex: undefined, shared: undefined, trigger: "hover" },
			syncInteraction: { ...noInteraction, label: undefined, sourceViewBox: undefined },
			tooltipItemPayloads: [],
		},
		zIndex: deepCloneState(initialZIndexState),
		...preloadedState,
	}
}

/* Tuple-iterable + Redux-shim hybrid so 1:1 ported tests can keep
   `createRechartsStore().getState()` / `.dispatch(action)` calls (upstream
   Redux idiom) alongside the Solid-native `const [store, setStore] = ...`
   destructure that production code uses. The two APIs alias the same
   underlying store; no separate state. */
type StoreTuple<T> = [T, (...args: unknown[]) => void]
type ReduxShim<T> = {
	getState: () => T
	dispatch: (action: (setStore: unknown, store: T) => void) => void
}
export type RechartsStoreHandle = StoreTuple<RechartsRootState> & ReduxShim<RechartsRootState>

export function createRechartsStore(
	preloadedState?: Partial<RechartsRootState>,
): RechartsStoreHandle {
	const [store, setStore] = createStore<RechartsRootState>(createInitialState(preloadedState))
	const result = [store, setStore] as unknown as RechartsStoreHandle
	result.getState = () => store
	/* Action thunk signature is `(setStore, store)` where store is the raw Solid
	   store proxy — selectors read off the proxy directly (fine-grained reactivity).
	   Pass the proxy, never a getter; downstream selectors expect plain state. */
	result.dispatch = (action) => {
		action(setStore, store)
	}
	return result
}
