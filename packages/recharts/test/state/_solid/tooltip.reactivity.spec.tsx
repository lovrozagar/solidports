/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { LineChart, Line, XAxis, YAxis, Tooltip } from "../../../src"
import { useChartState } from "../../../src/state/_solid/useChartState"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

describe("Phase 5 — Tooltip dual-writes to new chartState", () => {
	it("Tooltip component populates state.tooltip.settings on mount", () => {
		/* Phase 5 RED: Tooltip writes settings to legacy RechartsRootState.tooltip only — new
		   chartState.tooltip.settings.trigger stays 'hover' (initial default) even when
		   trigger='click' is passed. After GREEN: Tooltip dual-writes settings. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} />
				<Tooltip trigger="click" />
				<Capture />
			</LineChart>
		))

		/* Phase 5 RED: state.tooltip.settings.trigger is still 'hover' — Tooltip never
		   writes new chartState. */
		expect(capturedState?.tooltip.settings.trigger).toBe("click")
	})

	it("setState on state.tooltip.tooltipItemPayloads re-renders tooltip content", () => {
		/* Phase 5 RED: Tooltip subscribes to legacy store for tooltipItemPayloads — direct
		   mutation of new chartState.tooltip.tooltipItemPayloads is never observed. After
		   GREEN: Tooltip reads from new state, mutation triggers synchronous re-render. */
		let capturedSetState: SetStoreFunction<ChartState> | undefined

		const Capture = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { container } = render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} />
				<Tooltip />
				<Capture />
			</LineChart>
		))

		/* Activate tooltip via axisInteraction so it becomes visible. */
		capturedSetState!("tooltip", "axisInteraction", "hover", {
			active: true,
			coordinate: { x: 50, y: 50 },
			dataKey: undefined,
			graphicalItemId: undefined,
			index: "0",
		} as never)

		const before = container.querySelector(".recharts-tooltip-wrapper")?.textContent ?? ""

		capturedSetState!("tooltip", "tooltipItemPayloads" as never, [
			{
				dataDefinedOnItem: data,
				getPosition: () => undefined,
				settings: {
					color: "#ff0000",
					dataKey: "value",
					name: "InjectedValue",
					nameKey: undefined,
					type: undefined,
					unit: undefined,
				},
			},
		] as never)

		/* Phase 5 RED: tooltip content unchanged — new state mutation not observed. */
		const after = container.querySelector(".recharts-tooltip-wrapper")?.textContent ?? ""
		expect(after).not.toBe(before)
	})

	it("multiple chart instances have isolated tooltip state", () => {
		/* Phase 5 RED: if both charts share a single RechartsStateProvider (incorrect wiring)
		   or if new state is not per-provider, mutations on chart A bleed to chart B.
		   After GREEN: each chart has its own provider instance → isolated state. */
		const capturedStates: ChartState[] = []

		const Capture = (): null => {
			const { state } = useChartState()
			capturedStates.push(state)
			return null
		}

		render(() => (
			<>
				<LineChart width={400} height={200} data={data}>
					<XAxis dataKey="name" />
					<YAxis />
					<Line dataKey="value" isAnimationActive={false} />
					<Tooltip trigger="click" />
					<Capture />
				</LineChart>
				<LineChart width={400} height={200} data={data}>
					<XAxis dataKey="name" />
					<YAxis />
					<Line dataKey="value" isAnimationActive={false} />
					<Tooltip trigger="hover" />
					<Capture />
				</LineChart>
			</>
		))

		expect(capturedStates.length).toBeGreaterThanOrEqual(2)
		/* Phase 5 RED: both charts write same chartState — states are reference-equal or
		   both show same trigger value. After GREEN: each instance holds its own store. */
		expect(capturedStates[0]).not.toBe(capturedStates[1])
	})

	it("setState on state.tooltip.settings.active updates tooltip active flag", () => {
		/* Phase 5 RED: Tooltip active flag is read from legacy store — new-state mutation
		   is invisible to the component. After GREEN: Tooltip reads active from new state. */
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} />
				<Tooltip />
				<Capture />
			</LineChart>
		))

		expect(capturedState?.tooltip.settings.active).toBe(false)

		capturedSetState!("tooltip", "settings", "active" as never, true as never)

		/* Phase 5 RED: state still reflects old value because Tooltip never wrote new state. */
		expect(capturedState?.tooltip.settings.active).toBe(true)
	})

	it("Tooltip with defaultIndex populates state.tooltip.settings.defaultIndex on mount", () => {
		/* Phase 5 RED: Tooltip defaultIndex prop is dispatched to legacy store only — new
		   chartState.tooltip.settings.defaultIndex stays undefined. After GREEN: dual-write
		   fills new state with the defaultIndex value. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="name" />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} />
				<Tooltip defaultIndex={1} />
				<Capture />
			</LineChart>
		))

		/* Phase 5 RED: defaultIndex is still undefined in new state. */
		expect(capturedState?.tooltip.settings.defaultIndex).toBe(1)
	})

	it("Tooltip with axisId populates state.tooltip.settings.axisId on mount", () => {
		/* Phase 5 RED: axisId prop dispatched to legacy store only — new chartState
		   tooltip.settings.axisId stays at 0. After GREEN: dual-write fills new state. */
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			capturedState = useChartState().state
			return null
		}

		render(() => (
			<LineChart width={400} height={200} data={data}>
				<XAxis dataKey="name" xAxisId="primary" />
				<YAxis />
				<Line dataKey="value" isAnimationActive={false} xAxisId="primary" />
				<Tooltip axisId="primary" />
				<Capture />
			</LineChart>
		))

		/* Phase 5 RED: state.tooltip.settings.axisId is still 0. */
		expect(capturedState?.tooltip.settings.axisId).toBe("primary")
	})
})
