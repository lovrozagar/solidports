/* @jsxImportSource @solidjs/web */
import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { render } from "../helper/render"
import { AreaChart, Area, XAxis, YAxis } from "../../src"
import { useChartState } from "../../src/state/useChartState"
import { selectArea } from "../../src/state/selectors/areaSelectors"
import type { ChartState } from "../../src/state/chartState"

import { type SetStoreFunction } from '../../src/util/solid-1-compat';
const data = [
	{ x: 10, value: 100 },
	{ x: 20, value: 200 },
	{ x: 30, value: 300 },
]

describe("Phase 3 — Area reads from new chartState", () => {
	it("Area renders when new chartState axis is populated on mount", () => {
		const { container } = render(() => (
			<AreaChart width={300} height={200} data={data}>
				<XAxis dataKey="x" type="number" />
				<YAxis />
				<Area dataKey="value" isAnimationActive={false} />
			</AreaChart>
		))
		expect(container.querySelector(".recharts-area-curve")).not.toBeNull()
	})

	it("setState on cartesianAxes.yAxis[0].settings.domain re-renders the area synchronously", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<AreaChart width={300} height={200} data={data}>
				<XAxis dataKey="x" type="number" />
				<YAxis domain={[0, 300]} />
				<Area dataKey="value" isAnimationActive={false} />
				<Capture />
			</AreaChart>
		))

		const before = container.querySelector(".recharts-area-curve")?.getAttribute("d")
		expect(before).toBeTruthy()

		/* Phase 3 RED: Area reads via legacy selectArea which untrack()s the _solid probe.
		   Mutation to new chartState yAxis[0].settings.domain never triggers re-render.
		   Phase 3 GREEN: component reads state.cartesianAxes.yAxis["0"].settings directly
		   inside createMemo → synchronous re-render on mutation. */
		capturedSetState!("cartesianAxes", "yAxis", "0", "settings" as never, "domain" as never, [0, 5000] as never)
		flush()

		const after = container.querySelector(".recharts-area-curve")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.dataKey re-renders the area", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		const { container } = render(() => (
			<AreaChart width={300} height={200} data={data}>
				<XAxis dataKey="x" type="number" />
				<YAxis />
				<Area dataKey="value" id="area-0" isAnimationActive={false} />
				<Capture />
			</AreaChart>
		))

		const before = container.querySelector(".recharts-area-curve")?.getAttribute("d")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "area-0"

		/* Phase 3 RED: component createMemo does not subscribe to state.graphicalItems.
		   Phase 3 GREEN: reads state.graphicalItems[id]?.settings.dataKey → re-render.
		   "x" (values 10/20/30) produces a different curve than "value" (100/200/300). */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "dataKey" as never, "x" as never)
		flush()

		const after = container.querySelector(".recharts-area-curve")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("legacy selectArea still exports a callable function (hook-compat)", () => {
		/* Arity: state + id + isPanorama = 3 minimum. */
		expect(typeof selectArea).toBe("function")
		expect(selectArea.length).toBeGreaterThanOrEqual(3)
	})
})
