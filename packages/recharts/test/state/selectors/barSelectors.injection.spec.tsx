import { describe, expect, it } from "vitest"
import { selectBarRectangles } from "../../../src/state/selectors/barSelectors"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/store"
import type { XAxisSettings, YAxisSettings } from "../../../src/state/cartesianAxisSlice"
import type { BarSettings } from "../../../src/state/types/BarSettings"

const baseXAxis: XAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: "name",
	domain: undefined,
	height: 30,
	hide: false,
	id: "0",
	includeHidden: false,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: false,
	name: undefined,
	orientation: "bottom",
	padding: { left: 0, right: 0 },
	reversed: false,
	scale: "auto",
	tick: true,
	tickCount: 5,
	tickFormatter: undefined,
	ticks: undefined,
	type: "category",
	unit: undefined,
}

const baseYAxis: YAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: undefined,
	domain: [0, "auto"],
	hide: false,
	id: "0",
	includeHidden: false,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: false,
	name: undefined,
	orientation: "left",
	padding: { bottom: 0, top: 0 },
	reversed: false,
	scale: "auto",
	tick: true,
	tickCount: 5,
	tickFormatter: undefined,
	ticks: undefined,
	type: "number",
	unit: undefined,
	width: 60,
}

const baseBarSettings: BarSettings = {
	data: undefined,
	dataKey: "value",
	hide: false,
	id: "bar-0",
	isPanorama: false,
	maxBarSize: undefined,
	minPointSize: 0,
	stackId: undefined,
	type: "bar",
	xAxisId: "0",
	yAxisId: "0",
	zAxisId: "0",
}

function makeBarState(): ChartState {
	return createInitialChartState({
		cartesianAxes: {
			xAxis: { "0": { settings: { ...baseXAxis } } },
			yAxis: { "0": { settings: { ...baseYAxis } } },
			zAxis: {},
		},
		graphicalItems: {
			"bar-0": { settings: baseBarSettings, type: "bar" },
		},
	}) as unknown as ChartState
}

describe("barSelectors override-param injection", () => {
	it("selectBarRectangles without overrides does not throw", () => {
		const state = makeBarState()
		const result = selectBarRectangles(state, "bar-0", false, undefined)
		expect(result === undefined || Array.isArray(result)).toBe(true)
	})

	it("selectBarRectangles with xAxis and yAxis overrides does not throw", () => {
		const state = makeBarState()
		const xOverride: XAxisSettings = { ...baseXAxis, domain: [0, 9999] }
		const yOverride: YAxisSettings = { ...baseYAxis, domain: [0, 9999] }
		const resultWithOverride = selectBarRectangles(
			state,
			"bar-0",
			false,
			undefined,
			xOverride,
			yOverride,
		)
		expect(resultWithOverride === undefined || Array.isArray(resultWithOverride)).toBe(true)
	})

	it("override on xAxis only does not throw", () => {
		const state = makeBarState()
		const xOverride: XAxisSettings = { ...baseXAxis, domain: [0, 500] }
		const resultMixed = selectBarRectangles(state, "bar-0", false, undefined, xOverride, undefined)
		expect(resultMixed === undefined || Array.isArray(resultMixed)).toBe(true)
	})
})
