/* @jsxImportSource solid-js */
import { describe, expect, it, vi } from "vitest"
import { createMemo, createRenderEffect, on } from "solid-js"
import { render } from "@solidjs/testing-library"
import { BarChart } from "../../src/chart/BarChart"
import { Bar } from "../../src/cartesian/Bar"
import { ErrorBar } from "../../src/cartesian/ErrorBar"
import { useAppSelector } from "../helper/legacyDispatch"
import {
	selectAllErrorBarSettings,
	selectUnfilteredCartesianItems,
} from "../../src/state/selectors/axisSelectors"

describe("graphical-item mount-order debug", () => {
	it("logs spy calls to identify timing issue", () => {
		const spy = vi.fn((v: unknown) => {
			console.log("SPY CALLED:", JSON.stringify(v))
		})

		const itemsSpy = vi.fn((n: number) => console.log("ITEMS-SPY fired:", n, "items"))
		const Comp = () => {
			const value = createMemo(() => {
				const v = useAppSelector((s) => {
					const itemCount = Object.values(s.graphicalItems).filter(Boolean).length
					console.log("SELECTOR EVAL, items.length=", itemCount, "errorBars keys=", Object.keys(s.errorBars).length)
					return s.errorBars
				})
				console.log("MEMO eval, v defined?", v != null, "type:", typeof v)
				return v
			})
			const items = createMemo(() => {
				const arr = useAppSelector(selectUnfilteredCartesianItems)
				console.log("ITEMS MEMO ran, len=", arr?.length)
				return arr
			})
			createRenderEffect(on(value, (v) => {
				console.log("RENDEREFFECT errorBars=", JSON.stringify(v))
				spy(v)
			}))
			createRenderEffect(on(items, (i) => itemsSpy(i?.length ?? -1)))
			return null
		}

		const result = render(() => (
			<BarChart data={[{ x: 1 }, { x: 2 }]} width={100} height={100}>
				<Bar dataKey="x" isAnimationActive={false} id="my-bar-id">
					<ErrorBar dataKey="data-x" direction="x" />
				</Bar>
				<Comp />
			</BarChart>
		))

		/* probe store state directly after render */
		const probe = vi.fn()
		const Probe = () => {
			probe(useAppSelector(selectAllErrorBarSettings))
			return null
		}
		render(() => (
			<BarChart data={[{ x: 1 }, { x: 2 }]} width={100} height={100}>
				<Bar dataKey="x" isAnimationActive={false} id="my-bar-id">
					<ErrorBar dataKey="data-x" direction="x" />
				</Bar>
				<Probe />
			</BarChart>
		))
		console.log("PROBE 1 CALL:", JSON.stringify(probe.mock.calls[0]?.[0]))

		console.log("TOTAL CALLS:", spy.mock.calls.length)
		console.log("LAST CALL:", JSON.stringify(spy.mock.calls.at(-1)?.[0]))

		/* check DOM */
		console.log("DOM HTML:", result.container.innerHTML.slice(0, 500))
		console.log("ERRORBAR LAYERS:", result.container.querySelectorAll(".recharts-errorBars").length)

		void result
		expect(spy).toHaveBeenCalled()
	})
})
