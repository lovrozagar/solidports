import { describe, it, expect } from "vitest"
import { combineDisplayedStackedData } from "../../../../src/state/selectors/combiners/combineDisplayedStackedData"
import type { ChartDataState } from "../../../../src/state/chartDataSlice"
import type { BaseCartesianAxis } from "../../../../src/state/cartesianAxisSlice"
import type { DefinitelyStackedGraphicalItem } from "../../../../src/state/types/StackedGraphicalItem"

const emptyAxisSettings: BaseCartesianAxis = {
	allowDataOverflow: false,
	allowDuplicatedCategory: false,
	dataKey: undefined,
	domain: [],
	id: "emptyAxis",
	includeHidden: false,
	name: "",
	reversed: false,
	scale: "sequential",
	type: "number",
	unit: "",
}

function createMockBaseCartesianAxis(
	partialBaseAxis: Partial<BaseCartesianAxis>,
): BaseCartesianAxis {
	return {
		...emptyAxisSettings,
		...partialBaseAxis,
	}
}

describe("combineDisplayedStackedData", () => {
	const emptyChartDataState: ChartDataState = {
		chartData: [],
		computedData: undefined,
		dataEndIndex: 0,
		dataStartIndex: 0,
	}

	it("should return empty array when no cartesian items are provided", () => {
		const result = combineDisplayedStackedData(
			[],
			emptyChartDataState,
			createMockBaseCartesianAxis({ dataKey: undefined }),
		)
		expect(result).toEqual([])
	})
	it("should stack data points by stack identifier", () => {
		const cartesianItems: ReadonlyArray<DefinitelyStackedGraphicalItem> = [
			{
				barSize: "",
				data: [
					{ name: "a", value: 10 },
					{ name: "b", value: 20 },
				],
				dataKey: "value",
				hide: false,
				id: "id1",
				stackId: "a",
			},
			{
				barSize: "",
				data: [
					{ name: "a", value: 30 },
					{ name: "b", value: 40 },
				],
				dataKey: "value",
				hide: false,
				id: "id2",
				stackId: "a",
			},
		]

		const result = combineDisplayedStackedData(
			cartesianItems,
			emptyChartDataState,
			createMockBaseCartesianAxis({ dataKey: "name" }),
		)

		expect(result).toEqual([
			{ id1: 10, id2: 30 },
			{ id1: 20, id2: 40 },
		])
	})
	it("should ignore stackIds because another selected down the road handles that", () => {
		const cartesianItems: ReadonlyArray<DefinitelyStackedGraphicalItem> = [
			{
				barSize: "",
				data: [
					{ name: "a", value: 10 },
					{ name: "b", value: 20 },
				],
				dataKey: "value",
				hide: false,
				id: "id1",
				stackId: "a",
			},
			{
				barSize: "",
				data: [
					{ name: "a", value: 30 },
					{ name: "b", value: 40 },
				],
				dataKey: "value",
				hide: false,
				id: "id2",
				stackId: "b",
			},
		]

		const result = combineDisplayedStackedData(
			cartesianItems,
			emptyChartDataState,
			createMockBaseCartesianAxis({ dataKey: "name" }),
		)

		/* merged anyway, stackId will be figured out later */
		expect(result).toEqual([
			{ id1: 10, id2: 30 },
			{ id1: 20, id2: 40 },
		])
	})
})
