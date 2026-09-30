import { describe, expect, it } from "vitest"
import {
	selectXAxisSettingsNoDefaults,
	selectYAxisSettingsNoDefaults,
	selectZAxisSettings,
} from "../../../src/state/selectors/axisSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
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

/* Builds a RechartsRootState with _solid.cartesianAxes populated at axis "0". */
function makeStateWithSolidAxis(opts: {
	solidXDataKey?: string
	solidYDataKey?: string
	solidZRange?: [number, number]
	legacyXDataKey?: string
	legacyYDataKey?: string
}): RechartsRootState {
	const base = createInitialState()

	if (opts.legacyXDataKey !== undefined) {
		base.cartesianAxis.xAxis["0"] = { ...baseXAxis, dataKey: opts.legacyXDataKey }
	}
	if (opts.legacyYDataKey !== undefined) {
		base.cartesianAxis.yAxis["0"] = { ...baseYAxis, dataKey: opts.legacyYDataKey }
	}

	const cartesianAxes: Record<string, unknown> = {}

	if (opts.solidXDataKey !== undefined) {
		cartesianAxes["xAxis"] = { "0": { settings: { ...baseXAxis, dataKey: opts.solidXDataKey } } }
	}
	if (opts.solidYDataKey !== undefined) {
		cartesianAxes["yAxis"] = { "0": { settings: { ...baseYAxis, dataKey: opts.solidYDataKey } } }
	}
	if (opts.solidZRange !== undefined) {
		cartesianAxes["zAxis"] = { "0": { settings: { ...baseZAxis, range: opts.solidZRange } } }
	}

	;(base as Record<string, unknown>)["_solid"] = { cartesianAxes }

	return base
}

/* ---- xAxis injection ---- */

describe("Phase 3 — axisSelectors override-param injection", () => {
	describe("selectXAxisSettingsNoDefaults", () => {
		it("uses _solid branch when populated (no override arg)", () => {
			/* Phase 3 RED: selector already has the _solid probe path — this may PASS
			   from Phase 2. If so it is NOT a suspect failure, just pre-existing behavior. */
			const state = makeStateWithSolidAxis({
				legacyXDataKey: "X-LEGACY",
				solidXDataKey: "X-SOLID",
			})
			const result = selectXAxisSettingsNoDefaults(state, "0")
			expect(result?.dataKey).toBe("X-SOLID")
		})

		it("falls back to legacy when _solid branch is absent", () => {
			const state = makeStateWithSolidAxis({ legacyXDataKey: "X-LEGACY" })
			const result = selectXAxisSettingsNoDefaults(state, "0")
			expect(result?.dataKey).toBe("X-LEGACY")
		})

		/* Phase 3 RED: override parameter doesn't exist on the selector yet —
		   calling with a 3rd arg is ignored, selector returns _solid or legacy value.
		   Phase 3 GREEN: selector accepts optional XAxisSettings override; when supplied,
		   bypasses both _solid probe and legacy lookup, returns override directly. */
		it("uses override when provided — bypasses both _solid and legacy branches", () => {
			const state = makeStateWithSolidAxis({
				legacyXDataKey: "X-LEGACY",
				solidXDataKey: "X-SOLID",
			})
			const override: XAxisSettings = { ...baseXAxis, dataKey: "X-OVERRIDE" }
			const result = (selectXAxisSettingsNoDefaults as (
				s: RechartsRootState,
				id: string,
				override?: XAxisSettings,
			) => XAxisSettings | undefined)(state, "0", override)
			expect(result?.dataKey).toBe("X-OVERRIDE")
		})
	})

	/* ---- yAxis injection ---- */

	describe("selectYAxisSettingsNoDefaults", () => {
		it("uses _solid branch when populated (no override arg)", () => {
			const state = makeStateWithSolidAxis({
				legacyYDataKey: "Y-LEGACY",
				solidYDataKey: "Y-SOLID",
			})
			const result = selectYAxisSettingsNoDefaults(state, "0")
			expect(result?.dataKey).toBe("Y-SOLID")
		})

		it("falls back to legacy when _solid branch is absent", () => {
			const state = makeStateWithSolidAxis({ legacyYDataKey: "Y-LEGACY" })
			const result = selectYAxisSettingsNoDefaults(state, "0")
			expect(result?.dataKey).toBe("Y-LEGACY")
		})

		it("uses override when provided — bypasses both _solid and legacy branches", () => {
			const state = makeStateWithSolidAxis({
				legacyYDataKey: "Y-LEGACY",
				solidYDataKey: "Y-SOLID",
			})
			const override: YAxisSettings = { ...baseYAxis, dataKey: "Y-OVERRIDE" }
			const result = (selectYAxisSettingsNoDefaults as (
				s: RechartsRootState,
				id: string,
				override?: YAxisSettings,
			) => YAxisSettings | undefined)(state, "0", override)
			expect(result?.dataKey).toBe("Y-OVERRIDE")
		})
	})

	/* ---- zAxis injection ---- */

	describe("selectZAxisSettings", () => {
		it("uses _solid branch when populated (no override arg)", () => {
			const state = makeStateWithSolidAxis({ solidZRange: [10, 200] })
			const result = selectZAxisSettings(state, "0")
			expect(result.range).toEqual([10, 200])
		})

		it("falls back to implicit defaults when _solid branch and legacy are both absent", () => {
			const state = createInitialState()
			const result = selectZAxisSettings(state, "0")
			/* implicitZAxis.range = [64, 64] */
			expect(result.range).toEqual([64, 64])
		})

		it("uses override when provided — bypasses both _solid and legacy branches", () => {
			const state = makeStateWithSolidAxis({ solidZRange: [10, 200] })
			const override: ZAxisSettings = { ...baseZAxis, range: [1, 999] }
			const result = (selectZAxisSettings as (
				s: RechartsRootState,
				id: string,
				override?: ZAxisSettings,
			) => ZAxisSettings)(state, "0", override)
			expect(result.range).toEqual([1, 999])
		})
	})
})
