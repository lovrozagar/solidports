import { describe, expect, it, vi } from "vitest"
import { createEffect, createSignal } from "solid-js"
import { render } from "@solidjs/testing-library"
import { createRechartsStore } from "../../../src/state/store"
import { Bar, BarChart, Customized } from "../../../src"
import {
	selectBarCategoryGap,
	selectBarGap,
	selectRootBarSize,
	selectRootMaxBarSize,
	selectSyncMethod,
} from "../../../src/state/selectors/rootPropsSelectors"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
	useAppSelectorWithStableTest,
} from "../../helper/selectorTestHelpers"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"

describe("selectRootMaxBarSize", () => {
	shouldReturnUndefinedOutOfContext(selectRootMaxBarSize)
	shouldReturnFromInitialState(selectRootMaxBarSize, undefined)

	it("should return undefined in an empty chart", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectRootMaxBarSize(state))))
			return null
		}
		render(() => (
			<BarChart width={100} height={100}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, undefined)
	})
	it("should return and update maxBarSize defined on chart root", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectRootMaxBarSize(state))))
			return null
		}
		const [maxBarSize, setMaxBarSize] = createSignal(10)
		render(() => (
			<BarChart width={100} height={100} maxBarSize={maxBarSize()}>
				<Bar maxBarSize={5} />
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, 10)

		setMaxBarSize(20)

		expectLastCalledWith(spy, 20)
	})
})
describe("selectBarGap", () => {
	shouldReturnUndefinedOutOfContext(selectBarGap)
	shouldReturnFromInitialState(selectBarGap, 4)

	it("should return default value in a chart without barGap prop", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectBarGap(state))))
			return null
		}
		render(() => (
			<BarChart width={100} height={100}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, 4)
	})
	it("should return and update barGap defined on chart root", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectBarGap(state))))
			return null
		}
		const [barGap, setBarGap] = createSignal(10)
		render(() => (
			<BarChart width={100} height={100} barGap={barGap()}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, 10)

		setBarGap(20)

		expectLastCalledWith(spy, 20)
	})
})
describe("selectBarCategoryGap", () => {
	shouldReturnUndefinedOutOfContext(selectBarCategoryGap)
	shouldReturnFromInitialState(selectBarCategoryGap, "10%")

	it("should return undefined when called outside of Redux context", () => {
		expect.assertions(1)
		const Comp = (): null => {
			const result = useAppSelectorWithStableTest((state) => selectBarCategoryGap(state))
			expect(result).toBe(undefined)
			return null
		}
		render(() => <Comp />)
	})
	it("should return default value for initial state", () => {
		const [store, setStore] = createRechartsStore()
		expect(selectBarCategoryGap(store)).toBe("10%")
	})
	it("should return default value in an empty chart", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectBarCategoryGap(state))))
			return null
		}
		render(() => (
			<BarChart width={100} height={100}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, "10%")
	})
	it("should return and update barCategoryGap defined on chart root", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectBarCategoryGap(state))))
			return null
		}
		const [gap, setGap] = createSignal<number | string>(10)
		render(() => (
			<BarChart width={100} height={100} barCategoryGap={gap()}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, 10)

		setGap(20)

		expectLastCalledWith(spy, 20)
	})
})
describe("selectRootBarSize", () => {
	shouldReturnUndefinedOutOfContext(selectRootBarSize)
	shouldReturnFromInitialState(selectRootBarSize, undefined)

	it("should return undefined in an empty chart", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectRootBarSize(state))))
			return null
		}
		render(() => (
			<BarChart width={100} height={100}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, undefined)
	})
	it("should return and update barSize defined on chart root", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest((state) => selectRootBarSize(state))))
			return null
		}
		const [size, setSize] = createSignal<number | string>(10)
		render(() => (
			<BarChart width={100} height={100} barSize={size()}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, 10)

		setSize(20)

		expectLastCalledWith(spy, 20)
	})
})
describe("selectSyncMethod", () => {
	it(`should return "index" by default`, () => {
		const [store, setStore] = createRechartsStore()
		expect(store.rootProps.syncMethod).toBe("index")
	})
	it("should return and update syncMethod defined on chart root", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => spy(useAppSelectorWithStableTest(selectSyncMethod)))
			return null
		}
		const fn = () => 1
		const [method, setMethod] = createSignal<"value" | "index" | typeof fn>("value")
		render(() => (
			<BarChart width={100} height={100} syncMethod={method()}>
				<Customized component={Comp} />
			</BarChart>
		))
		expectLastCalledWith(spy, "value")

		setMethod(() => fn)

		expectLastCalledWith(spy, fn)
	})
})
