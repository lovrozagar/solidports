/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { BarChart, Bar, XAxis, YAxis, Legend, RadarChart, Radar, PolarAngleAxis } from "../../../src"
import { useChartState } from "../../../src/state/_solid/useChartState"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

describe("Phase 5 — Legend dual-writes to new chartState", () => {
	it("Legend component populates state.legend.settings on mount", () => {
		/* Phase 5 RED: Legend writes to legacy RechartsRootState.legend only — new
		   chartState.legend.settings remains at initial defaults. After GREEN: Legend
		   dual-writes so state.legend.settings.align matches the 'left' prop. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		mockGetBoundingClientRect({ height: 20, width: 100 })

		render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Legend align="left" verticalAlign="top" layout="vertical" />
				<Capture />
			</BarChart>
		))

		/* Phase 5 RED: state.legend.settings.align is still "center" (initial) — Legend
		   never writes new chartState. */
		expect(capturedState?.legend.settings.align).toBe("left")
	})

	it("Legend component populates state.legend.size on mount", () => {
		/* Phase 5 RED: Legend size is measured and dispatched only to legacy store — new
		   chartState.legend.size stays { width: 0, height: 0 }. After GREEN: Legend
		   dual-writes measured size to new chartState. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		mockGetBoundingClientRect({ height: 30, width: 120 })

		render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Legend />
				<Capture />
			</BarChart>
		))

		/* Phase 5 RED: state.legend.size.width stays 0 — size never written to new state. */
		expect(capturedState?.legend.size.width).toBeGreaterThan(0)
	})

	it("setState on state.legend.payload re-renders legend items", () => {
		/* Phase 5 RED: Legend component subscribes to legacy store for payload — direct
		   mutation of new chartState.legend.payload is never observed by the component.
		   After GREEN: Legend reads payload from new state and re-renders synchronously. */
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		mockGetBoundingClientRect({ height: 20, width: 100 })

		const { container } = render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Legend />
				<Capture />
			</BarChart>
		))

		const itemsBefore = container.querySelectorAll(".recharts-legend-item").length

		capturedSetState!("legend", "payload", [
			[{ value: "injected-0", type: "line", id: "injected-0", color: "#ff0000" }],
			[{ value: "injected-1", type: "line", id: "injected-1", color: "#0000ff" }],
		] as never)

		/* Phase 5 RED: legend items unchanged — new state payload mutation not observed. */
		const itemsAfter = container.querySelectorAll(".recharts-legend-item").length
		expect(itemsAfter).not.toBe(itemsBefore)
	})

	it("cartesian chart SetLegendPayload populates state.legend.payload", () => {
		/* Phase 5 RED: Bar/Line setLegendPayload dispatches to legacy store only — new
		   chartState.legend.payload stays []. After GREEN: dual-write fills new state. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		mockGetBoundingClientRect({ height: 20, width: 100 })

		render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} name="Revenue" />
				<Legend />
				<Capture />
			</BarChart>
		))

		/* Phase 5 RED: state.legend.payload is still [] because only legacy store is written. */
		expect(capturedState?.legend.payload.length).toBeGreaterThan(0)
	})

	it("polar chart SetLegendPayload populates state.legend.payload", () => {
		/* Phase 5 RED: Radar setLegendPayload dispatches to legacy store only — new
		   chartState.legend.payload stays empty. After GREEN: dual-write fills new state. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		mockGetBoundingClientRect({ height: 20, width: 100 })

		render(() => (
			<RadarChart width={400} height={300} data={data}>
				<PolarAngleAxis dataKey="name" />
				<Radar dataKey="value" name="Score" isAnimationActive={false} />
				<Legend />
				<Capture />
			</RadarChart>
		))

		/* Phase 5 RED: state.legend.payload stays [] — polar item never writes new state. */
		expect(capturedState?.legend.payload.length).toBeGreaterThan(0)
	})
})
