/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { LineChart, Line, XAxis, YAxis } from "../../src"
import { useChartState } from "../../src/state/_solid/useChartState"
import { selectLinePoints } from "../../src/state/selectors/lineSelectors"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../src/state/_solid/chartState"

/* Numeric data so a number-type XAxis with domain produces a real path. */
const data = [
	{ x: 10, value: 100 },
	{ x: 20, value: 200 },
	{ x: 30, value: 300 },
]

describe("Phase 3 — Line reads from new chartState", () => {
	it("Line renders when new chartState axis is populated on mount", () => {
		const { container } = render(() => (
			<LineChart width={300} height={200} data={data}>
				<XAxis dataKey="x" type="number" />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} />
			</LineChart>
		))
		expect(container.querySelector(".recharts-line-curve")).not.toBeNull()
	})

	it("setState on cartesianAxes.xAxis[0].settings.domain re-renders the line synchronously", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<LineChart width={300} height={200} data={data}>
				<XAxis dataKey="x" type="number" domain={[0, 30]} />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} />
				<Capture />
			</LineChart>
		))

		const before = container.querySelector(".recharts-line-curve")?.getAttribute("d")
		expect(before).toBeTruthy()

		/* Phase 3 RED: Line reads via legacy selectLinePoints which untrack()s the _solid
		   probe — new-state domain mutation never triggers the component's createMemo.
		   Phase 3 GREEN: component reads state.cartesianAxes.xAxis["0"].settings directly
		   inside createMemo → mutation triggers synchronous re-render. */
		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "domain" as never, [0, 300] as never)

		const after = container.querySelector(".recharts-line-curve")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.dataKey re-renders the line", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		/* Two distinct dataKey values that produce different path shapes on this data. */
		const { container } = render(() => (
			<LineChart width={300} height={200} data={data}>
				<XAxis dataKey="x" type="number" />
				<YAxis />
				<Line dataKey="value" id="line-0" isAnimationActive={false} />
				<Capture />
			</LineChart>
		))

		const before = container.querySelector(".recharts-line-curve")?.getAttribute("d")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "line-0"

		/* Phase 3 RED: component createMemo does not subscribe to state.graphicalItems —
		   mutation is ignored, path d stays identical.
		   Phase 3 GREEN: component reads state.graphicalItems[id]?.settings.dataKey → re-render.
		   "x" (values 10/20/30) produces a different curve than "value" (100/200/300). */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "dataKey" as never, "x" as never)

		const after = container.querySelector(".recharts-line-curve")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("legacy selectLinePoints still exports a callable function (hook-compat)", () => {
		/* Arity: state + xAxisId + yAxisId + isPanorama + id = 5 params. */
		expect(typeof selectLinePoints).toBe("function")
		expect(selectLinePoints.length).toBeGreaterThanOrEqual(4)
	})
})
