import { describe, expect, it } from "vitest"
import {
	selectAngleAxis,
	selectRadiusAxis,
	implicitAngleAxis,
	implicitRadiusAxis,
} from "../../../src/state/selectors/polarAxisSelectors"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/store"
import type { AngleAxisSettings, RadiusAxisSettings } from "../../../src/state/polarAxisSlice"

const baseAngleAxis: AngleAxisSettings = {
	allowDataOverflow: implicitAngleAxis.allowDataOverflow,
	allowDecimals: implicitAngleAxis.allowDecimals,
	allowDuplicatedCategory: false,
	dataKey: undefined,
	domain: undefined,
	id: "0",
	includeHidden: false,
	name: undefined,
	reversed: implicitAngleAxis.reversed,
	scale: implicitAngleAxis.scale,
	tick: implicitAngleAxis.tick,
	tickCount: undefined,
	ticks: undefined,
	type: "category",
	unit: undefined,
}

const baseRadiusAxis: RadiusAxisSettings = {
	allowDataOverflow: implicitRadiusAxis.allowDataOverflow,
	allowDecimals: implicitRadiusAxis.allowDecimals,
	allowDuplicatedCategory: implicitRadiusAxis.allowDuplicatedCategory,
	dataKey: undefined,
	domain: undefined,
	id: "0",
	includeHidden: implicitRadiusAxis.includeHidden,
	name: undefined,
	reversed: implicitRadiusAxis.reversed,
	scale: implicitRadiusAxis.scale,
	tick: implicitRadiusAxis.tick,
	tickCount: implicitRadiusAxis.tickCount,
	ticks: undefined,
	type: "number",
	unit: undefined,
}

function asRoot(state: ReturnType<typeof createInitialChartState>): ChartState {
	return state as unknown as ChartState
}

function makeState(opts: { angleDataKey?: string; radiusDataKey?: string }): ChartState {
	return asRoot(
		createInitialChartState({
			polarAxes: {
				angleAxis:
					opts.angleDataKey !== undefined
						? { "0": { settings: { ...baseAngleAxis, dataKey: opts.angleDataKey } } }
						: {},
				radiusAxis:
					opts.radiusDataKey !== undefined
						? { "0": { settings: { ...baseRadiusAxis, dataKey: opts.radiusDataKey } } }
						: {},
			},
		}),
	)
}

describe("polarAxisSelectors override-param injection", () => {
	describe("selectAngleAxis", () => {
		it("reads ChartState polarAxes", () => {
			const state = makeState({ angleDataKey: "ANGLE-CHART" })
			expect(selectAngleAxis(state, "0").dataKey).toBe("ANGLE-CHART")
		})

		it("falls back to implicit defaults when the axis is absent", () => {
			const state = asRoot(createInitialChartState())
			expect(selectAngleAxis(state, "0").dataKey).toBeUndefined()
		})

		it("uses override when provided", () => {
			const state = makeState({ angleDataKey: "ANGLE-CHART" })
			const override: AngleAxisSettings = { ...baseAngleAxis, dataKey: "ANGLE-OVERRIDE" }
			expect(selectAngleAxis(state, "0", override).dataKey).toBe("ANGLE-OVERRIDE")
		})
	})

	describe("selectRadiusAxis", () => {
		it("reads ChartState polarAxes", () => {
			const state = makeState({ radiusDataKey: "RADIUS-CHART" })
			expect(selectRadiusAxis(state, "0").dataKey).toBe("RADIUS-CHART")
		})

		it("uses override when provided", () => {
			const state = makeState({ radiusDataKey: "RADIUS-CHART" })
			const override: RadiusAxisSettings = { ...baseRadiusAxis, dataKey: "RADIUS-OVERRIDE" }
			expect(selectRadiusAxis(state, "0", override).dataKey).toBe("RADIUS-OVERRIDE")
		})
	})
})
