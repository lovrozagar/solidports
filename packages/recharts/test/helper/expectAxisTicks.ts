import { expect } from "vitest"
import { trackSpy } from "./trackSpy"
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
	/* Graphical-item dispatch lands after setup, so the spy must see every later value.
	   Plain useAppSelector returns a fresh RechartsScale wrapper each call (closures over
	   the d3 scale); compare domains, not scales. See GOTCHA-003. */
	trackSpy(props.assert, () =>
		useAppSelector((state) => selectAxisScale(state, props.axisType, props.axisId ?? 0, false))?.domain(),
	)
	return null
}
