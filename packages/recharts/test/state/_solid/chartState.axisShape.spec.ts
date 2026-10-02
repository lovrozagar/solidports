import { describe, expect, it } from "vitest"
import { observe } from "../../helper/observe"
import { expectTypeOf } from "vitest"
import { createRoot, flush } from 'solid-js'
import { createInitialChartState } from "../../../src/state/chartState"
import type { XAxisState, YAxisState, ZAxisState } from "../../../src/state/chartState"
import type { XAxisSettings, YAxisSettings, ZAxisSettings } from "../../../src/state/cartesianAxisSlice"

import { createStore } from '../../../src/util/solid-1-compat';
/* XAxisSettings fixture — dataKey is the field we probe. */
const xSettings: XAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: "x",
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

const ySettings: YAxisSettings = {
	allowDataOverflow: false,
	allowDecimals: true,
	allowDuplicatedCategory: true,
	angle: 0,
	dataKey: "value",
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

const zSettings: ZAxisSettings = {
	allowDataOverflow: false,
	allowDuplicatedCategory: false,
	dataKey: "z",
	domain: [0, "auto"],
	id: "0",
	includeHidden: false,
	name: undefined,
	range: [64, 64],
	reversed: false,
	scale: "auto",
	type: "number",
	unit: undefined,
}

describe("Phase 2 — widened XAxisState / YAxisState / ZAxisState shapes", () => {
	it("widened XAxisState has settings field of XAxisSettings shape", () => {
		/* Write a typed XAxisState entry via the widened shape.
		   Fails RED: XAxisState is Record<string, unknown> in Phase 1, so
		   the type-level assertion below rejects — XAxisState does NOT extend
		   { settings: XAxisSettings } until Phase 2 widens the type. */
		const [state, setState] = createStore(createInitialChartState())
		setState("cartesianAxes", "xAxis", "0", { settings: xSettings } as XAxisState)
		flush()
		createRoot((dispose) => {
			observe(() => {
				const dataKey = (state.cartesianAxes.xAxis["0"] as { settings: XAxisSettings } | undefined)?.settings?.dataKey
				expect(dataKey).toBe("x")
			})
			dispose()
		})

		/* Type-level: widened XAxisState must be assignable to { settings: XAxisSettings }.
		   With the Phase 1 stub (Record<string, unknown>) this assertion fails at compile time
		   because Record<string, unknown> does not extend { settings: XAxisSettings }. */
		expectTypeOf<XAxisState>().toEqualTypeOf<{ settings: XAxisSettings }>()
	})

	it("widened YAxisState has settings field of YAxisSettings shape", () => {
		const [state, setState] = createStore(createInitialChartState())
		setState("cartesianAxes", "yAxis", "0", { settings: ySettings } as YAxisState)
		flush()
		createRoot((dispose) => {
			observe(() => {
				const dataKey = (state.cartesianAxes.yAxis["0"] as { settings: YAxisSettings } | undefined)?.settings?.dataKey
				expect(dataKey).toBe("value")
			})
			dispose()
		})

		expectTypeOf<YAxisState>().toMatchTypeOf<{ settings: YAxisSettings }>()
	})

	it("widened ZAxisState has settings field of ZAxisSettings shape", () => {
		const [state, setState] = createStore(createInitialChartState())
		setState("cartesianAxes", "zAxis", "0", { settings: zSettings } as ZAxisState)
		flush()
		createRoot((dispose) => {
			observe(() => {
				const dataKey = (state.cartesianAxes.zAxis["0"] as { settings: ZAxisSettings } | undefined)?.settings?.dataKey
				expect(dataKey).toBe("z")
			})
			dispose()
		})

		expectTypeOf<ZAxisState>().toMatchTypeOf<{ settings: ZAxisSettings }>()
	})
})
