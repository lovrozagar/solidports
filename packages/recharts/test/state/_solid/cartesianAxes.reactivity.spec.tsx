/* @jsxImportSource @solidjs/web */
import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { observe } from "../../helper/observe"
import { render } from "../../helper/render"
import type { JSX } from '@solidjs/web';

import { useChartState } from "../../../src/state/useChartState"
import { LineChart, XAxis, YAxis, Line } from "../../../src"

/* Reads xAxis[id].settings.dataKey from new chartState. */
const XAxisReader = (props: { axisId: string }): JSX.Element => {
	const { state } = useChartState()
	return (
		<span data-testid={`x-reader-${props.axisId}`}>
			{String(state.cartesianAxes.xAxis[props.axisId]?.settings?.dataKey ?? "__missing__")}
		</span>
	)
}

/* Reads yAxis[id].settings.dataKey from new chartState. */
const YAxisReader = (props: { axisId: string }): JSX.Element => {
	const { state } = useChartState()
	return (
		<span data-testid={`y-reader-${props.axisId}`}>
			{String(state.cartesianAxes.yAxis[props.axisId]?.settings?.dataKey ?? "__missing__")}
		</span>
	)
}

const data = [{ x: 1, value: 10 }]

describe("Phase 2 — cartesianAxes dual-write reactivity", () => {
	it("XAxis dual-writes to new chartState on mount", () => {
		const { getByTestId } = render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="x" xAxisId="0" />
				<Line dataKey="value" />
				<XAxisReader axisId="0" />
			</LineChart>
		))
		/* Fails RED: XAxis.tsx does not yet write to new chartState — returns "__missing__". */
		expect(getByTestId("x-reader-0").textContent).toBe("x")
	})

	it("setState mutation propagates to XAxis component synchronously", () => {
		let capturedSetState: ReturnType<typeof useChartState>["setState"] | undefined

		const CaptureSetState = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			return null
		}

		const { getByTestId } = render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="x" xAxisId="0" />
				<Line dataKey="value" />
				<XAxisReader axisId="0" />
				<CaptureSetState />
			</LineChart>
		))

		/* Fails RED: XAxis.tsx never writes initial entry, so neither initial nor
		   manual write reaches the reader in the expected shape. */
		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, { dataKey: "y" } as never)
		flush()
		expect(getByTestId("x-reader-0").textContent).toBe("y")
	})

	it("multiple XAxis instances each write their own id", () => {
		const { getByTestId } = render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis xAxisId="0" dataKey="a" />
				<XAxis xAxisId="bottom" dataKey="b" />
				<Line dataKey="value" xAxisId="0" />
				<XAxisReader axisId="0" />
				<XAxisReader axisId="bottom" />
			</LineChart>
		))
		/* Fails RED: XAxis.tsx does not yet write to new chartState. */
		expect(getByTestId("x-reader-0").textContent).toBe("a")
		expect(getByTestId("x-reader-bottom").textContent).toBe("b")
	})

	it("panorama (Brush sub-chart) does NOT mount nested RechartsStateProvider", () => {
		/* Strategy: capture setState from outer chart, mutate xAxis sentinel key,
		   assert panorama probe (also using useChartState) sees the same mutation.
		   Fails RED: panorama early-return guard not yet added to RechartsStateProvider. */
		let outerSetState: ReturnType<typeof useChartState>["setState"] | undefined
		const outerSpy: unknown[] = []
		const panoramaSpy: unknown[] = []

		const OuterCapture = (): null => {
			const ctx = useChartState()
			outerSetState = ctx.setState
			observe(() => {
				outerSpy.push(ctx.state.cartesianAxes.xAxis["__panorama_probe__"]?.settings?.dataKey)
			})
			return null
		}

		/* Panorama probe: mounted inside Brush sub-chart, must share the same context. */
		const PanoramaProbe = (): null => {
			const ctx = useChartState()
			observe(() => {
				panoramaSpy.push(ctx.state.cartesianAxes.xAxis["__panorama_probe__"]?.settings?.dataKey)
			})
			return null
		}

		/* Brush is imported lazily to avoid circular-dep lint — import inline. */
		const { Brush } = require("../../../src") as { Brush: typeof import("../../../src").Brush }

		render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="x" />
				<Line dataKey="value" />
				<Brush>
					<PanoramaProbe />
				</Brush>
				<OuterCapture />
			</LineChart>
		))

		outerSetState!("cartesianAxes", "xAxis", "__panorama_probe__", "settings" as never, { dataKey: "shared" } as never)
		flush()

		/* Both arrays must contain "shared" — same context, same state. */
		expect(panoramaSpy).toContain("shared")
	})

	it("YAxis dual-writes to new chartState on mount", () => {
		const { getByTestId } = render(() => (
			<LineChart width={400} height={200} data={data}>
				<YAxis dataKey="value" yAxisId="0" />
				<Line dataKey="value" />
				<YAxisReader axisId="0" />
			</LineChart>
		))
		/* Fails RED: YAxis.tsx does not yet write to new chartState. */
		expect(getByTestId("y-reader-0").textContent).toBe("value")
	})
})
