import { ChartState } from "../../../src/state/store"
import { selectRealScaleType } from "../../../src/state/selectors/axisSelectors"
import {
	assertStableBetweenRenders,
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { BarChart } from "../../../src"
import { PageData } from "../../_data"

describe("selectRealScaleType", () => {
	const selector = (state: ChartState) => selectRealScaleType(state, "xAxis", 0)

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, "band")

	it("should be stable between renders", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart data={PageData} width={100} height={100}>
				{props.children}
			</BarChart>
		))

		assertStableBetweenRenders(renderTestCase, selector)
	})
})
