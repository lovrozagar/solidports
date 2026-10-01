import { describe, expect, it } from "vitest"
import { untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/chartState"
import type { BarSettings } from "../../../src/state/types/BarSettings"
import type { LineSettings } from "../../../src/state/types/LineSettings"
import type { AreaSettings } from "../../../src/state/types/AreaSettings"
import type { ScatterSettings } from "../../../src/state/types/ScatterSettings"

/* Phase 3 adds a typed ItemState discriminated union to graphicalItems.
   Currently ItemState = Record<string, unknown> — the widened union does not exist yet.

   Test 1: passes (initial state shape already correct).
   Tests 2-4: RED — typed CartesianItemState union doesn't exist; writing { type, settings }
   compiles as Record<string, unknown> and the `settings.dataKey` typed access fails or
   the shape assertion reveals the union is missing. */

describe("Phase 3 — ChartState graphicalItems ItemState shape", () => {
	it("createInitialChartState yields an empty graphicalItems record", () => {
		/* Passes at Phase 2 baseline — initial state shape already correct. */
		const state = createInitialChartState()
		expect(state.graphicalItems).toEqual({})
	})

	it("setState accepts BarSettings under settings field on graphicalItems[id]", () => {
		/* Phase 3 RED: ItemState = Record<string, unknown> — writing a typed BarSettings object
		   works at runtime but TypeScript narrows settings.dataKey as unknown (no typed union).
		   Phase 3 GREEN: ItemState widened to CartesianItemState discriminated union;
		   state.graphicalItems["bar0"]?.settings.dataKey narrows to DataKey<unknown> | undefined. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const barSettings: BarSettings = {
			data: undefined,
			dataKey: "revenue",
			hide: false,
			id: "bar0",
			isPanorama: false,
			maxBarSize: undefined,
			minPointSize: 0,
			stackId: undefined,
			type: "bar",
			xAxisId: "0",
			yAxisId: "0",
			zAxisId: "0",
		}

		setState("graphicalItems", "bar0", { type: "bar", settings: barSettings } as never)

		/* untrack: shape assertion, not a reactive subscription — reads are immediate/one-shot. */
		const entry = untrack(
			() => state.graphicalItems["bar0"] as { type: string; settings: BarSettings } | undefined,
		)
		expect(entry?.type).toBe("bar")
		expect(entry?.settings.dataKey).toBe("revenue")
	})

	it("setState accepts LineSettings under settings field on graphicalItems[id]", () => {
		/* Phase 3 RED: same as above — ItemState union not typed yet. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const lineSettings: LineSettings = {
			data: undefined,
			dataKey: "profit",
			hide: false,
			id: "line0",
			isPanorama: false,
			type: "line",
			xAxisId: "0",
			yAxisId: "0",
			zAxisId: "0",
		}

		setState("graphicalItems", "line0", { type: "line", settings: lineSettings } as never)

		const entry = untrack(
			() => state.graphicalItems["line0"] as { type: string; settings: LineSettings } | undefined,
		)
		expect(entry?.type).toBe("line")
		expect(entry?.settings.dataKey).toBe("profit")
	})

	it("graphicalItems entries for each type are independent — no cross-contamination", () => {
		/* Phase 3 RED: ItemState union not yet discriminated; both writes land as
		   Record<string, unknown> with no type guard. After Phase 3 GREEN: union narrows
		   correctly and area/scatter entries are typed independently. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const areaSettings: AreaSettings = {
			baseValue: undefined,
			connectNulls: false,
			data: undefined,
			dataKey: "volume",
			hide: false,
			id: "area0",
			isPanorama: false,
			stackId: undefined,
			type: "area",
			xAxisId: "0",
			yAxisId: "0",
			zAxisId: "0",
		}

		const scatterSettings: ScatterSettings = {
			data: undefined,
			dataKey: "x",
			hide: false,
			id: "scatter0",
			isPanorama: false,
			name: undefined,
			tooltipType: undefined,
			type: "scatter",
			xAxisId: "0",
			yAxisId: "0",
			zAxisId: "0",
		}

		setState("graphicalItems", "area0", { type: "area", settings: areaSettings } as never)
		setState("graphicalItems", "scatter0", { type: "scatter", settings: scatterSettings } as never)

		const area = untrack(
			() => state.graphicalItems["area0"] as { type: string; settings: AreaSettings } | undefined,
		)
		const scatter = untrack(
			() => state.graphicalItems["scatter0"] as { type: string; settings: ScatterSettings } | undefined,
		)
		const areaSameAsScatter = untrack(() => state.graphicalItems["area0"] === state.graphicalItems["scatter0"])

		expect(area?.type).toBe("area")
		expect(area?.settings.dataKey).toBe("volume")
		expect(scatter?.type).toBe("scatter")
		expect(scatter?.settings.dataKey).toBe("x")
		expect(areaSameAsScatter).toBe(false)
	})
})
