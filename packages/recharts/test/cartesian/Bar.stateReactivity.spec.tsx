/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { BarChart, Bar, XAxis, YAxis } from "../../src"
import { useChartState } from "../../src/state/_solid/useChartState"
import { selectBarRectangles } from "../../src/state/selectors/barSelectors"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

describe("Phase 3 — Bar reads from new chartState", () => {
	it("Bar renders rectangles when new chartState axis is populated on mount", () => {
		const { container } = render(() => (
			<BarChart width={300} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
			</BarChart>
		))
		expect(container.querySelector(".recharts-bar-rectangle")).not.toBeNull()
	})

	it("setState on cartesianAxes.yAxis[0].settings.domain re-renders the bars synchronously", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<BarChart width={300} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis domain={[0, 300]} />
				<Bar dataKey="value" isAnimationActive={false} />
				<Capture />
			</BarChart>
		))

		const firstPath = container.querySelector(".recharts-bar .recharts-bar-rectangle path.recharts-rectangle")
		const before = firstPath?.getAttribute("d")
		expect(before).toBeTruthy()

		/* Phase 3 RED: Bar reads via legacy selectBarRectangles which untrack()s the _solid
		   probe — new-state domain mutation never triggers the component's createMemo.
		   Phase 3 GREEN: component reads state.cartesianAxes.yAxis["0"].settings directly
		   inside createMemo → mutation triggers synchronous re-render, bar paths change. */
		capturedSetState!("cartesianAxes", "yAxis", "0", "settings" as never, "domain" as never, [0, 9000] as never)

		const after = container.querySelector(".recharts-bar .recharts-bar-rectangle path.recharts-rectangle")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.maxBarSize re-derives rectangle widths", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		const { container } = render(() => (
			<BarChart width={300} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" id="bar-0" isAnimationActive={false} />
				<Capture />
			</BarChart>
		))

		const firstPath = container.querySelector(".recharts-bar .recharts-bar-rectangle path.recharts-rectangle")
		const before = firstPath?.getAttribute("d")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "bar-0"

		/* Phase 3 RED: component does not subscribe to state.graphicalItems — maxBarSize
		   mutation is ignored, bar path unchanged.
		   Phase 3 GREEN: component reads state.graphicalItems[id]?.settings.maxBarSize
		   inside createMemo → re-derives rectangles synchronously, path width changes. */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "maxBarSize" as never, 5 as never)

		const after = container.querySelector(".recharts-bar .recharts-bar-rectangle path.recharts-rectangle")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("legacy selectBarRectangles still exports a callable function (hook-compat)", () => {
		/* Arity: state + id + isPanorama + cells = 4 minimum. */
		expect(typeof selectBarRectangles).toBe("function")
		expect(selectBarRectangles.length).toBeGreaterThanOrEqual(4)
	})
})
