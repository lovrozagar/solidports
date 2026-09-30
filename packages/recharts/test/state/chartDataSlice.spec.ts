import { describe, it, expect } from "vitest"
import { createRechartsStore } from "../../src/state/store"
import { createActions } from "../../src/state/actions"

describe("chartDataSlice", () => {
	it("should start with undefined chartData", () => {
		const [store] = createRechartsStore()
		expect(store.chartData.chartData).toBeUndefined()
		expect(store.chartData.dataStartIndex).toBe(0)
		expect(store.chartData.dataEndIndex).toBe(0)
	})
	it("should set chartData array", () => {
		const chartData = [{ value: 1 }, { value: 2 }, { value: 3 }]
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setChartData(chartData)
		/* Solid store wraps values in proxies so identity (toBe) does not hold; use deep equality */
		expect(store.chartData.chartData).toEqual(chartData)
	})
	it("should set empty array", () => {
		const chartData: never[] = []
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setChartData(chartData)
		expect(store.chartData.chartData).toEqual(chartData)
	})
	it("should clear the state when set undefined", () => {
		const chartData = [{ value: 1 }, { value: 2 }, { value: 3 }]
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setChartData(chartData)
		expect(store.chartData.chartData).toEqual(chartData)
		actions.setChartData(undefined)
		expect(store.chartData.chartData).toBeUndefined()
	})
})
