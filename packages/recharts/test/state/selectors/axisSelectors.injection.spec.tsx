import { describe, expect, it } from "vitest"
import {
	selectXAxisSettingsNoDefaults,
	selectYAxisSettingsNoDefaults,
	selectZAxisSettings,
} from "../../../src/state/selectors/axisSelectors"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/store"
import type { XAxisSettings, YAxisSettings, ZAxisSettings } from "../../../src/state/cartesianAxisSlice"

const baseXAxis: XAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: undefined,
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

const baseZAxis: ZAxisSettings = {
	allowDataOverflow: false,
	allowDuplicatedCategory: false,
	dataKey: undefined,
	domain: [0, "auto"],
	id: "0",
	includeHidden: false,
	name: "",
	range: [64, 64],
	reversed: false,
	scale: "auto",
	type: "number",
	unit: "",
}

function asRoot(state: ReturnType<typeof createInitialChartState>): ChartState {
	return state as unknown as ChartState
}

function makeState(opts: {
	xDataKey?: string
	yDataKey?: string
	zRange?: [number, number]
}): ChartState {
	return asRoot(
		createInitialChartState({
			cartesianAxes: {
				xAxis:
					opts.xDataKey !== undefined
						? { "0": { settings: { ...baseXAxis, dataKey: opts.xDataKey } } }
						: {},
				yAxis:
					opts.yDataKey !== undefined
						? { "0": { settings: { ...baseYAxis, dataKey: opts.yDataKey } } }
						: {},
				zAxis:
					opts.zRange !== undefined
						? { "0": { settings: { ...baseZAxis, range: opts.zRange } } }
						: {},
			},
		}),
	)
}

describe("axisSelectors override-param injection", () => {
	describe("selectXAxisSettingsNoDefaults", () => {
		it("reads ChartState cartesianAxes", () => {
			const state = makeState({ xDataKey: "X-CHART" })
			expect(selectXAxisSettingsNoDefaults(state, "0")?.dataKey).toBe("X-CHART")
		})

		it("uses override when provided", () => {
			const state = makeState({ xDataKey: "X-CHART" })
			const override: XAxisSettings = { ...baseXAxis, dataKey: "X-OVERRIDE" }
			expect(selectXAxisSettingsNoDefaults(state, "0", override)?.dataKey).toBe("X-OVERRIDE")
		})
	})

	describe("selectYAxisSettingsNoDefaults", () => {
		it("reads ChartState cartesianAxes", () => {
			const state = makeState({ yDataKey: "Y-CHART" })
			expect(selectYAxisSettingsNoDefaults(state, "0")?.dataKey).toBe("Y-CHART")
		})

		it("uses override when provided", () => {
			const state = makeState({ yDataKey: "Y-CHART" })
			const override: YAxisSettings = { ...baseYAxis, dataKey: "Y-OVERRIDE" }
			expect(selectYAxisSettingsNoDefaults(state, "0", override)?.dataKey).toBe("Y-OVERRIDE")
		})
	})

	describe("selectZAxisSettings", () => {
		it("reads ChartState cartesianAxes", () => {
			const state = makeState({ zRange: [10, 200] })
			expect(selectZAxisSettings(state, "0").range).toEqual([10, 200])
		})

		it("falls back to implicit defaults when the axis is absent", () => {
			const state = asRoot(createInitialChartState())
			expect(selectZAxisSettings(state, "0").range).toEqual([64, 64])
		})

		it("uses override when provided", () => {
			const state = makeState({ zRange: [10, 200] })
			const override: ZAxisSettings = { ...baseZAxis, range: [1, 999] }
			expect(selectZAxisSettings(state, "0", override).range).toEqual([1, 999])
		})
	})
})
