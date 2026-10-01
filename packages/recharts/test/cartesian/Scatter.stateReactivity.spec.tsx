/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { ScatterChart, Scatter, XAxis, YAxis } from "../../src"
import { useChartState } from "../../src/state/useChartState"
import { selectScatterPoints } from "../../src/state/selectors/scatterSelectors"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../src/state/chartState"

/* x and y differ in magnitude so switching dataKey produces a visually distinct translate. */
const data = [
	{ x: 10, y: 500, z: 64 },
	{ x: 20, y: 600, z: 64 },
	{ x: 30, y: 700, z: 64 },
]

describe("Phase 3 — Scatter reads from new chartState", () => {
	it("Scatter renders symbols when new chartState axis is populated on mount", () => {
		const { container } = render(() => (
			<ScatterChart width={300} height={300}>
				<XAxis dataKey="x" type="number" />
				<YAxis dataKey="y" type="number" />
				<Scatter data={data} dataKey="x" isAnimationActive={false} />
			</ScatterChart>
		))
		expect(container.querySelector(".recharts-symbols")).not.toBeNull()
	})

	it("setState on cartesianAxes.xAxis[0].settings.domain re-renders scatter symbols synchronously", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<ScatterChart width={300} height={300}>
				<XAxis dataKey="x" type="number" domain={[0, 30]} />
				<YAxis dataKey="y" type="number" />
				<Scatter data={data} dataKey="x" isAnimationActive={false} />
				<Capture />
			</ScatterChart>
		))

		const firstSymbol = container.querySelector(".recharts-symbols")
		const before = firstSymbol?.getAttribute("transform")
		expect(before).toBeTruthy()

		/* Phase 3 RED: Scatter reads via legacy selectScatterPoints which untrack()s the
		   _solid probe — new-state domain mutation never triggers re-render.
		   Phase 3 GREEN: component reads state.cartesianAxes.xAxis["0"].settings directly
		   inside createMemo → mutation triggers synchronous re-render, translate changes. */
		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "domain" as never, [0, 3000] as never)

		const after = container.querySelector(".recharts-symbols")?.getAttribute("transform")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.dataKey re-renders the scatter", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		/* No dataKey on axes — scatter's own dataKey drives coordinate lookup.
		   Changing scatter.dataKey "x"→"y" switches from x-values (10/20/30)
		   to y-values (500/600/700) producing visually distinct positions. */
		const { container } = render(() => (
			<ScatterChart width={300} height={300}>
				<XAxis type="number" />
				<YAxis type="number" />
				<Scatter data={data} dataKey="x" id="scatter-0" isAnimationActive={false} />
				<Capture />
			</ScatterChart>
		))

		const firstSymbol = container.querySelector(".recharts-symbols")
		const before = firstSymbol?.getAttribute("transform")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "scatter-0"

		/* Phase 3 RED: component createMemo does not subscribe to state.graphicalItems.
		   Phase 3 GREEN: reads state.graphicalItems[id]?.settings.dataKey → re-render.
		   "y" (500/600/700) maps to very different pixel positions than "x" (10/20/30). */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "dataKey" as never, "y" as never)

		const after = container.querySelector(".recharts-symbols")?.getAttribute("transform")
		expect(after).not.toBe(before)
	})

	it("legacy selectScatterPoints still exports a callable function (hook-compat)", () => {
		/* Arity: state + xAxisId + yAxisId + zAxisId + id + cells + isPanorama = 7. */
		expect(typeof selectScatterPoints).toBe("function")
		expect(selectScatterPoints.length).toBeGreaterThanOrEqual(6)
	})
})
