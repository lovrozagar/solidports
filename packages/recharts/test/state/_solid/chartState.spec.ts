import { describe, expect, it } from "vitest"
import { createInitialChartState } from "../../../src/state/chartState"

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
		expect(a.layout).not.toBe(b.layout)
		expect(a.layout.margin).not.toBe(b.layout.margin)
		expect(a.chartData).not.toBe(b.chartData)
		expect(a.errorBars).not.toBe(b.errorBars)
		expect(a.eventSettings).not.toBe(b.eventSettings)
		expect(a.eventSettings.throttledEvents).not.toBe(b.eventSettings.throttledEvents)
		expect(a.options).not.toBe(b.options)
		expect(a.referenceElements).not.toBe(b.referenceElements)
		expect(a.referenceElements.dots).not.toBe(b.referenceElements.dots)
		expect(a.rootProps).not.toBe(b.rootProps)
		expect(a.zIndex).not.toBe(b.zIndex)
		expect(a.zIndex.zIndexMap).not.toBe(b.zIndex.zIndexMap)
		expect(a.renderedTicks).not.toBe(b.renderedTicks)
		expect(a.cartesianAxes).not.toBe(b.cartesianAxes)
		expect(a.polarAxes).not.toBe(b.polarAxes)
		expect(a.graphicalItems).not.toBe(b.graphicalItems)
		expect(a.animation).not.toBe(b.animation)
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
		const state = createInitialChartState({
			layout: {
				height: 0,
				layoutType: "vertical",
				margin: { bottom: 5, left: 5, right: 5, top: 5 },
				scale: 1,
				width: 0,
			},
		})
		expect(state.layout.layoutType).toBe("vertical")
		expect(state.brush.width).toBe(0)
	})
})
