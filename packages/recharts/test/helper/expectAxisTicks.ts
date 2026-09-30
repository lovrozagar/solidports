import { expect } from "vitest"
import { createEffect } from "solid-js"
import { assertNotNull } from "./assertNotNull"
import type { AxisId } from "../../src/state/cartesianAxisSlice"
import { selectAxisScale } from "../../src/state/selectors/axisSelectors"
import { useAppSelector } from "../helper/legacyDispatch"

export type ExpectedTick = {
	textContent: string
	x: string
	y: string
}

function normalizeDateString(str: string | null) {
	if (str == null) return str
	return str.replace(/\(.*?\)/, "(Coordinated Universal Time)")
}

export function expectXAxisTicks(container: Element, expectedTicks: ReadonlyArray<ExpectedTick>) {
	const allTicks = container.querySelectorAll(
		".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value",
	)
	assertNotNull(allTicks)
	const ticksContexts = Array.from(allTicks).map((tick) => ({
		textContent: normalizeDateString(tick.textContent),
		x: tick.getAttribute("x"),
		y: tick.getAttribute("y"),
	}))
	expect(ticksContexts).toEqual(expectedTicks)
}

export function expectYAxisTicks(container: Element, ticks: ReadonlyArray<ExpectedTick>) {
	const allTicks = container.querySelectorAll(
		".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
	)
	assertNotNull(allTicks)
	const ticksContexts = Array.from(allTicks).map((tick) => ({
		textContent: normalizeDateString(tick.textContent),
		x: tick.getAttribute("x"),
		y: tick.getAttribute("y"),
	}))
	expect(ticksContexts).toEqual(ticks)
}

export function ExpectAxisDomain(props: {
	assert: (domainFromStore: ReadonlyArray<unknown> | undefined) => void
	axisId?: AxisId
	axisType: "xAxis" | "yAxis"
}): null {
	/* createEffect tracks scale reactively — graphical-item dispatch lands AFTER setup,
	   so a setup-time read sees `undefined`. Spy needs to reflect the latest value, not
	   the first one. Plain useAppSelector returns a fresh RechartsScale wrapper each call
	   (closures over d3 scale) — useAppSelectorWithStableTest's structural .toEqual fails
	   on those function-typed properties; see GOTCHA-003. */
	createEffect(() => {
		const scale = useAppSelector((state) =>
			selectAxisScale(state, props.axisType, props.axisId ?? 0, false),
		)
		props.assert(scale?.domain())
	})
	return null
}
