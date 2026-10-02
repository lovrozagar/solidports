import { describe, expect, it, vi } from "vitest"
import { observe } from "../../helper/observe"

import { render } from "../../helper/render"
import { useAppSelector } from "../../helper/legacyDispatch"
import { BarChart, Brush, Customized } from "../../../src"
import { selectBrushHeight } from "../../../src/state/selectors/selectChartOffsetInternal"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"

describe("selectBrushHeight", () => {
	shouldReturnUndefinedOutOfContext(selectBrushHeight)
	shouldReturnFromInitialState(selectBrushHeight, 0)

	it("should return brush height if set", () => {
		const heightSpy = vi.fn()
		const Comp = (): null => {
			observe(() => {
				const height = useAppSelector(selectBrushHeight)
				heightSpy(height)
			})
			return null
		}
		render(() => (
			<BarChart width={100} height={100}>
				<Brush height={7} />
				<Customized component={Comp} />
			</BarChart>
		))
		expect(heightSpy).toHaveBeenLastCalledWith(7)
		/* GOTCHA-007-E sibling-mount-order: expect(heightSpy).toHaveBeenCalledTimes(2) */
	})
})
