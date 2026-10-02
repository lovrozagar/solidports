/**
 * T6 — behaviour-invariance locks for the selectors that will be wrapped in
 * createMemo hooks during Steps 1-3.
 *
 * These tests pass TODAY (GREEN) and must stay GREEN after every step.
 * They prove the pure-function contract is unchanged — only call sites change.
 */
import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../../src/state/store"
import type { ChartState } from "../../../src/state/store"
import {
	selectChartOffsetInternal,
	selectChartViewBox,
	selectAxisViewBox,
} from "../../../src/state/selectors/selectChartOffsetInternal"
import { selectAllXAxes, selectAllYAxes } from "../../../src/state/selectors/selectAllAxes"
import {
	selectXAxisSettingsNoDefaults,
	selectYAxisSettingsNoDefaults,
} from "../../../src/state/selectors/axisSelectors"
import { createActions } from "../../../src/state/actions"

/* ── fixed state fixture ─────────────────────────────────────────── */

function makeState(): ChartState {
	const [store, setStore] = createRechartsStore()
	const actions = createActions(store, setStore)

	actions.setChartSize({ height: 600, width: 800 })
	flush()
	actions.setMargin({ bottom: 10, left: 20, right: 20, top: 10 })
	flush()

	actions.addYAxis({
		allowDataOverflow: false,
		allowDecimals: true,
		allowDuplicatedCategory: true,
		angle: 0,
		dataKey: undefined,
		domain: undefined,
		hide: false,
		id: 0,
		includeHidden: false,
		interval: "preserveStartEnd",
		minTickGap: 5,
		mirror: false,
		name: undefined,
		orientation: "left",
		padding: {},
		reversed: false,
		scale: "auto",
		tick: true,
		tickCount: undefined,
		tickFormatter: undefined,
		ticks: undefined,
		type: "number",
		unit: undefined,
		width: 60,
	})

	flush()

	actions.addXAxis({
		allowDataOverflow: false,
		allowDecimals: true,
		allowDuplicatedCategory: true,
		angle: 0,
		dataKey: undefined,
		domain: undefined,
		height: 30,
		hide: false,
		id: 0,
		includeHidden: false,
		interval: "preserveStartEnd",
		minTickGap: 5,
		mirror: false,
		name: undefined,
		orientation: "bottom",
		padding: {},
		reversed: false,
		scale: "auto",
		tick: true,
		tickCount: undefined,
		tickFormatter: undefined,
		ticks: undefined,
		type: "number",
		unit: undefined,
	})

	flush()

	return store
}

/* ── selectChartOffsetInternal ───────────────────────────────────── */

describe("selectChartOffsetInternal — behaviour invariance", () => {
	it("returns correct left offset: margin.left + yAxis.width", () => {
		const state = makeState()
		const offset = selectChartOffsetInternal(state)
		/* margin.left=20 + left-oriented yAxis.width=60 = 80 */
		expect(offset.left).toBe(80)
	})

	it("returns correct bottom offset: margin.bottom + xAxis.height", () => {
		const state = makeState()
		const offset = selectChartOffsetInternal(state)
		/* margin.bottom=10 + bottom-oriented xAxis.height=30 = 40 */
		expect(offset.bottom).toBe(40)
	})

	it("returns correct width: chartWidth - left - right", () => {
		const state = makeState()
		const offset = selectChartOffsetInternal(state)
		/* chartWidth=800, left=80, right=margin.right=20 → 700 */
		expect(offset.width).toBe(700)
	})

	it("returns correct height: chartHeight - top - bottom", () => {
		const state = makeState()
		const offset = selectChartOffsetInternal(state)
		/* chartHeight=600, top=margin.top=10, bottom=40 → 550 */
		expect(offset.height).toBe(550)
	})

	it("never returns negative width or height", () => {
		const [store] = createRechartsStore()
		/* no size set — stays 0×0 */
		const offset = selectChartOffsetInternal(store)
		expect(offset.width).toBeGreaterThanOrEqual(0)
		expect(offset.height).toBeGreaterThanOrEqual(0)
	})

	it("structural output matches expected shape", () => {
		const state = makeState()
		const offset = selectChartOffsetInternal(state)
		expect(offset).toMatchObject({
			bottom: 40,
			height: 550,
			left: 80,
			right: 20,
			top: 10,
			width: 700,
		})
	})

	it("two calls on same state return structurally equal values", () => {
		const state = makeState()
		const a = selectChartOffsetInternal(state)
		const b = selectChartOffsetInternal(state)
		expect(a).toEqual(b)
	})
})

