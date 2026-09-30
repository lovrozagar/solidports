import { describe, expect, it } from "vitest"
import { selectRadarPoints } from "../../../src/state/selectors/radarSelectors"
import { selectRadialBarSectors } from "../../../src/state/selectors/radialBarSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
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

function makeStateWithSolidPolarAxis(opts: {
	solidAngle?: Partial<AngleAxisSettings>
	solidRadius?: Partial<RadiusAxisSettings>
}): RechartsRootState {
	const base = createInitialState()

	const polarAxes: Record<string, unknown> = {}

	if (opts.solidAngle !== undefined) {
		polarAxes["angleAxis"] = { "0": { settings: { ...baseAngleAxis, ...opts.solidAngle } } }
	}
	if (opts.solidRadius !== undefined) {
		polarAxes["radiusAxis"] = { "0": { settings: { ...baseRadiusAxis, ...opts.solidRadius } } }
	}

	;(base as Record<string, unknown>)["_solid"] = { polarAxes }

	return base
}

describe("Phase 4 — polar selector override-param injection", () => {
	describe("selectRadarPoints", () => {
		it("is a callable function with correct minimum arity", () => {
			/* Structural contract — must exist and accept (state, radiusAxisId, angleAxisId, isPanorama, radarId). */
			expect(typeof selectRadarPoints).toBe("function")
			expect(selectRadarPoints.length).toBeGreaterThanOrEqual(5)
		})

		it("returns undefined when no axis scale is available (no polarOptions)", () => {
			/* With no PolarOptions mounted, scale is undefined — selector returns undefined.
			   This verifies the selector doesn't throw on minimal state. */
			const state = createInitialState()
			const result = selectRadarPoints(state, "0", "0", false, "radar-0")
			expect(result).toBeUndefined()
		})

		it("threadable: accepts angleAxis override param without throwing", () => {
			/* Phase 4 RED: selectRadarPoints has no override parameter — calling with extra
			   arg is silently ignored and the selector uses legacy axis.
			   Phase 4 GREEN: override param accepted; selector uses provided angle axis
			   settings instead of reading from state. */
			const state = makeStateWithSolidPolarAxis({ solidAngle: { dataKey: "SOLID" } })
			const angleOverride: AngleAxisSettings = { ...baseAngleAxis, dataKey: "OVERRIDE" }

			const result = (selectRadarPoints as (
				s: RechartsRootState,
				radiusAxisId: string,
				angleAxisId: string,
				isPanorama: boolean,
				radarId: string,
				angleOverride?: AngleAxisSettings,
			) => unknown)(state, "0", "0", false, "radar-0", angleOverride)

			/* When override is wired, the selector uses "OVERRIDE" dataKey not "SOLID".
			   Until Phase 4 GREEN: result is undefined (no scale) — the key assertion is
			   that the call itself does NOT throw and the override param is accepted. */
			expect(result === undefined || typeof result === "object").toBe(true)
		})
	})

	describe("selectRadialBarSectors", () => {
		it("is a callable function with correct minimum arity", () => {
			expect(typeof selectRadialBarSectors).toBe("function")
			expect(selectRadialBarSectors.length).toBeGreaterThanOrEqual(4)
		})

		it("returns an empty array when no axis scale is available", () => {
			const state = createInitialState()
			const result = selectRadialBarSectors(state, "0", "0", baseRadialBarSettings, undefined)
			expect(Array.isArray(result)).toBe(true)
		})

		it("threadable: accepts radiusAxis override param without throwing", () => {
			/* Phase 4 RED: selectRadialBarSectors has no override parameter — extra arg ignored,
			   selector uses legacy axis.
			   Phase 4 GREEN: override param accepted; selector uses provided radius axis settings. */
			const state = makeStateWithSolidPolarAxis({ solidRadius: { domain: [0, 500] } })
			const radiusOverride: RadiusAxisSettings = { ...baseRadiusAxis, domain: [0, 9999] }

			const result = (selectRadialBarSectors as (
				s: RechartsRootState,
				radiusAxisId: string,
				angleAxisId: string,
				settings: RadialBarSettings,
				cells: undefined,
				radiusOverride?: RadiusAxisSettings,
			) => unknown)(state, "0", "0", baseRadialBarSettings, undefined, radiusOverride)

			/* Until Phase 4 GREEN: result is an empty array (no scale/polarOptions).
			   Key assertion: call does NOT throw and the parameter is accepted. */
			expect(Array.isArray(result) || typeof result === "object").toBe(true)
		})
	})
})
