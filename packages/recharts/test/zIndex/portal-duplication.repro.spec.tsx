import { describe, expect, it, vi } from "vitest"
import { render } from "../helper/render"
import { AreaChart, CartesianGrid } from "../../src"
import type { HorizontalCoordinatesGenerator } from "../../src/cartesian/CartesianGrid"

/*
 * GOTCHA-004 regression guard.
 * CartesianGrid computes ticks via a generator callback wrapped in a createMemo.
 * That memo must re-run exactly once per chart mount, not once per registered zIndex layer.
 * Before the fix the ZIndexLayer wrapper caused the generator to fire N times
 * (N = number of registered zIndex layers in the store).
 */
describe("ZIndex portal duplication regression", () => {
	it("CartesianGrid generator fires exactly once per mount", () => {
		const generator: HorizontalCoordinatesGenerator = vi.fn().mockReturnValue([3, 4])

		render(() => (
			<AreaChart width={500} height={500}>
				<CartesianGrid horizontalCoordinatesGenerator={generator} />
			</AreaChart>
		))

		expect(generator).toHaveBeenCalledTimes(1)
	})
})
