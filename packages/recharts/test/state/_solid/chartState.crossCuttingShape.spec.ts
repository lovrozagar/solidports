import { describe, expect, it } from "vitest"
import { untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/chartState"
import type { TooltipState } from "../../../src/state/tooltipSlice"
import type { LegendState } from "../../../src/state/legendSlice"
import type { BrushSettings } from "../../../src/state/brushSlice"

describe("Phase 5 — ChartState cross-cutting slice shapes", () => {
	it("createInitialChartState yields tooltip with all required interaction fields", () => {
		/* Passes at Phase 4 baseline — tooltip shape already populated by makeTooltipState().
		   Locks shape so Phase 5 refactor cannot accidentally drop interaction sub-trees. */
		const state = createInitialChartState()
		const t = state.tooltip as TooltipState
		expect(t.axisInteraction).toBeDefined()
		expect(t.itemInteraction).toBeDefined()
		expect(t.keyboardInteraction).toBeDefined()
		expect(t.syncInteraction).toBeDefined()
		expect(Array.isArray(t.tooltipItemPayloads)).toBe(true)
		expect(t.settings).toBeDefined()
		expect(t.settings.trigger).toBe("hover")
	})

	it("createInitialChartState yields legend with settings / size / payload fields", () => {
		/* Passes at Phase 4 baseline — legend shape already populated by makeLegendState().
		   Locks shape for Phase 5 migration; LegendState must stay structurally intact. */
		const state = createInitialChartState()
		const l = state.legend as LegendState
		expect(l.settings).toBeDefined()
		expect(l.settings.align).toBe("center")
		expect(l.settings.layout).toBe("horizontal")
		expect(l.size).toBeDefined()
		expect(l.size.width).toBe(0)
		expect(Array.isArray(l.payload)).toBe(true)
	})

	it("createInitialChartState yields brush with all BrushSettings fields", () => {
		/* Passes at Phase 4 baseline — brush shape already populated by makeBrushState().
		   Locks shape for Phase 5 migration. */
		const state = createInitialChartState()
		const b = state.brush as BrushSettings
		expect(b.height).toBe(0)
		expect(b.padding).toBeDefined()
		expect(b.padding.left).toBe(0)
		expect(b.padding.right).toBe(0)
	})

	it("runtime write-then-read on tooltip.settings via createStore roundtrips correctly", () => {
		/* Phase 5 RED: if Phase 5 widens tooltip shape in ChartState but createInitialChartState
		   is not updated, the write lands on a mistyped path and the read-back diverges.
		   After GREEN: new shape + factory are in sync. */
		const [state, setState] = createStore<ChartState>(createInitialChartState())

		setState("tooltip", "settings", "trigger" as never, "click" as never)
		setState("tooltip", "settings", "axisId" as never, "custom-axis" as never)

		const trigger = untrack(() => state.tooltip.settings.trigger)
		const axisId = untrack(() => state.tooltip.settings.axisId)
		expect(trigger).toBe("click")
		expect(axisId).toBe("custom-axis")
	})
})
