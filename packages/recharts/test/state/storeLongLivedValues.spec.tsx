import { describe, expect, it } from "vitest"
import { render } from "../helper/render"
import { BarChart, Bar, Sankey, Scatter, ScatterChart, Treemap, XAxis } from "../../src"
import { xAxisDefaultProps } from "../../src/cartesian/XAxis"
import { useChartState } from "../../src/state/useChartState"
import type { ChartState } from "../../src/state/chartState"

/*
 * Solid's store maps every raw object it wraps to its target in one global WeakMap, and a
 * target links to its parent. A long-lived object (module constant, user constant) wrapped by
 * a chart store keeps that whole store, and the chart it reaches, alive after unmount, and a
 * second store wrapping the same object is handed the first store's proxy. Long-lived values
 * must reach a store either raw (served by reference) or as a per-chart copy.
 */
function expectNotPinned(first: unknown, second: unknown, raw: unknown): void {
	if (first === raw && second === raw) return
	expect(first === second, "store proxy shared across charts").toBe(false)
}

const stores: ChartState[] = []
function Probe(): null {
	stores.push(useChartState().state)
	return null
}

const scatterData = [
	{ x: 1, y: 2 },
	{ x: 3, y: 4 },
]
const sankeyData = {
	links: [{ source: 0, target: 1, value: 1 }],
	nodes: [{ name: "a" }, { name: "b" }],
}
const treemapData = [{ name: "a", size: 1 }]

describe("long-lived values entering a chart store", () => {
	it("serves item data and default axis padding without pinning a store", () => {
		stores.length = 0
		const chart = () => (
			<ScatterChart width={100} height={100}>
				<XAxis dataKey="x" />
				<Scatter data={scatterData} dataKey="y" />
				<Probe />
			</ScatterChart>
		)
		render(chart)
		render(chart)
		const [a, b] = stores as [ChartState, ChartState]
		const itemData = (s: ChartState) => Object.values(s.graphicalItems)[0]?.settings.data
		expect(itemData(a) === scatterData, "item data served raw").toBe(true)
		expect(itemData(b) === scatterData, "item data served raw").toBe(true)
		const padding = (s: ChartState) => Object.values(s.cartesianAxes.xAxis)[0]?.settings.padding
		expect(padding(a)).toEqual(xAxisDefaultProps.padding)
		expectNotPinned(padding(a), padding(b), xAxisDefaultProps.padding)
	})

	it("gives every cartesian chart its own tooltip event type list", () => {
		stores.length = 0
		const chart = () => (
			<BarChart width={100} height={100} data={scatterData}>
				<Bar dataKey="y" />
				<Probe />
			</BarChart>
		)
		render(chart)
		render(chart)
		const [a, b] = stores as [ChartState, ChartState]
		expect([...(a.options.validateTooltipEventTypes ?? [])]).toEqual(["axis", "item"])
		expectNotPinned(a.options.validateTooltipEventTypes, b.options.validateTooltipEventTypes, undefined)
	})

	it("gives every Treemap and Sankey its own options", () => {
		stores.length = 0
		render(() => (
			<Treemap width={100} height={100} data={treemapData} dataKey="size" isAnimationActive={false}>
				<Probe />
			</Treemap>
		))
		render(() => (
			<Treemap width={100} height={100} data={treemapData} dataKey="size" isAnimationActive={false}>
				<Probe />
			</Treemap>
		))
		render(() => (
			<Sankey width={100} height={100} data={sankeyData}>
				<Probe />
			</Sankey>
		))
		render(() => (
			<Sankey width={100} height={100} data={sankeyData}>
				<Probe />
			</Sankey>
		))
		const [t1, t2, s1, s2] = stores as [ChartState, ChartState, ChartState, ChartState]
		expect(t1.options.chartName).toBe("Treemap")
		expect(s1.options.chartName).toBe("Sankey")
		expectNotPinned(t1.options, t2.options, undefined)
		expectNotPinned(s1.options, s2.options, undefined)
		expectNotPinned(t1.options.validateTooltipEventTypes, t2.options.validateTooltipEventTypes, undefined)
	})
})
