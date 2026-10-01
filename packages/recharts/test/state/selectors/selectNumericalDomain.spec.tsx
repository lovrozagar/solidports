import { ChartState } from "../../../src/state/store"
import { selectNumericalDomain } from "../../../src/state/selectors/axisSelectors"
import { defaultAxisId } from "../../../src/state/cartesianAxisSlice"
import {
	assertStableBetweenRenders,
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { Bar, BarChart, XAxis } from "../../../src"
import { PageData } from "../../_data"

describe("selectNumericalDomain", () => {
	const selector = (state: ChartState) =>
		selectNumericalDomain(state, "xAxis", defaultAxisId, false)

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, undefined)

	it("should be stable between renders", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart data={PageData} width={100} height={100}>
				<Bar dataKey="uv" />
				<XAxis dataKey="name" />
				{props.children}
			</BarChart>
		))

		assertStableBetweenRenders(renderTestCase, selector)
	})
})
