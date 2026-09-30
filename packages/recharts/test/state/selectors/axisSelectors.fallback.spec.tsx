import { describe, expect, it } from "vitest"
import { selectXAxisSettings, selectYAxisSettings } from "../../../src/state/selectors/axisSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
import type { XAxisSettings, YAxisSettings } from "../../../src/state/cartesianAxisSlice"

/* Minimal XAxisSettings fixture — only dataKey matters for these fallback tests. */
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

/* Build a RechartsRootState with both new _solid state and legacy cartesianAxis populated. */
function makeStateWithBothSlices(opts: {
	newXAxisDataKey?: string
	newYAxisDataKey?: string
	legacyXAxisDataKey?: string
	legacyYAxisDataKey?: string
	omitNewXAxis?: boolean
	omitNewYAxis?: boolean
}): RechartsRootState {
	const base = createInitialState()

	/* Legacy slice — always populated. */
	if (opts.legacyXAxisDataKey !== undefined) {
		base.cartesianAxis.xAxis["0"] = { ...baseXAxis, dataKey: opts.legacyXAxisDataKey, id: "0" }
	}
	if (opts.legacyYAxisDataKey !== undefined) {
		base.cartesianAxis.yAxis["0"] = { ...baseYAxis, dataKey: opts.legacyYAxisDataKey, id: "0" }
	}

	/* New _solid state — Phase 2 adds this field to RechartsRootState.
	   The selector fallback reads _solid.cartesianAxes.xAxis["0"]?.settings first.
	   Before Phase 2 the field does not exist on the type → cast needed for RED tests. */
	const solidState = (base as Record<string, unknown>)["_solid"] as Record<string, unknown> | undefined
	const cartesianAxes = (solidState?.["cartesianAxes"] as Record<string, unknown> | undefined) ?? {}

	if (!opts.omitNewXAxis && opts.newXAxisDataKey !== undefined) {
		const xAxis = (cartesianAxes["xAxis"] as Record<string, unknown> | undefined) ?? {}
		xAxis["0"] = { settings: { ...baseXAxis, dataKey: opts.newXAxisDataKey, id: "0" } }
		cartesianAxes["xAxis"] = xAxis
	}

	if (!opts.omitNewYAxis && opts.newYAxisDataKey !== undefined) {
		const yAxis = (cartesianAxes["yAxis"] as Record<string, unknown> | undefined) ?? {}
		yAxis["0"] = { settings: { ...baseYAxis, dataKey: opts.newYAxisDataKey, id: "0" } }
		cartesianAxes["yAxis"] = yAxis
	}

	(base as Record<string, unknown>)["_solid"] = { cartesianAxes }

	return base
}

describe("Phase 2 — axisSelectors new-state-first / legacy-fallback", () => {
	it("selectXAxisSettings reads new _solid state when populated", () => {
		const state = makeStateWithBothSlices({
			legacyXAxisDataKey: "X-LEGACY",
			newXAxisDataKey: "X-NEW",
		})
		/* Fails RED: selector reads legacy only — _solid branch not yet added. */
		const result = selectXAxisSettings(state, "0")
		expect(result.dataKey).toBe("X-NEW")
	})

	it("selectXAxisSettings falls back to legacy when new state is empty", () => {
		const state = makeStateWithBothSlices({
			legacyXAxisDataKey: "X-LEGACY",
			omitNewXAxis: true,
		})
		/* Fails RED: fallback branch not yet added — selector returns implicitXAxis defaults
		   (dataKey: undefined) because _solid.cartesianAxes.xAxis is empty, but the
		   legacy-first read is correct only when the new-state branch is absent.
		   After Phase 2 the selector must prefer new state, then fall through to legacy. */
		const result = selectXAxisSettings(state, "0")
		expect(result.dataKey).toBe("X-LEGACY")
	})

	it("selectYAxisSettings reads new _solid state when populated", () => {
		const state = makeStateWithBothSlices({
			legacyYAxisDataKey: "Y-LEGACY",
			newYAxisDataKey: "Y-NEW",
		})
		/* Fails RED: selector reads legacy only — _solid branch not yet added. */
		const result = selectYAxisSettings(state, "0")
		expect(result.dataKey).toBe("Y-NEW")
	})
})
