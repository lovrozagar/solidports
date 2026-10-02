import { render } from "../../helper/render"
import { untrack } from "solid-js"
import { describe, expect, it } from "vitest"
import { selectChartOffsetInternal } from "../../../src/state/selectors/selectChartOffsetInternal"
import { useAppSelector } from "../../helper/legacyDispatch"
import { Customized, LineChart } from "../../../src"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"

describe("selectChartOffset", () => {
	shouldReturnUndefinedOutOfContext(selectChartOffsetInternal)
	shouldReturnFromInitialState(selectChartOffsetInternal, {
		bottom: 5,
		brushBottom: 5,
		height: 0,
		left: 5,
		right: 5,
		top: 5,
		width: 0,
	})

	it("should be stable", () => {
		expect.assertions(2)
		const Comp = (): null => {
			const offset1 = untrack(() => useAppSelector(selectChartOffsetInternal))
			const offset2 = untrack(() => useAppSelector(selectChartOffsetInternal))
			expect(offset1).not.toBe(undefined)
			expect(offset1).toEqual(offset2)
			return null
		}

		render(() => (
			<LineChart width={100} height={200}>
				<Customized component={Comp} />
			</LineChart>
		))
	})
})
