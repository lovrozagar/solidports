/* @jsxImportSource @solidjs/web */
import { describe, expect, it, vi } from "vitest"
import { trackSpy } from "../helper/trackSpy"
import { render } from "../helper/render"
import { BarChart } from "../../src/chart/BarChart"
import { Bar } from "../../src/cartesian/Bar"
import { ErrorBar } from "../../src/cartesian/ErrorBar"
import { useAppSelector } from "../helper/legacyDispatch"
import { selectUnfilteredCartesianItems } from "../../src/state/selectors/axisSelectors"

describe("graphical-item mount order", () => {
	it("registers the Bar and its ErrorBar settings by the end of the first render", () => {
		const errorBarsSpy = vi.fn()
		const itemsSpy = vi.fn()
		const Comp = () => {
			trackSpy(errorBarsSpy, () => useAppSelector((s) => s.errorBars["my-bar-id"]))
			trackSpy(itemsSpy, () => useAppSelector(selectUnfilteredCartesianItems)?.length)
			return null
		}

		render(() => (
			<BarChart data={[{ x: 1 }, { x: 2 }]} width={100} height={100}>
				<Bar dataKey="x" isAnimationActive={false} id="my-bar-id">
					<ErrorBar dataKey="data-x" direction="x" />
				</Bar>
				<Comp />
			</BarChart>
		))

		expect(itemsSpy).toHaveBeenLastCalledWith(1)
		expect(errorBarsSpy).toHaveBeenLastCalledWith([{ dataKey: "data-x", direction: "x" }])
	})
})
