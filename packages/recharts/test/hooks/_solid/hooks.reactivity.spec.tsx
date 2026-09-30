/* @jsxImportSource solid-js */
import { createMemo, createRenderEffect, on } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { render } from "@solidjs/testing-library"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../../src/state/_solid/chartState"
import { useChartState } from "../../../src/state/_solid/useChartState"
import {
	useIsTooltipActive,
	useActiveTooltipCoordinate,
	useXAxisScale,
	useYAxisScale,
	useCartesianScale,
	useXAxisInverseScale,
	useYAxisInverseScale,
	useXAxisInverseTickSnapScale,
	useYAxisInverseTickSnapScale,
	useXAxisTicks,
	useYAxisTicks,
} from "../../../src/hooks"
import { LineChart, XAxis, YAxis, Line } from "../../../src"

const data = [
	{ x: 0, y: 10 },
	{ x: 1, y: 20 },
	{ x: 2, y: 30 },
]

/* Wraps a hook call in a reactive memo so spy fires on every re-run. */
function makeProbe<T>(hook: () => T, spy: (v: T) => void): () => null {
	return (): null => {
		const value = createMemo<T>(() => hook())
		createRenderEffect(on(value, (v) => spy(v)))
		return null
	}
}

function flush(): void {
	vi.advanceTimersByTime(0)
}

/* Chart with a numeric xAxis + explicit yAxis domain so both axes exist in legacy store. */
function renderNumericChart(
	captureSetState: (s: SetStoreFunction<ChartState>) => void,
	extra: () => null,
) {
	return render(() => (
		<LineChart width={400} height={200} data={data}>
			<XAxis dataKey="x" type="number" domain={[0, 2]} />
			<YAxis domain={[0, 30]} tickCount={3} />
			<Line dataKey="y" isAnimationActive={false} />
			{(() => {
				const ctx = useChartState()
				if (ctx != null) captureSetState(ctx.setState)
				return extra()
			})()}
		</LineChart>
	))
}

describe("Phase 6 RED — public hooks reactive to new chartState mutations", () => {
	/*
	 * RED condition: hook body reads ONLY the legacy store (useChartStore).
	 * Writing to new chartState via capturedSetState must NOT trigger re-run
	 * of the hook's tracking scope, because the hook never reads the new-state
	 * proxy. After Phase 6 Step 2–3 each hook adds a `void newCtx.state.x`
	 * subscription read so the mutation DOES trigger re-run → tests turn GREEN.
	 *
	 * Assertion shape (same for all 11):
	 *   expect(calls.length).toBeGreaterThan(countBefore)
	 * RED  (now): hook never reads new state → spy silent → calls.length === countBefore → FAIL ✓
	 * GREEN (after Step 2-3): hook subscribes to new state → spy fires → calls.length++ → PASS ✓
	 *
	 * Mutation target: a settings field that is NOT dual-written to the legacy store
	 * after initial mount. `settings.hide` on the axis is set once at mount via
	 * XAxis/YAxis props; subsequent `capturedSetState` writes go to new chartState only.
	 * Legacy axis selectors never re-read `hide` from new state → zero legacy re-runs.
	 */

	it("useIsTooltipActive NOT reactive to new-state-only tooltip.settings.active mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: boolean[] = []

		const Probe = makeProbe(useIsTooltipActive, (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)

		/* Write ONLY to new chartState — NOT dual-written to legacy tooltipSlice.
		   After Phase 6 Step 2: hook adds `void newCtx.state.tooltip.settings.active`
		   subscription → spy fires again → calls.length > countBefore (GREEN).
		   Before Step 2: hook never reads new state → spy silent → RED. */
		capturedSetState!("tooltip", "settings", "active", true)
		flush()

		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useActiveTooltipCoordinate NOT reactive to new-state-only tooltip.settings.active mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useActiveTooltipCoordinate>> = []

		const Probe = makeProbe(useActiveTooltipCoordinate, (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)

		capturedSetState!("tooltip", "settings", "active", true)
		flush()

		/* RED: hook reads legacy coordinate only; new-state active flip not tracked */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useXAxisScale NOT reactive to new-state-only xAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useXAxisScale>> = []

		const Probe = makeProbe(() => useXAxisScale(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()

		/* Write to new chartState only — legacy store xAxis entry unchanged after initial mount.
		   After Phase 6 Step 3: hook adds `void newCtx.state.cartesianAxes.xAxis["0"]?.settings`
		   → memo re-runs → spy fires → GREEN. Before: spy silent → RED. */
		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useYAxisScale NOT reactive to new-state-only yAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useYAxisScale>> = []

		const Probe = makeProbe(() => useYAxisScale(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()

		capturedSetState!("cartesianAxes", "yAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: legacy yAxis selector does not read hide flag on new state */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useCartesianScale NOT reactive to new-state-only xAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useCartesianScale>> = []

		const Probe = makeProbe(() => useCartesianScale({ x: 1, y: 20 }), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)

		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: composed hook inherits non-reactive useXAxisScale */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useXAxisInverseScale NOT reactive to new-state-only xAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useXAxisInverseScale>> = []

		const Probe = makeProbe(() => useXAxisInverseScale(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()

		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: inverse fn derived from legacy scale; new-state mutation not tracked */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useYAxisInverseScale NOT reactive to new-state-only yAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useYAxisInverseScale>> = []

		const Probe = makeProbe(() => useYAxisInverseScale(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()

		capturedSetState!("cartesianAxes", "yAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: legacy inverse fn unaffected by new-state hide flag */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useXAxisInverseTickSnapScale NOT reactive to new-state-only xAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useXAxisInverseTickSnapScale>> = []

		const Probe = makeProbe(() => useXAxisInverseTickSnapScale(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()

		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: snap fn derived from legacy ticks; new-state hide flag not tracked */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useYAxisInverseTickSnapScale NOT reactive to new-state-only yAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useYAxisInverseTickSnapScale>> = []

		const Probe = makeProbe(() => useYAxisInverseTickSnapScale(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()

		capturedSetState!("cartesianAxes", "yAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: snap fn from legacy ticks; new-state hide flag not tracked */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useXAxisTicks NOT reactive to new-state-only xAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useXAxisTicks>> = []

		const Probe = makeProbe(() => useXAxisTicks(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()
		expect(calls.at(-1)!.length).toBeGreaterThan(0)

		capturedSetState!("cartesianAxes", "xAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: hook reads legacy ticks; new-state hide flag not tracked → spy silent */
		expect(calls.length).toBeGreaterThan(countBefore)
	})

	it("useYAxisTicks NOT reactive to new-state-only yAxis settings mutation", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		const calls: Array<ReturnType<typeof useYAxisTicks>> = []

		const Probe = makeProbe(() => useYAxisTicks(0), (v) => calls.push(v))

		renderNumericChart((s) => { capturedSetState = s }, Probe)
		flush()

		const countBefore = calls.length
		expect(countBefore).toBeGreaterThan(0)
		expect(calls.at(-1)).toBeDefined()
		expect(calls.at(-1)!.length).toBeGreaterThan(0)

		capturedSetState!("cartesianAxes", "yAxis", "0", "settings" as never, "hide" as never, true as never)
		flush()

		/* RED: hook reads legacy ticks; new-state hide flag not tracked → spy silent */
		expect(calls.length).toBeGreaterThan(countBefore)
	})
})
