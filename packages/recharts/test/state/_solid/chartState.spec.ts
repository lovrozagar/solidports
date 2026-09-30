import { describe, expect, it } from "vitest"
import { createInitialChartState } from "../../../src/state/_solid/chartState"

describe("createInitialChartState", () => {
	it("returns a fresh instance per call — no shared object references", () => {
		const a = createInitialChartState()
		const b = createInitialChartState()

		expect(a).not.toBe(b)
		expect(a.brush).not.toBe(b.brush)
		expect(a.legend).not.toBe(b.legend)
		expect(a.legend.settings).not.toBe(b.legend.settings)
		expect(a.tooltip).not.toBe(b.tooltip)
		expect(a.tooltip.axisInteraction).not.toBe(b.tooltip.axisInteraction)
		expect(a.tooltip.syncInteraction).not.toBe(b.tooltip.syncInteraction)
		expect(a.margin).not.toBe(b.margin)
		expect(a.chartSize).not.toBe(b.chartSize)
	})

	it("preserves function-typed fields — no JSON roundtrip drops", () => {
		/* LegendItemSorter is currently "value" (string) in Phase 1.
		   Phase 2 may set it to a function — factory construction must not drop it.
		   This test uses a function value directly to prove the factory is safe. */
		const sorter = () => 0
		const state = createInitialChartState({
			legend: {
				payload: [],
				settings: { align: "center", itemSorter: sorter, layout: "horizontal", verticalAlign: "middle" },
				size: { height: 0, width: 0 },
			},
		})
		expect(state.legend.settings.itemSorter).toBe(sorter)
	})

	it("applies overrides shallowly", () => {
		const state = createInitialChartState({ layout: "vertical" })
		expect(state.layout).toBe("vertical")
		expect(state.brush.width).toBe(0)
	})
})
