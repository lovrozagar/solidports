import { describe, expect, it } from "vitest"
import {
	selectAngleAxis,
	selectRadiusAxis,
	implicitAngleAxis,
	implicitRadiusAxis,
} from "../../../src/state/selectors/polarAxisSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
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

function makeStateWithSolidPolarAxis(opts: {
	solidAngleDataKey?: string
	solidRadiusDataKey?: string
	legacyAngleDataKey?: string
	legacyRadiusDataKey?: string
}): RechartsRootState {
	const base = createInitialState()

	if (opts.legacyAngleDataKey !== undefined) {
		base.polarAxis.angleAxis["0"] = { ...baseAngleAxis, dataKey: opts.legacyAngleDataKey }
	}
	if (opts.legacyRadiusDataKey !== undefined) {
		base.polarAxis.radiusAxis["0"] = { ...baseRadiusAxis, dataKey: opts.legacyRadiusDataKey }
	}

	const polarAxes: Record<string, unknown> = {}

	if (opts.solidAngleDataKey !== undefined) {
		polarAxes["angleAxis"] = { "0": { settings: { ...baseAngleAxis, dataKey: opts.solidAngleDataKey } } }
	}
	if (opts.solidRadiusDataKey !== undefined) {
		polarAxes["radiusAxis"] = { "0": { settings: { ...baseRadiusAxis, dataKey: opts.solidRadiusDataKey } } }
	}

	;(base as Record<string, unknown>)["_solid"] = { polarAxes }

	return base
}

describe("Phase 4 — polarAxisSelectors override-param injection", () => {
	describe("selectAngleAxis", () => {
		it("uses _solid branch when populated (no override arg)", () => {
			/* Phase 4 RED: selectAngleAxis reads only state.polarAxis — no _solid probe yet.
			   Phase 4 GREEN: selector checks state._solid?.polarAxes.angleAxis first. */
			const state = makeStateWithSolidPolarAxis({
				legacyAngleDataKey: "ANGLE-LEGACY",
				solidAngleDataKey: "ANGLE-SOLID",
			})
			const result = selectAngleAxis(state, "0")
			expect(result.dataKey).toBe("ANGLE-SOLID")
		})

		it("falls back to legacy when _solid branch is absent", () => {
			const state = makeStateWithSolidPolarAxis({ legacyAngleDataKey: "ANGLE-LEGACY" })
			const result = selectAngleAxis(state, "0")
			expect(result.dataKey).toBe("ANGLE-LEGACY")
		})

		it("falls back to implicit defaults when both _solid and legacy are absent", () => {
			const state = createInitialState()
			const result = selectAngleAxis(state, "0")
			/* Returns the implicit angle axis shape — dataKey is undefined. */
			expect(result.dataKey).toBeUndefined()
		})

		/* Phase 4 RED: override parameter doesn't exist — 3rd arg ignored, returns _solid or legacy.
		   Phase 4 GREEN: selector accepts optional AngleAxisSettings override; when supplied,
		   bypasses both _solid probe and legacy lookup. */
		it("uses override when provided — bypasses both _solid and legacy branches", () => {
			const state = makeStateWithSolidPolarAxis({
				legacyAngleDataKey: "ANGLE-LEGACY",
				solidAngleDataKey: "ANGLE-SOLID",
			})
			const override: AngleAxisSettings = { ...baseAngleAxis, dataKey: "ANGLE-OVERRIDE" }
			const result = (selectAngleAxis as (
				s: RechartsRootState,
				id: string | undefined,
				override?: AngleAxisSettings,
			) => AngleAxisSettings)(state, "0", override)
			expect(result.dataKey).toBe("ANGLE-OVERRIDE")
		})
	})

	describe("selectRadiusAxis", () => {
		it("uses _solid branch when populated (no override arg)", () => {
			/* Phase 4 RED: selectRadiusAxis reads only state.polarAxis — no _solid probe yet. */
			const state = makeStateWithSolidPolarAxis({
				legacyRadiusDataKey: "RADIUS-LEGACY",
				solidRadiusDataKey: "RADIUS-SOLID",
			})
			const result = selectRadiusAxis(state, "0")
			expect(result.dataKey).toBe("RADIUS-SOLID")
		})

		it("falls back to legacy when _solid branch is absent", () => {
			const state = makeStateWithSolidPolarAxis({ legacyRadiusDataKey: "RADIUS-LEGACY" })
			const result = selectRadiusAxis(state, "0")
			expect(result.dataKey).toBe("RADIUS-LEGACY")
		})

		it("uses override when provided — bypasses both _solid and legacy branches", () => {
			const state = makeStateWithSolidPolarAxis({
				legacyRadiusDataKey: "RADIUS-LEGACY",
				solidRadiusDataKey: "RADIUS-SOLID",
			})
			const override: RadiusAxisSettings = { ...baseRadiusAxis, dataKey: "RADIUS-OVERRIDE" }
			const result = (selectRadiusAxis as (
				s: RechartsRootState,
				id: string,
				override?: RadiusAxisSettings,
			) => RadiusAxisSettings)(state, "0", override)
			expect(result.dataKey).toBe("RADIUS-OVERRIDE")
		})
	})
})
