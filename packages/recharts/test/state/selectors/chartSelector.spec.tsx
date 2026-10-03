import { describe, expect, it } from "vitest"
import { createMemo, flush, untrack } from "solid-js"
import { render } from "../../helper/render"
import { RechartsStateProvider } from "../../../src/state/RechartsStateProvider"
import { useChartStore } from "../../../src/state/RechartsStoreContext"
import type { ChartStoreContextValue } from "../../../src/state/RechartsStoreContext"
import { createRechartsStore } from "../../../src/state/store"
import type { ChartState } from "../../../src/state/store"
import { chartSelector, defaultSelectorEquals, ownerFor } from "../../../src/state/selectors/chartSelector"

function setup() {
	let computes = 0
	const selectWidth = chartSelector((state: ChartState, scale: number) => {
		computes++
		return state.layout.width * scale
	})
	const reads: number[] = []
	let ctx: ChartStoreContextValue | null = null
	function Consumer() {
		const store = useChartStore()
		ctx ??= store
		const width = createMemo(() => (store ? selectWidth(store.store, 2) : -1))
		return <span>{(reads.push(width()), width())}</span>
	}
	const result = render(() => (
		<RechartsStateProvider>
			<Consumer />
			<Consumer />
		</RechartsStateProvider>
	))
	if (ctx == null) throw new Error("no chart store")
	const chart: ChartStoreContextValue = ctx
	return { chart, computes: () => computes, reads, result, selectWidth }
}

describe("chartSelector", () => {
	it("shares one memo per argument tuple across consumers", () => {
		const { chart, computes, selectWidth } = setup()
		expect(computes()).toBe(1)
		expect(ownerFor(chart.store)).toBeDefined()
		expect(untrack(() => selectWidth(chart.store, 2))).toBe(chart.store.layout.width * 2)
		expect(computes()).toBe(1)
		untrack(() => selectWidth(chart.store, 3))
		expect(computes()).toBe(2)
	})

	it("does not recompute when an unrelated store field changes", () => {
		const { chart, computes } = setup()
		chart.setStore("layout", "margin", { bottom: 9, left: 9, right: 9, top: 9 })
		flush()
		expect(computes()).toBe(1)
	})

	it("recomputes once when a read field changes", () => {
		const { chart, computes, result } = setup()
		chart.setStore("layout", "width", 321)
		flush()
		expect(computes()).toBe(2)
		expect(result.container.textContent).toBe("642642")
	})

	it("falls back to the raw function outside a provider", () => {
		let computes = 0
		const select = chartSelector((state: ChartState) => {
			computes++
			return state.layout.height
		})
		const [store, setStore] = createRechartsStore()
		expect(ownerFor(store)).toBeUndefined()
		setStore("layout", "height", 77)
		flush()
		expect(select(store)).toBe(77)
		expect(select(store)).toBe(77)
		expect(computes).toBe(2)
	})

	it("drops the cache when the provider is disposed", () => {
		const { chart, computes, result, selectWidth } = setup()
		result.unmount()
		expect(ownerFor(chart.store)).toBeUndefined()
		chart.setStore("layout", "width", 500)
		flush()
		expect(computes()).toBe(1)
		expect(selectWidth(chart.store, 2)).toBe(1000)
		expect(computes()).toBe(2)
	})

	it("returns fresh values to untracked readers after a write", () => {
		const { chart, selectWidth } = setup()
		chart.setStore("layout", "width", 40)
		flush()
		expect(untrack(() => selectWidth(chart.store, 2))).toBe(80)
		chart.setStore("layout", "width", 41)
		flush()
		expect(selectWidth(chart.store, 2)).toBe(82)
	})

	it("recomputes an unobserved memo only when it is read", () => {
		const { chart, computes, selectWidth } = setup()
		untrack(() => selectWidth(chart.store, 5))
		expect(computes()).toBe(2)
		chart.setStore("layout", "width", 10)
		flush()
		// only the observed (scale 2) memo recomputes on flush
		expect(computes()).toBe(3)
		expect(untrack(() => selectWidth(chart.store, 5))).toBe(50)
		expect(computes()).toBe(4)
	})

	it("runs the raw function for calls with object arguments", () => {
		const { chart } = setup()
		let computes = 0
		const select = chartSelector((state: ChartState, opts: { k: number }) => {
			computes++
			return state.layout.width + opts.k
		})
		const opts = { k: 1 }
		expect(untrack(() => select(chart.store, opts))).toBe(chart.store.layout.width + 1)
		expect(untrack(() => select(chart.store, opts))).toBe(chart.store.layout.width + 1)
		expect(computes).toBe(2)
	})

	it("rethrows selector errors to the reader without halting the graph", () => {
		const { chart } = setup()
		const select = chartSelector((state: ChartState, fail: boolean) => {
			if (fail && state.layout.width >= 0) throw new Error("boom")
			return state.layout.width
		})
		expect(() => untrack(() => select(chart.store, true))).toThrow("boom")
		chart.setStore("layout", "width", 12)
		flush()
		expect(untrack(() => select(chart.store, false))).toBe(12)
	})

	it("keeps the wrapped function arity", () => {
		const select = chartSelector((_state: ChartState, _a: number, _b: string) => 1)
		expect(select.length).toBe(3)
	})
})

describe("defaultSelectorEquals", () => {
	it("compares primitives, arrays by element, and plain objects shallowly", () => {
		const x = {}
		expect(defaultSelectorEquals(1, 1)).toBe(true)
		expect(defaultSelectorEquals(Number.NaN, Number.NaN)).toBe(false)
		expect(defaultSelectorEquals([x, 1], [x, 1])).toBe(true)
		expect(defaultSelectorEquals([x], [{}])).toBe(false)
		expect(defaultSelectorEquals([1], [1, 2])).toBe(false)
		expect(defaultSelectorEquals({ a: x, b: 1 }, { a: x, b: 1 })).toBe(true)
		expect(defaultSelectorEquals({ a: 1 }, { b: 1 })).toBe(false)
		expect(defaultSelectorEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false)
		expect(defaultSelectorEquals(new Date(0), new Date(0))).toBe(false)
		expect(defaultSelectorEquals(null, undefined)).toBe(false)
	})

	it("compares store nodes by identity only", () => {
		const [store] = createRechartsStore()
		const { hover, click } = store.tooltip.axisInteraction
		expect(defaultSelectorEquals(hover, hover)).toBe(true)
		expect(defaultSelectorEquals(hover, click)).toBe(false)
		expect(defaultSelectorEquals({ ...hover }, hover)).toBe(false)
	})
})
