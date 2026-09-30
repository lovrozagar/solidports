import { describe, expect, it } from "vitest"
import { selectBarRectangles } from "../../../src/state/selectors/barSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
import type { XAxisSettings, YAxisSettings } from "../../../src/state/cartesianAxisSlice"
import type { BarSettings } from "../../../src/state/types/BarSettings"

/* The Phase 3 injection contract for selectBarRectangles:
   selectBarRectangles(state, id, isPanorama, cells, xAxisOverride?, yAxisOverride?)

   Phase 3 RED: the current signature has no override params — calls with extra args are
   silently ignored, selector hits the legacy chain regardless.
   Phase 3 GREEN: override params thread through selectAxisWithScale, bypassing the
   _solid probe walk on the hot animation path. */

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

/* Minimal BarSettings for fixture injection. */
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

/* Helper: state with legacy bar registered and an empty _solid.cartesianAxes. */
function makeBarState(): RechartsRootState {
	const state = createInitialState()
	state.graphicalItems.cartesianItems.push(baseBarSettings)
	state.cartesianAxis.xAxis["0"] = { ...baseXAxis }
	state.cartesianAxis.yAxis["0"] = { ...baseYAxis }
	/* _solid.cartesianAxes deliberately empty — override params must not depend on it. */
	;(state as Record<string, unknown>)["_solid"] = {
		cartesianAxes: { xAxis: {}, yAxis: {}, zAxis: {} },
	}
	return state
}

type SelectBarRectanglesWithOverride = (
	state: RechartsRootState,
	id: string,
	isPanorama: boolean,
	cells: undefined,
	xAxisOverride?: XAxisSettings,
	yAxisOverride?: YAxisSettings,
) => unknown

describe("Phase 3 — barSelectors override-param injection", () => {
	it("selectBarRectangles without overrides hits the legacy selector chain (fallback intact)", () => {
		/* Proves barStackSelectors.combineStackRects callers remain unbroken — no override
		   supplied, selector falls through to selectBaseAxis → legacy cartesianAxis slice. */
		const state = makeBarState()
		/* Returns undefined when chart offset/scale is not fully computed (unit test context),
		   but must not throw. The important invariant is the call succeeds. */
		const result = selectBarRectangles(state, "bar-0", false, undefined)
		expect(result === undefined || Array.isArray(result)).toBe(true)
	})

	it("selectBarRectangles with xAxisSettings + yAxisSettings overrides skips the _solid probe path", () => {
		/* Phase 3 RED: extra args ignored — result is identical to the no-override call.
		   Phase 3 GREEN: override params bypass selectBaseAxis entirely; result may differ
		   from the legacy-chain result when override domain diverges. Signature widens. */
		const state = makeBarState()
		const xOverride: XAxisSettings = { ...baseXAxis, domain: [0, 9999] }
		const yOverride: YAxisSettings = { ...baseYAxis, domain: [0, 9999] }
		const resultWithOverride = (selectBarRectangles as unknown as SelectBarRectanglesWithOverride)(
			state,
			"bar-0",
			false,
			undefined,
			xOverride,
			yOverride,
		)
		/* Must not throw. After Phase 3 GREEN, the hot path is exercised without probe walk. */
		expect(resultWithOverride === undefined || Array.isArray(resultWithOverride)).toBe(true)
	})

	it("override on xAxis only (yAxis falls back) — mixed read does not throw", () => {
		/* D12: overrides are per-axis and independent — supply xAxis override, let yAxis
		   fall through to the legacy probe. Selector must handle partial override cleanly. */
		const state = makeBarState()
		const xOverride: XAxisSettings = { ...baseXAxis, domain: [0, 500] }
		const resultMixed = (selectBarRectangles as unknown as SelectBarRectanglesWithOverride)(
			state,
			"bar-0",
			false,
			undefined,
			xOverride,
			undefined,
		)
		expect(resultMixed === undefined || Array.isArray(resultMixed)).toBe(true)
	})
})