/* ── selectChartViewBox ──────────────────────────────────────────── */

describe("selectChartViewBox — behaviour invariance", () => {
	it("viewBox x equals offset.left", () => {
		const state = makeState()
		const vb = selectChartViewBox(state)
		expect(vb.x).toBe(80)
	})

	it("viewBox y equals offset.top", () => {
		const state = makeState()
		const vb = selectChartViewBox(state)
		expect(vb.y).toBe(10)
	})

	it("viewBox width/height match offset width/height", () => {
		const state = makeState()
		const offset = selectChartOffsetInternal(state)
		const vb = selectChartViewBox(state)
		expect(vb.width).toBe(offset.width)
		expect(vb.height).toBe(offset.height)
	})

	it("two calls on same state return structurally equal values", () => {
		const state = makeState()
		expect(selectChartViewBox(state)).toEqual(selectChartViewBox(state))
	})
})

/* ── selectAxisViewBox ───────────────────────────────────────────── */

describe("selectAxisViewBox — behaviour invariance", () => {
	it("axis viewBox origin is always 0,0", () => {
		const state = makeState()
		const vb = selectAxisViewBox(state)
		expect(vb.x).toBe(0)
		expect(vb.y).toBe(0)
	})

	it("axis viewBox width/height equal raw chart dimensions", () => {
		const state = makeState()
		const vb = selectAxisViewBox(state)
		expect(vb.width).toBe(800)
		expect(vb.height).toBe(600)
	})

	it("two calls on same state return structurally equal values", () => {
		const state = makeState()
		expect(selectAxisViewBox(state)).toEqual(selectAxisViewBox(state))
	})
})

/* ── selectAllXAxes ─────────────────────────────────────────────── */

describe("selectAllXAxes — behaviour invariance", () => {
	it("returns empty array from initial state", () => {
		const [store] = createRechartsStore()
		expect(selectAllXAxes(store)).toEqual([])
	})

	it("returns all added x axes", () => {
		const state = makeState()
		const axes = selectAllXAxes(state)
		expect(axes).toHaveLength(1)
		expect(axes[0]?.id).toBe(0)
	})

	it("adding a second x axis increases count", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.addXAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
		})
		flush()
		actions.addXAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 20,
			hide: false,
			id: 1,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "top",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
		})
		flush()
		expect(selectAllXAxes(store)).toHaveLength(2)
	})

	it("two calls on same state return structurally equal arrays", () => {
		const state = makeState()
		expect(selectAllXAxes(state)).toEqual(selectAllXAxes(state))
	})

	it("does not include y axes", () => {
		const state = makeState()
		const axes = selectAllXAxes(state)
		for (const axis of axes) {
			expect("orientation" in axis && (axis.orientation === "top" || axis.orientation === "bottom")).toBe(true)
		}
	})
})

/* ── selectAllYAxes ─────────────────────────────────────────────── */

describe("selectAllYAxes — behaviour invariance", () => {
	it("returns empty array from initial state", () => {
		const [store] = createRechartsStore()
		expect(selectAllYAxes(store)).toEqual([])
	})

	it("returns all added y axes", () => {
		const state = makeState()
		const axes = selectAllYAxes(state)
		expect(axes).toHaveLength(1)
		expect(axes[0]?.id).toBe(0)
	})

	it("adding a second y axis increases count", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.addYAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "left",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
			width: 60,
		})
		flush()
		actions.addYAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 1,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "right",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
			width: 40,
		})
		flush()
		expect(selectAllYAxes(store)).toHaveLength(2)
	})

	it("two calls on same state return structurally equal arrays", () => {
		const state = makeState()
		expect(selectAllYAxes(state)).toEqual(selectAllYAxes(state))
	})

	it("does not include x axes", () => {
		const state = makeState()
		const axes = selectAllYAxes(state)
		for (const axis of axes) {
			expect("orientation" in axis && (axis.orientation === "left" || axis.orientation === "right")).toBe(true)
		}
	})
})

