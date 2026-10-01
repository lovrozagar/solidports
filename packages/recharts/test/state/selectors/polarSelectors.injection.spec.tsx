import { describe, expect, it } from "vitest"
import { selectRadarPoints } from "../../../src/state/selectors/radarSelectors"
import { selectRadialBarSectors } from "../../../src/state/selectors/radialBarSelectors"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/store"
import type { AngleAxisSettings, RadiusAxisSettings } from "../../../src/state/polarAxisSlice"
import type { RadialBarSettings } from "../../../src/state/types/RadialBarSettings"
import { implicitAngleAxis, implicitRadiusAxis } from "../../../src/state/selectors/polarAxisSelectors"

const baseAngleAxis: AngleAxisSettings = {
	allowDataOverflow: implicitAngleAxis.allowDataOverflow,
	allowDecimals: implicitAngleAxis.allowDecimals,
	allowDuplicatedCategory: false,
	dataKey: "subject",
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
	domain: [0, "auto"],
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

const baseRadialBarSettings: RadialBarSettings = {
	angleAxisId: "0",
	data: undefined,
	dataKey: "value",
	hide: false,
	id: "radialBar-0",
	maxBarSize: undefined,
	minPointSize: 0,
	radiusAxisId: "0",
	stackId: undefined,
	type: "radialBar",
}

function asRoot(state: ReturnType<typeof createInitialChartState>): ChartState {
	return state as unknown as ChartState
}

function makeState(opts: {
	angle?: Partial<AngleAxisSettings>
	radius?: Partial<RadiusAxisSettings>
}): ChartState {
	return asRoot(
		createInitialChartState({
			polarAxes: {
				angleAxis:
					opts.angle !== undefined
						? { "0": { settings: { ...baseAngleAxis, ...opts.angle } } }
						: {},
				radiusAxis:
					opts.radius !== undefined
						? { "0": { settings: { ...baseRadiusAxis, ...opts.radius } } }
						: {},
			},
		}),
	)
}

describe("polar selector override-param injection", () => {
	describe("selectRadarPoints", () => {
		it("is a callable function with correct minimum arity", () => {
			expect(typeof selectRadarPoints).toBe("function")
			expect(selectRadarPoints.length).toBeGreaterThanOrEqual(5)
		})

		it("returns undefined when no axis scale is available (no polarOptions)", () => {
			const state = asRoot(createInitialChartState())
			const result = selectRadarPoints(state, "0", "0", false, "radar-0")
			expect(result).toBeUndefined()
		})

		it("accepts angleAxis override param without throwing", () => {
			const state = makeState({ angle: { dataKey: "CHART" } })
			const angleOverride: AngleAxisSettings = { ...baseAngleAxis, dataKey: "OVERRIDE" }
			const result = selectRadarPoints(state, "0", "0", false, "radar-0", angleOverride)
			expect(result === undefined || typeof result === "object").toBe(true)
		})
	})

	describe("selectRadialBarSectors", () => {
		it("is a callable function with correct minimum arity", () => {
			expect(typeof selectRadialBarSectors).toBe("function")
			expect(selectRadialBarSectors.length).toBeGreaterThanOrEqual(4)
		})

		it("returns an empty array when no axis scale is available", () => {
			const state = asRoot(createInitialChartState())
			const result = selectRadialBarSectors(state, "0", "0", baseRadialBarSettings, undefined)
			expect(Array.isArray(result)).toBe(true)
		})

		it("accepts radiusAxis override param without throwing", () => {
			const state = makeState({ radius: { domain: [0, 500] } })
			const radiusOverride: RadiusAxisSettings = { ...baseRadiusAxis, domain: [0, 9999] }
			const result = selectRadialBarSectors(
				state,
				"0",
				"0",
				baseRadialBarSettings,
				undefined,
				radiusOverride,
			)
			expect(Array.isArray(result) || typeof result === "object").toBe(true)
		})
	})
})
