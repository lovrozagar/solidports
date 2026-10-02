import { describe, it, expect } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../src/state/store"
import { createActions } from "../../src/state/actions"

describe("chartDataSlice", () => {
	it("should start with undefined chartData", () => {
		const [store] = createRechartsStore()
		expect(store.chartData.chartData).toBeUndefined()
		expect(store.chartData.dataStartIndex).toBe(0)
		expect(store.chartData.dataEndIndex).toBe(0)
	})
	it("should set chartData array with start and end index", () => {
		const chartData = [{ value: 1 }, { value: 2 }, { value: 3 }]
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setChartData(chartData)
		flush()
		/* Solid store wraps values in proxies so identity (toBe) does not hold; use deep equality */
		expect(store.chartData.chartData).toEqual(chartData)
		expect(store.chartData.dataStartIndex).toBe(0)
		expect(store.chartData.dataEndIndex).toBe(2)
	})
	it("should set empty array with start and end index", () => {
		const chartData: never[] = []
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setChartData(chartData)
		flush()
		expect(store.chartData.chartData).toEqual(chartData)
		expect(store.chartData.dataStartIndex).toBe(0)
		expect(store.chartData.dataEndIndex).toBe(0)
	})
	it("should clear the state when set undefined", () => {
		const chartData = [{ value: 1 }, { value: 2 }, { value: 3 }]
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setChartData(chartData)
		flush()
		expect(store.chartData.chartData).toEqual(chartData)
		actions.setChartData(undefined)
		flush()
		expect(store.chartData.chartData).toBeUndefined()
		expect(store.chartData.dataStartIndex).toBe(0)
		expect(store.chartData.dataEndIndex).toBe(0)
	})
})
