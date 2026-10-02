/* eslint-disable import/no-cycle */
import { createContext, createMemo, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { CartesianViewBoxRequired, ChartOffsetInternal } from "../../util/types"
import type { XAxisSettings, YAxisSettings } from "../cartesianAxisSlice"
import type { ChartState } from "../store"
import {
	selectChartOffsetInternal,
	selectChartViewBox,
	selectAxisViewBox,
} from "../selectors/selectChartOffsetInternal"
import { selectAllXAxes, selectAllYAxes } from "../selectors/selectAllAxes"
import { useChartStore } from "../RechartsStoreContext"

/** Provider-level memoized selector results shared across all chart consumers. */
export type ChartSelectorsValue = {
	allXAxes: Accessor<ReadonlyArray<XAxisSettings>>
	allYAxes: Accessor<ReadonlyArray<YAxisSettings>>
	axisViewBox: Accessor<CartesianViewBoxRequired>
	chartViewBox: Accessor<CartesianViewBoxRequired>
	offsetInternal: Accessor<ChartOffsetInternal>
}

const ChartSelectorsContext = createContext<ChartSelectorsValue | null>(null)

/**
 * Creates provider-level memos for arg-free selectors.
 * Call once per chart provider; memos share across all descendant consumers.
 */
export function createChartSelectors(store: ChartState): ChartSelectorsValue {
	const allXAxes = createMemo(() => selectAllXAxes(store))
	const allYAxes = createMemo(() => selectAllYAxes(store))
	const axisViewBox = createMemo(() => selectAxisViewBox(store))
	const chartViewBox = createMemo(() => selectChartViewBox(store))
	const offsetInternal = createMemo(() => selectChartOffsetInternal(store))
	return { allXAxes, allYAxes, axisViewBox, chartViewBox, offsetInternal }
}

export const ChartSelectorsProvider = ChartSelectorsContext

export function useChartSelectors(): ChartSelectorsValue | null {
	return useContext(ChartSelectorsContext)
}

/** Returns the current chart offset. Uses shared provider memo when available; falls back to per-call selector. */
export const useChartOffsetInternal = (): ChartOffsetInternal | undefined => {
	const selectors = useContext(ChartSelectorsContext)
	if (selectors) return selectors.offsetInternal()
	const ctx = useChartStore()
	return ctx ? selectChartOffsetInternal(ctx.store) : undefined
}

/** Returns all registered X axes. Uses shared provider memo when available; falls back to per-call selector. */
export const useAllXAxes = (): ReadonlyArray<XAxisSettings> | undefined => {
	const selectors = useContext(ChartSelectorsContext)
	if (selectors) return selectors.allXAxes()
	const ctx = useChartStore()
	return ctx ? selectAllXAxes(ctx.store) : undefined
}

/** Returns all registered Y axes. Uses shared provider memo when available; falls back to per-call selector. */
export const useAllYAxes = (): ReadonlyArray<YAxisSettings> | undefined => {
	const selectors = useContext(ChartSelectorsContext)
	if (selectors) return selectors.allYAxes()
	const ctx = useChartStore()
	return ctx ? selectAllYAxes(ctx.store) : undefined
}

/** Returns the axis viewBox. Uses shared provider memo when available; falls back to per-call selector. */
export const useAxisViewBox = (): CartesianViewBoxRequired | undefined => {
	const selectors = useContext(ChartSelectorsContext)
	if (selectors) return selectors.axisViewBox()
	const ctx = useChartStore()
	return ctx ? selectAxisViewBox(ctx.store) : undefined
}

/** Returns the chart viewBox. Uses shared provider memo when available; falls back to per-call selector. */
export const useChartViewBox = (): CartesianViewBoxRequired | undefined => {
	const selectors = useContext(ChartSelectorsContext)
	if (selectors) return selectors.chartViewBox()
	const ctx = useChartStore()
	return ctx ? selectChartViewBox(ctx.store) : undefined
}
