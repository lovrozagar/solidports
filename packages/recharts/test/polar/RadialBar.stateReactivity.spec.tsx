/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { RadialBarChart, RadialBar, PolarAngleAxis, PolarRadiusAxis } from "../../src"
import { useChartState } from "../../src/state/_solid/useChartState"
import { selectRadialBarSectors } from "../../src/state/selectors/radialBarSelectors"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 30 },
	{ name: "B", value: 60 },
	{ name: "C", value: 90 },
]

describe("Phase 4 — RadialBar reads from new chartState", () => {
	it("RadialBar renders sectors when mounted inside RadialBarChart", () => {
		const { container } = render(() => (
			<RadialBarChart width={400} height={400} data={data}>
				<RadialBar dataKey="value" isAnimationActive={false} />
			</RadialBarChart>
		))
		expect(container.querySelector(".recharts-radial-bar-sector")).not.toBeNull()
	})

	it("setState on polarAxes.angleAxis[id].settings mutation re-renders radialBar sectors", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<RadialBarChart width={400} height={400} data={data}>
				<PolarAngleAxis type="number" domain={[0, 100]} angleAxisId="0" />
				<RadialBar dataKey="value" angleAxisId="0" isAnimationActive={false} />
				<Capture />
			</RadialBarChart>
		))

		const before = container.querySelector(".recharts-radial-bar-sector")?.getAttribute("d")
		expect(before).toBeTruthy()

		/* Phase 4 RED: RadialBar reads via legacy store — new chartState angleAxis mutation
		   never triggers the component's createMemo.
		   Phase 4 GREEN: component reads state.polarAxes.angleAxis["0"].settings inside
		   createMemo, sector paths change on mutation. */
		capturedSetState!("polarAxes", "angleAxis", "0", "settings" as never, { domain: [0, 200] } as never)

		const after = container.querySelector(".recharts-radial-bar-sector")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("setState on polarAxes.radiusAxis[id].settings mutation re-renders radialBar sectors", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<RadialBarChart width={400} height={400} data={data}>
				<PolarRadiusAxis radiusAxisId="0" />
				<RadialBar dataKey="value" radiusAxisId="0" isAnimationActive={false} />
				<Capture />
			</RadialBarChart>
		))

		const before = container.querySelector(".recharts-radial-bar-sector")?.getAttribute("d")
		expect(before).toBeTruthy()

		/* Phase 4 RED: radiusAxis mutation in new chartState not tracked by RadialBar.
		   Phase 4 GREEN: mutation triggers re-render, sector paths change. */
		capturedSetState!("polarAxes", "radiusAxis", "0", "settings" as never, { domain: [0, 500] } as never)

		const after = container.querySelector(".recharts-radial-bar-sector")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.maxBarSize re-derives sector widths", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		const { container } = render(() => (
			<RadialBarChart width={400} height={400} data={data}>
				<RadialBar dataKey="value" isAnimationActive={false} />
				<Capture />
			</RadialBarChart>
		))

		const before = container.querySelector(".recharts-radial-bar-sector")?.getAttribute("d")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "radialBar-0"

		/* Phase 4 RED: graphicalItems[id].settings.maxBarSize mutation ignored by RadialBar.
		   Phase 4 GREEN: mutation triggers re-render, sector widths (d attr) change. */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "maxBarSize" as never, 5 as never)

		const after = container.querySelector(".recharts-radial-bar-sector")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("legacy selectRadialBarSectors exports a callable function (hook-compat)", () => {
		expect(typeof selectRadialBarSectors).toBe("function")
		expect(selectRadialBarSectors.length).toBeGreaterThanOrEqual(4)
	})
})
