import { describe, expect, it } from "vitest"
import { createRechartsStore, ChartState } from "../../../src/state/store"
import {
	selectXAxisRange,
	selectAxisRangeWithReverse,
} from "../../../src/state/selectors/axisSelectors"
import {
	assertStableBetweenRenders,
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { Bar, BarChart, XAxis } from "../../../src"
import { PageData } from "../../_data"
import { createActions } from "../../../src/state/actions"

describe("selectAxisRangeWithReverse", () => {
	const selector = (state: ChartState) =>
		selectAxisRangeWithReverse(state, "xAxis", "0", false)

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, [5, 5])

	it("should be stable between rerenders", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart data={PageData} width={100} height={100}>
				<Bar dataKey="uv" />
				<XAxis dataKey="name" />
				{props.children}
			</BarChart>
		))

		assertStableBetweenRenders(renderTestCase, selector)
	})
	it("should not recompute when an irrelevant property in the state changes", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const result1 = selectAxisRangeWithReverse(store, "xAxis", "0", false)
		const xAxisRange1 = selectXAxisRange(store, "0", false)
		actions.setActiveMouseOverItemIndex({
			activeCoordinate: undefined,
			activeDataKey: "x",
			activeGraphicalItemId: "foo",
			activeIndex: "7",
		})
		const result2 = selectAxisRangeWithReverse(store, "xAxis", "0", false)
		const xAxisRange2 = selectXAxisRange(store, "0", false)
		expect(xAxisRange1).toEqual(xAxisRange2)
		expect(result1).toEqual(result2)
	})
})
