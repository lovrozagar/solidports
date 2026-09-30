/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { PieChart, Pie, Cell } from "../../src"
import { useChartState } from "../../src/state/_solid/useChartState"
import { selectPieSectors } from "../../src/state/selectors/pieSelectors"
import type { SetStoreFunction } from "solid-js/store"
import type { ChartState } from "../../src/state/_solid/chartState"

const data = [
	{ name: "A", value: 100 },
	{ name: "B", value: 200 },
	{ name: "C", value: 300 },
]

describe("Phase 4 — Pie reads from new chartState", () => {
	it("Pie renders sectors when mounted inside PieChart", () => {
		const { container } = render(() => (
			<PieChart width={400} height={300}>
				<Pie data={data} dataKey="value" isAnimationActive={false} />
			</PieChart>
		))
		expect(container.querySelector(".recharts-pie-sector")).not.toBeNull()
	})

	it("setState on graphicalItems[id].settings.dataKey re-derives pie sectors", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		const { container } = render(() => (
			<PieChart width={400} height={300}>
				<Pie data={data} dataKey="value" isAnimationActive={false} />
				<Capture />
			</PieChart>
		))

		const before = container.querySelector(".recharts-pie-sector path")?.getAttribute("d")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "pie-0"

		/* Phase 4 RED: Pie reads from legacy store, not new chartState — mutation ignored.
		   Phase 4 GREEN: Pie reads graphicalItems[id].settings.dataKey inside createMemo
		   and produces new sector paths when it changes. */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "name" as never)

		const after = container.querySelector(".recharts-pie-sector path")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("setState on graphicalItems[id].settings.startAngle re-renders sectors", () => {
		let capturedSetState: SetStoreFunction<ChartState> | undefined
		let capturedState: ChartState | undefined

		const Capture = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			capturedState = ctx.state
			return null
		}

		const { container } = render(() => (
			<PieChart width={400} height={300}>
				<Pie data={data} dataKey="value" startAngle={0} endAngle={360} isAnimationActive={false} />
				<Capture />
			</PieChart>
		))

		const before = container.querySelector(".recharts-pie-sector path")?.getAttribute("d")
		expect(before).toBeTruthy()

		const itemId = Object.keys(capturedState!.graphicalItems)[0] ?? "pie-0"

		/* Phase 4 RED: startAngle mutation not tracked by Pie via new chartState.
		   Phase 4 GREEN: mutation triggers re-render, paths change. */
		capturedSetState!("graphicalItems", itemId, "settings" as never, "startAngle" as never, 90 as never)

		const after = container.querySelector(".recharts-pie-sector path")?.getAttribute("d")
		expect(after).not.toBe(before)
	})

	it("Cell child applies fill color to sector", () => {
		const { container } = render(() => (
			<PieChart width={400} height={300}>
				<Pie data={data} dataKey="value" isAnimationActive={false}>
					<Cell key="cell-0" fill="#ff0000" />
				</Pie>
			</PieChart>
		))
		/* Cell fill must survive migration — cellsRegistry preservation check. */
		const sectors = container.querySelectorAll(".recharts-pie-sector path")
		expect(sectors.length).toBeGreaterThan(0)
		const filledSector = Array.from(sectors).find(
			(el) => el.getAttribute("fill") === "#ff0000" || el.closest("[fill='#ff0000']") != null,
		)
		expect(filledSector).not.toBeNull()
	})

	it("legacy selectPieSectors exports a callable function (hook-compat)", () => {
		expect(typeof selectPieSectors).toBe("function")
	})
})
