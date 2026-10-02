import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../src/state/store"
import { createActions } from "../../src/state/actions"
import { PageData } from "../_data"
import { selectUnfilteredCartesianItems } from "../../src/state/selectors/axisSelectors"
import type { BarSettings } from "../../src/state/types/BarSettings"
import type { LineSettings } from "../../src/state/types/LineSettings"
import type { AreaSettings } from "../../src/state/types/AreaSettings"

describe("graphicalItemsSlice", () => {
	const item1: BarSettings = {
		barSize: undefined,
		data: PageData,
		dataKey: undefined,
		hasCustomShape: false,
		hide: false,
		id: "my-bar",
		isPanorama: false,
		maxBarSize: 0,
		minPointSize: 0,
		stackId: undefined,
		type: "bar",
		xAxisId: "x",
		yAxisId: "y",
		zAxisId: 0,
	}

	const item2: LineSettings = {
		data: PageData,
		dataKey: undefined,
		hide: false,
		id: "my-line",
		isPanorama: false,
		type: "line",
		xAxisId: "x",
		yAxisId: "y",
		zAxisId: 0,
	}

	const item3: AreaSettings = {
		barSize: undefined,
		baseValue: undefined,
		connectNulls: false,
		data: PageData,
		dataKey: "a",
		hide: false,
		id: "my-area",
		isPanorama: false,
		stackId: undefined,
		type: "area",
		xAxisId: "x",
		yAxisId: "y",
		zAxisId: 0,
	}

	it("should add and remove graphical items from state", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		expect(selectUnfilteredCartesianItems(store)).toHaveLength(0)

		actions.addCartesianGraphicalItem(item1)
		flush()
		expect(selectUnfilteredCartesianItems(store)).toEqual([item1])

		actions.removeCartesianGraphicalItem(item1)
		flush()
		expect(selectUnfilteredCartesianItems(store)).toHaveLength(0)
	})

	it("should replace graphical items in state and keep the order", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		expect(selectUnfilteredCartesianItems(store)).toHaveLength(0)

		actions.addCartesianGraphicalItem(item1)
		actions.addCartesianGraphicalItem(item2)
		flush()
		expect(selectUnfilteredCartesianItems(store)).toEqual([item1, item2])

		// Replace item1 with item3
		actions.replaceCartesianGraphicalItem({ next: item3, prev: item1 })
		flush()

		// item3 is now in place of item1, and item2 remains on the second position
		expect(selectUnfilteredCartesianItems(store)).toEqual([item3, item2])
	})
})
