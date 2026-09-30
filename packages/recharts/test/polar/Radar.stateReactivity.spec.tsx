/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { RadarChart, Radar, PolarAngleAxis, PolarRadiusAxis } from "../../src"
import { useChartState } from "../../src/state/_solid/useChartState"
import { selectRadarPoints } from "../../src/state/selectors/radarSelectors"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../src/state/_solid/chartState"

const data = [
	{ subject: "Math", value: 120 },
	{ subject: "English", value: 98 },
	{ subject: "Physics", value: 86 },
	{ subject: "History", value: 99 },
]

describe("Phase 4 — Radar reads from new chartState", () => {
	it("Radar renders a polygon when mounted inside RadarChart", () => {
		const { container } = render(() => (
			<RadarChart width={400} height={400} data={data}>
				<PolarAngleAxis dataKey="subject" />
				<PolarRadiusAxis />
				<Radar dataKey="value" isAnimationActive={false} />
			</RadarChart>
		))
		expect(container.querySelector(".recharts-radar-polygon")).not.toBeNull()
	})

	it("setState on polarAxes.angleAxis[id].settings mutation re-renders radar polygon", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<RadarChart width={400} height={400} data={data}>
				<PolarAngleAxis dataKey="subject" angleAxisId="0" />
				<PolarRadiusAxis />
				<Radar dataKey="value" angleAxisId="0" isAnimationActive={false} />
				<Capture />
			</RadarChart>
		))

		const before = container.querySelector(".recharts-radar-polygon")?.getAttribute("points")
		expect(before).toBeTruthy()

		/* Phase 4 RED: Radar reads via legacy store — new chartState angleAxis mutation
		   never triggers the component's createMemo.
		   Phase 4 GREEN: component reads state.polarAxes.angleAxis["0"].settings inside
		   createMemo, polygon points change on mutation. */
		capturedSetState!("polarAxes", "angleAxis", "0", "settings" as never, { dataKey: "subject", domain: [0, 200] } as never)

		const after = container.querySelector(".recharts-radar-polygon")?.getAttribute("points")
		expect(after).not.toBe(before)
	})

	it("setState on polarAxes.radiusAxis[id].settings mutation re-renders radar polygon", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<RadarChart width={400} height={400} data={data}>
				<PolarAngleAxis dataKey="subject" />
				<PolarRadiusAxis radiusAxisId="0" domain={[0, 150]} />
				<Radar dataKey="value" radiusAxisId="0" isAnimationActive={false} />
				<Capture />
			</RadarChart>
		))

		const before = container.querySelector(".recharts-radar-polygon")?.getAttribute("points")
		expect(before).toBeTruthy()

		/* Phase 4 RED: radiusAxis mutation in new chartState not tracked by Radar.
		   Phase 4 GREEN: mutation triggers re-render, polygon points change. */
		capturedSetState!("polarAxes", "radiusAxis", "0", "settings" as never, { domain: [0, 9999] } as never)

		const after = container.querySelector(".recharts-radar-polygon")?.getAttribute("points")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.dataKey re-derives radar polygon", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		const multiData = [
			{ subject: "Math", value: 120, score: 50 },
			{ subject: "English", value: 98, score: 80 },
		]

		const { container } = render(() => (
			<RadarChart width={400} height={400} data={multiData}>
				<PolarAngleAxis dataKey="subject" />
				<PolarRadiusAxis />
				<Radar dataKey="value" isAnimationActive={false} />
				<Capture />
			</RadarChart>
		))

		const before = container.querySelector(".recharts-radar-polygon")?.getAttribute("points")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "radar-0"

		/* Phase 4 RED: graphicalItems[id].settings.dataKey mutation ignored by Radar.
		   Phase 4 GREEN: new dataKey re-derives polygon points. */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "dataKey" as never, "score" as never)

		const after = container.querySelector(".recharts-radar-polygon")?.getAttribute("points")
		expect(after).not.toBe(before)
	})

	it("legacy selectRadarPoints exports a callable function (hook-compat)", () => {
		expect(typeof selectRadarPoints).toBe("function")
		expect(selectRadarPoints.length).toBeGreaterThanOrEqual(5)
	})
})
