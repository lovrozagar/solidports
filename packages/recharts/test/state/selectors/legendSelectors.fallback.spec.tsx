import { describe, expect, it } from "vitest"
import {
	selectLegendSettings,
	selectLegendSize,
	selectLegendPayload,
} from "../../../src/state/selectors/legendSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
import type { LegendSettings, LegendState } from "../../../src/state/legendSlice"
import type { LegendPayload } from "../../../src/component/DefaultLegendContent"

const newSettings: LegendSettings = {
	align: "right",
	itemSorter: null,
	layout: "vertical",
	verticalAlign: "top",
}

const legacySettings: LegendSettings = {
	align: "left",
	itemSorter: "value",
	layout: "horizontal",
	verticalAlign: "bottom",
}

const newPayload: ReadonlyArray<LegendPayload> = [
	{ color: "#ff0000", id: "new-0", type: "circle", value: "NewSeries" },
]

const legacyPayload: ReadonlyArray<LegendPayload> = [
	{ color: "#0000ff", id: "leg-0", type: "line", value: "LegacySeries" },
]

function makeStateWithLegend(opts: {
	newSettings?: LegendSettings
	newSize?: { width: number; height: number }
	newPayload?: ReadonlyArray<ReadonlyArray<LegendPayload>>
	legacySettings?: LegendSettings
	legacySize?: { width: number; height: number }
	legacyPayload?: ReadonlyArray<ReadonlyArray<LegendPayload>>
	omitNew?: boolean
}): RechartsRootState {
	const base = createInitialState()

	if (opts.legacySettings !== undefined) {
		base.legend.settings = opts.legacySettings
	}
	if (opts.legacySize !== undefined) {
		base.legend.size = opts.legacySize
	}
	if (opts.legacyPayload !== undefined) {
		base.legend.payload = opts.legacyPayload
	}

	if (!opts.omitNew) {
		const newLegend: Partial<LegendState> = {}
		if (opts.newSettings !== undefined) newLegend.settings = opts.newSettings
		if (opts.newSize !== undefined) newLegend.size = opts.newSize
		if (opts.newPayload !== undefined) newLegend.payload = opts.newPayload

		if (Object.keys(newLegend).length > 0) {
			const current = (base as Record<string, unknown>)["_solid"] as Record<string, unknown> | undefined
			;(base as Record<string, unknown>)["_solid"] = {
				...current,
				legend: newLegend,
			}
		}
	}

	return base
}

describe("Phase 5 — legendSelectors new-state-first / legacy-fallback", () => {
	it("selectLegendSettings reads new _solid state when populated", () => {
		/* Phase 5 RED: selectLegendSettings reads state.legend.settings (legacy) only —
		   _solid.legend.settings branch not yet added. After GREEN: new state wins. */
		const state = makeStateWithLegend({
			legacySettings,
			newSettings,
		})
		const result = selectLegendSettings(state)
		expect(result.align).toBe("right")
	})

	it("selectLegendSettings falls back to legacy when new state absent", () => {
		/* Phase 5 RED: fallback path not yet explicit — must return legacy settings when
		   _solid.legend is undefined. Currently returns legacy anyway but after GREEN the
		   fallback branch is explicitly tested. */
		const state = makeStateWithLegend({
			legacySettings,
			omitNew: true,
		})
		const result = selectLegendSettings(state)
		expect(result.align).toBe("left")
	})

	it("selectLegendSize reads new _solid state when populated", () => {
		/* Phase 5 RED: selectLegendSize reads state.legend.size (legacy) only — new branch
		   absent. After GREEN: new-state size wins. */
		const state = makeStateWithLegend({
			legacySize: { height: 10, width: 50 },
			newSize: { height: 80, width: 200 },
		})
		const result = selectLegendSize(state)
		expect(result.width).toBe(200)
	})

	it("selectLegendSize falls back to legacy when new state absent", () => {
		/* Phase 5 RED: explicit fallback branch absent. Must return legacy size. */
		const state = makeStateWithLegend({
			legacySize: { height: 10, width: 50 },
			omitNew: true,
		})
		const result = selectLegendSize(state)
		expect(result.width).toBe(50)
	})

	it("selectLegendPayload reads new _solid state when populated", () => {
		/* Phase 5 RED: selectLegendPayload reads legacy state.legend.payload only — new
		   _solid.legend.payload branch not yet added. After GREEN: new payload wins. */
		const state = makeStateWithLegend({
			legacyPayload: [legacyPayload],
			newPayload: [newPayload],
		})
		const result = selectLegendPayload(state)
		/* new payload has value "NewSeries" — legacy has "LegacySeries" */
		expect(result.some((p) => p.value === "NewSeries")).toBe(true)
	})
})