/* ── selectXAxisSettingsNoDefaults ───────────────────────────────── */

describe("selectXAxisSettingsNoDefaults — behaviour invariance", () => {
	it("returns undefined for missing axisId", () => {
		const [store] = createRechartsStore()
		expect(selectXAxisSettingsNoDefaults(store, 99)).toBeUndefined()
	})

	it("returns the axis for a registered axisId", () => {
		const state = makeState()
		const axis = selectXAxisSettingsNoDefaults(state, 0)
		expect(axis).not.toBeUndefined()
		expect(axis?.id).toBe(0)
		expect(axis?.orientation).toBe("bottom")
	})

	it("axisId=1 is independent from axisId=0", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const xAxis0 = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd" as const,
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom" as const,
			padding: {},
			reversed: false,
			scale: "auto" as const,
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number" as const,
			unit: undefined,
		}
		actions.addXAxis(xAxis0)
		flush()
		actions.addXAxis({ ...xAxis0, height: 20, id: 1, orientation: "top" })
		flush()

		expect(selectXAxisSettingsNoDefaults(store, 0)?.orientation).toBe("bottom")
		expect(selectXAxisSettingsNoDefaults(store, 1)?.orientation).toBe("top")
	})

	it("registering a different axisId does not affect existing axisId result", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const base = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd" as const,
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom" as const,
			padding: {},
			reversed: false,
			scale: "auto" as const,
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number" as const,
			unit: undefined,
		}
		actions.addXAxis(base)
		flush()
		const before = selectXAxisSettingsNoDefaults(store, 0)

		actions.addXAxis({ ...base, id: 1, orientation: "top" })
		flush()
		const after = selectXAxisSettingsNoDefaults(store, 0)

		expect(after).toEqual(before)
	})

	it("two calls on same state and axisId return structurally equal values", () => {
		const state = makeState()
		expect(selectXAxisSettingsNoDefaults(state, 0)).toEqual(
			selectXAxisSettingsNoDefaults(state, 0),
		)
	})
})

/* ── selectYAxisSettingsNoDefaults ───────────────────────────────── */

describe("selectYAxisSettingsNoDefaults — behaviour invariance", () => {
	it("returns undefined for missing axisId", () => {
		const [store] = createRechartsStore()
		expect(selectYAxisSettingsNoDefaults(store, 99)).toBeUndefined()
	})

	it("returns the axis for a registered axisId", () => {
		const state = makeState()
		const axis = selectYAxisSettingsNoDefaults(state, 0)
		expect(axis).not.toBeUndefined()
		expect(axis?.id).toBe(0)
		expect(axis?.orientation).toBe("left")
	})

	it("axisId=1 is independent from axisId=0", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const base = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd" as const,
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "left" as const,
			padding: {},
			reversed: false,
			scale: "auto" as const,
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number" as const,
			unit: undefined,
			width: 60,
		}
		actions.addYAxis(base)
		flush()
		actions.addYAxis({ ...base, id: 1, orientation: "right", width: 40 })
		flush()

		expect(selectYAxisSettingsNoDefaults(store, 0)?.orientation).toBe("left")
		expect(selectYAxisSettingsNoDefaults(store, 1)?.orientation).toBe("right")
	})

	it("registering a different axisId does not affect existing axisId result", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const base = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd" as const,
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "left" as const,
			padding: {},
			reversed: false,
			scale: "auto" as const,
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number" as const,
			unit: undefined,
			width: 60,
		}
		actions.addYAxis(base)
		flush()
		const before = selectYAxisSettingsNoDefaults(store, 0)

		actions.addYAxis({ ...base, id: 1, orientation: "right" })
		flush()
		const after = selectYAxisSettingsNoDefaults(store, 0)

		expect(after).toEqual(before)
	})

	it("two calls on same state and axisId return structurally equal values", () => {
		const state = makeState()
		expect(selectYAxisSettingsNoDefaults(state, 0)).toEqual(
			selectYAxisSettingsNoDefaults(state, 0),
		)
	})
})
