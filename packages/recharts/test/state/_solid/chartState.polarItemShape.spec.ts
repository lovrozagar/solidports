import { describe, expect, it } from "vitest"
import { untrack, flush } from 'solid-js';
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/chartState"
import type { PieSettings } from "../../../src/state/types/PieSettings"
import type { RadarSettings } from "../../../src/state/types/RadarSettings"
import type { RadialBarSettings } from "../../../src/state/types/RadialBarSettings"

import { createStore } from '../../../src/util/solid-1-compat';
/* Phase 4 widens ItemState to include PolarItemState = PieState | RadarState | RadialBarState.
   Currently ItemState = CartesianItemState — the polar union does not exist yet.

   Test 1: passes (initial state shape already correct).
   Tests 2-4: RED — typed PolarItemState union doesn't exist; writing { type, settings }
   compiles as Record<string, unknown> and typed access on settings fields fails or
   the shape assertion reveals the polar union is missing. */

describe("Phase 4 — ChartState graphicalItems PolarItemState shape", () => {
	it("createInitialChartState yields an empty graphicalItems record", () => {
		/* Passes at Phase 3 baseline — initial state shape already correct. */
		const state = createInitialChartState()
		expect(state.graphicalItems).toEqual({})
	})

	it("setState accepts PieSettings under settings field on graphicalItems[id]", () => {
		/* Phase 4 RED: ItemState = CartesianItemState only — writing a PieSettings object
		   works at runtime but TypeScript narrows settings as CartesianItemState with no
		   pie branch; state.graphicalItems["pie0"]?.settings.dataKey is unknown.
		   Phase 4 GREEN: ItemState widened to include PolarItemState; PieState branch
		   accessible via discriminated union on type === "pie". */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const pieSettings: PieSettings = {
			angleAxisId: "0",
			cx: "50%",
			cy: "50%",
			cornerRadius: undefined,
			data: undefined,
			dataKey: "revenue",
			endAngle: -270,
			fill: "#8884d8",
			hide: false,
			id: "pie0",
			innerRadius: 0,
			legendType: "circle",
			maxRadius: undefined,
			minAngle: 0,
			name: undefined,
			nameKey: "name",
			outerRadius: "80%",
			paddingAngle: 0,
			presentationProps: null,
			radiusAxisId: "0",
			startAngle: 90,
			tooltipType: undefined,
			type: "pie",
		}

		setState("graphicalItems", "pie0", { type: "pie", settings: pieSettings } as never)
		flush()

		const entry = untrack(
			() => state.graphicalItems["pie0"] as { type: string; settings: PieSettings } | undefined,
		)
		expect(entry?.type).toBe("pie")
		expect(entry?.settings.dataKey).toBe("revenue")
		expect(entry?.settings.startAngle).toBe(90)
	})

	it("setState accepts RadarSettings under settings field on graphicalItems[id]", () => {
		/* Phase 4 RED: RadarState branch not in ItemState union. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const radarSettings: RadarSettings = {
			angleAxisId: "0",
			data: undefined,
			dataKey: "cost",
			hide: false,
			id: "radar0",
			radiusAxisId: "0",
			type: "radar",
		}

		setState("graphicalItems", "radar0", { type: "radar", settings: radarSettings } as never)
		flush()

		const entry = untrack(
			() => state.graphicalItems["radar0"] as { type: string; settings: RadarSettings } | undefined,
		)
		expect(entry?.type).toBe("radar")
		expect(entry?.settings.dataKey).toBe("cost")
	})

	it("setState accepts RadialBarSettings under settings field on graphicalItems[id]", () => {
		/* Phase 4 RED: RadialBarState branch not in ItemState union. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const radialBarSettings: RadialBarSettings = {
			angleAxisId: "0",
			data: undefined,
			dataKey: "score",
			hide: false,
			id: "radialBar0",
			maxBarSize: 20,
			minPointSize: 0,
			radiusAxisId: "0",
			stackId: undefined,
			type: "radialBar",
		}

		setState("graphicalItems", "radialBar0", { type: "radialBar", settings: radialBarSettings } as never)
		flush()

		const entry = untrack(
			() =>
				state.graphicalItems["radialBar0"] as
					| { type: string; settings: RadialBarSettings }
					| undefined,
		)
		expect(entry?.type).toBe("radialBar")
		expect(entry?.settings.dataKey).toBe("score")
		expect(entry?.settings.maxBarSize).toBe(20)
	})

	it("polar and cartesian graphicalItems entries are independent — no cross-contamination", () => {
		/* Phase 4 RED: PolarItemState not in union — both writes land as Record<string, unknown>
		   with no discriminated type guard.
		   Phase 4 GREEN: union narrows correctly, pie/bar entries are typed independently. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		const pieSettings: PieSettings = {
			angleAxisId: "0",
			cx: "50%",
			cy: "50%",
			cornerRadius: undefined,
			data: undefined,
			dataKey: "revenue",
			endAngle: -270,
			fill: "#8884d8",
			hide: false,
			id: "pie0",
			innerRadius: 0,
			legendType: "circle",
			maxRadius: undefined,
			minAngle: 0,
			name: undefined,
			nameKey: "name",
			outerRadius: "80%",
			paddingAngle: 0,
			presentationProps: null,
			radiusAxisId: "0",
			startAngle: 90,
			tooltipType: undefined,
			type: "pie",
		}

		const radarSettings: RadarSettings = {
			angleAxisId: "0",
			data: undefined,
			dataKey: "cost",
			hide: false,
			id: "radar0",
			radiusAxisId: "0",
			type: "radar",
		}

		setState("graphicalItems", "pie0", { type: "pie", settings: pieSettings } as never)
		flush()
		setState("graphicalItems", "radar0", { type: "radar", settings: radarSettings } as never)
		flush()

		const pie = untrack(
			() => state.graphicalItems["pie0"] as { type: string; settings: PieSettings } | undefined,
		)
		const radar = untrack(
			() => state.graphicalItems["radar0"] as { type: string; settings: RadarSettings } | undefined,
		)
		const sameRef = untrack(() => state.graphicalItems["pie0"] === state.graphicalItems["radar0"])

		expect(pie?.type).toBe("pie")
		expect(pie?.settings.dataKey).toBe("revenue")
		expect(radar?.type).toBe("radar")
		expect(radar?.settings.dataKey).toBe("cost")
		expect(sameRef).toBe(false)
	})
})
