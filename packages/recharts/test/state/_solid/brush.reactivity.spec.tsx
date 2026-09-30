/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { BarChart, Brush, XAxis, YAxis, Bar } from "../../../src"
import { useChartState } from "../../../src/state/_solid/useChartState"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

describe("Phase 5 — Brush dual-writes to new chartState", () => {
	it("Brush component populates state.brush on mount", () => {
		/* Phase 5 RED: Brush writes to legacy RechartsRootState.brush only — new
		   chartState.brush remains at initial zeros after mount. After GREEN: Brush
		   dual-writes to new chartState.brush so state.brush.height matches prop. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Brush height={40} />
				<Capture />
			</BarChart>
		))

		/* Phase 5 RED: state.brush.height stays 0 because Brush never writes new state. */
		expect(capturedState?.brush.height).toBe(40)
	})

	it("setState on state.brush.height propagates to rendered Brush DOM", () => {
		/* Phase 5 RED: Brush component reads from legacy store only — direct mutation of
		   new chartState.brush.height never triggers a Brush re-render. After GREEN: Brush
		   reads height from new chartState, so setState causes a synchronous DOM update. */
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Brush height={20} />
				<Capture />
			</BarChart>
		))

		const brushEl = container.querySelector(".recharts-brush")
		expect(brushEl).not.toBeNull()

		const before = brushEl?.getAttribute("height") ?? brushEl?.getBoundingClientRect().height
		capturedSetState!("brush", "height" as never, 60 as never)

		/* Phase 5 RED: Brush still renders at height 20 — new state mutation unobserved. */
		const after = container.querySelector(".recharts-brush")?.getAttribute("height")
		expect(String(after)).not.toBe(String(before))
	})

	it("setState on state.brush.startIndex fires and state records the new value", () => {
		/* Phase 5 RED: new chartState.brush has no startIndex field — BrushSettings from
		   brushSlice only has x/y/width/height/padding. After GREEN: ChartState.brush type
		   is widened to include startIndex/endIndex for new state, and Brush writes them. */
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Brush />
				<Capture />
			</BarChart>
		))

		/* Phase 5 RED: "startIndex" is not a key on current BrushSettings — write lands as
		   unknown field, reading it back yields undefined instead of 1. */
		capturedSetState!("brush", "startIndex" as never, 1 as never)
		expect((capturedState?.brush as Record<string, unknown>)["startIndex"]).toBe(1)
	})

	it("single Brush per chart — new state.brush reflects the single instance settings", () => {
		/* Phase 5 RED: Brush never writes new chartState — state.brush.height is 0 even
		   after mount with height=30. After GREEN: single Brush dual-writes its settings. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		render(() => (
			<BarChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Bar dataKey="value" isAnimationActive={false} />
				<Brush height={30} />
				<Capture />
			</BarChart>
		))

		expect(capturedState?.brush.height).toBe(30)
	})
})
