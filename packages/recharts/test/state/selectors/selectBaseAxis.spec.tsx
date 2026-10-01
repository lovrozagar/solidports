import { describe, expect, it } from "vitest"
import {
	assertStableBetweenRenders,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import {
	implicitXAxis,
	implicitYAxis,
	implicitZAxis,
	selectBaseAxis,
} from "../../../src/state/selectors/axisSelectors"
import { createRechartsStore, ChartState } from "../../../src/state/store"
import {
	implicitAngleAxis,
	implicitRadiusAxis,
} from "../../../src/state/selectors/polarAxisSelectors"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { Bar, BarChart, XAxis } from "../../../src"
import { PageData } from "../../_data"

describe("selectBaseAxis", () => {
	const selector = (state: ChartState) => selectBaseAxis(state, "xAxis", "0")
	shouldReturnUndefinedOutOfContext(selector)

	it("should return implicit XAxis when called with initial state", () => {
		const initialState: ChartState = createRechartsStore().getState()
		const result = selectBaseAxis(initialState, "xAxis", "0")
		expect(result).toBe(implicitXAxis)
	})
	it("should return implicit YAxis when called with initial state", () => {
		const initialState: ChartState = createRechartsStore().getState()
		const result = selectBaseAxis(initialState, "yAxis", "0")
		expect(result).toBe(implicitYAxis)
	})
	it("should return implicit ZAxis when called with initial state", () => {
		const initialState: ChartState = createRechartsStore().getState()
		const result = selectBaseAxis(initialState, "zAxis", "0")
		expect(result).toBe(implicitZAxis)
	})
	it("should return implicit PolarAngleAxis when called with initial state", () => {
		const initialState: ChartState = createRechartsStore().getState()
		const result = selectBaseAxis(initialState, "angleAxis", "0")
		expect(result).toEqual({ ...implicitAngleAxis, type: "category" })
	})
	it("should return implicit RadiusAxis when called with initial state", () => {
		const initialState: ChartState = createRechartsStore().getState()
		const result = selectBaseAxis(initialState, "radiusAxis", "0")
		expect(result).toEqual({ ...implicitRadiusAxis, type: "category" })
	})
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
