import { describe, it } from "vitest"
import { ChartState } from "../../../src/state/store"
import { selectXAxisPosition } from "../../../src/state/selectors/axisSelectors"
import {
	assertStableBetweenRenders,
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { Line, LineChart, XAxis } from "../../../src"
import { PageData } from "../../_data"
import { defaultAxisId } from "../../../src/state/cartesianAxisSlice"

describe("selectXAxisPosition", () => {
	const selector: Selector<ChartState, ReturnType<typeof selectXAxisPosition>, []> = (
		state,
	) => selectXAxisPosition(state, defaultAxisId)

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, { x: 5, y: 0 })

	it("should be stable between renders", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<LineChart width={100} height={100}>
				<Line data={PageData} dataKey="pv" />
				<XAxis dataKey="name" />
				{props.children}
			</LineChart>
		))

		assertStableBetweenRenders(renderTestCase, selector)
	})
})
