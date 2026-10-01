import { describe, expect, it } from "vitest"
import { createInitialChartState } from "../../../src/state/chartState"
import type { ChartState } from "../../../src/state/chartState"
import type { XAxisSettings } from "../../../src/state/cartesianAxisSlice"

const CHART_STATE_KEYS = [
	"animation",
	"brush",
	"cartesianAxes",
	"chartData",
	"chartSize",
	"errorBars",
	"eventSettings",
	"graphicalItems",
	"layout",
	"legend",
	"margin",
	"options",
	"polarAxes",
	"polarOptions",
	"referenceElements",
	"renderedTicks",
	"rootProps",
	"tooltip",
	"zIndex",
] as const satisfies ReadonlyArray<keyof ChartState>

describe("ChartState full shape", () => {
	it("createInitialChartState includes every ChartState key", () => {
		const state = createInitialChartState()
		for (const key of CHART_STATE_KEYS) {
			expect(state).toHaveProperty(key)
		}
		expect(Object.keys(state).sort()).toEqual([...CHART_STATE_KEYS].sort())
	})

	it("two calls do not share nested object identity", () => {
		const a = createInitialChartState()
		const b = createInitialChartState()

		expect(a).not.toBe(b)
		expect(a.layout).not.toBe(b.layout)
		expect(a.layout.margin).not.toBe(b.layout.margin)
		expect(a.margin).not.toBe(b.margin)
		expect(a.margin).not.toBe(a.layout.margin)
		expect(a.chartSize).not.toBe(b.chartSize)
		expect(a.chartData).not.toBe(b.chartData)
		expect(a.errorBars).not.toBe(b.errorBars)
		expect(a.eventSettings).not.toBe(b.eventSettings)
		expect(a.eventSettings.throttledEvents).not.toBe(b.eventSettings.throttledEvents)
		expect(a.options).not.toBe(b.options)
		expect(a.referenceElements).not.toBe(b.referenceElements)
		expect(a.referenceElements.areas).not.toBe(b.referenceElements.areas)
		expect(a.referenceElements.dots).not.toBe(b.referenceElements.dots)
		expect(a.referenceElements.lines).not.toBe(b.referenceElements.lines)
		expect(a.rootProps).not.toBe(b.rootProps)
		expect(a.zIndex).not.toBe(b.zIndex)
		expect(a.zIndex.zIndexMap).not.toBe(b.zIndex.zIndexMap)
		expect(a.renderedTicks).not.toBe(b.renderedTicks)
		expect(a.renderedTicks.xAxis).not.toBe(b.renderedTicks.xAxis)
		expect(a.legend.settings).not.toBe(b.legend.settings)
		expect(a.cartesianAxes.xAxis).not.toBe(b.cartesianAxes.xAxis)
		expect(a.polarAxes.angleAxis).not.toBe(b.polarAxes.angleAxis)
		expect(a.graphicalItems).not.toBe(b.graphicalItems)
		expect(a.animation).not.toBe(b.animation)
		expect(a.brush.padding).not.toBe(b.brush.padding)
	})

	it("function-valued fields survive factory construction", () => {
		const sorter = () => 0
		const searcher = () => undefined
		const state = createInitialChartState({
			legend: {
				payload: [],
				settings: {
					align: "center",
					itemSorter: sorter,
					layout: "horizontal",
					offset: 0,
					position: "top",
					verticalAlign: "bottom",
				},
				size: { height: 0, width: 0 },
			},
			options: {
				chartName: "LineChart",
				defaultTooltipEventType: "axis",
				eventEmitter: undefined,
				tooltipPayloadSearcher: searcher,
			},
		})
		expect(state.legend.settings.itemSorter).toBe(sorter)
		expect(state.options.tooltipPayloadSearcher).toBe(searcher)
		expect(state.legend.settings.position).toBe("top")
		expect(state.legend.settings.offset).toBe(0)
	})

	it("layout is ChartLayoutState and animation defaults to auto", () => {
		const state = createInitialChartState()
		expect(state.layout.layoutType).toBe("horizontal")
		expect(state.layout.scale).toBe(1)
		expect(state.layout.width).toBe(0)
		expect(state.layout.height).toBe(0)
		expect(state.animation.isAnimationActive).toBe("auto")
		expect(state.polarOptions).toBeNull()
		expect(state.legend.settings.offset).toBe(0)
		expect(state.legend.settings.position).toBeUndefined()
	})

	it("XAxisSettings.height accepts auto", () => {
		const settings: XAxisSettings = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: "x",
			domain: undefined,
			height: "auto",
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
		expect(settings.height).toBe("auto")
	})
})
