import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSignal, useContext, createContext } from "solid-js"
import { render } from "@solidjs/testing-library"
import { Line, LineChart } from "../../src"
import { selectChartHeight } from "../../src/state/selectors/containerSelectors"
import { useAppSelector } from "../helper/legacyDispatch"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"

/**
 * This test verifies that Recharts chart works independently when
 * a parent app has its own Solid context/store, analogous to the
 * original Redux nesting test.
 */

type ExampleState = { counter: { value: number } }

const ExampleContext = createContext<{
	state: () => ExampleState
	increment: () => void
	reset: () => void
}>()

function createExampleStore() {
	const [value, setValue] = createSignal(0)
	return {
		increment: () => setValue((v) => v + 1),
		reset: () => setValue(0),
		state: () => ({ counter: { value: value() } }),
	}
}

const exampleStore = createExampleStore()

const Counter = () => {
	const ctx = useContext(ExampleContext)
	const count = () => ctx?.state().counter.value ?? 0
	return <div>Current count is: {count()}</div>
}

/* hoisted from beforeEach. */
const AppNeighbour = (props: { spy?: (arg: number) => unknown }) => {
	const Comp = (): null => {
		const chartHeight = useAppSelector(selectChartHeight)
		if (chartHeight == null) {
			throw new Error("Expected chart height")
		}
		props.spy?.(chartHeight)
		return null
	}
	return (
		<ExampleContext.Provider value={exampleStore}>
			<LineChart width={200} height={100}>
				<Line dataKey="value" />
				<Comp />
			</LineChart>
			{/* Custom app with custom state, next to Recharts chart */}
			<Counter />
		</ExampleContext.Provider>
	)
}

describe("when a Recharts chart is used in another app as a neighbour", () => {
	beforeEach(() => {
		exampleStore.reset()
	})
	it("should allow selecting data from recharts store", () => {
		const spy = vi.fn()
		render(() => <AppNeighbour spy={spy} />)
		expect(spy).toHaveBeenCalledTimes(1)
		expectLastCalledWith(spy, 100)
	})
	it("should allow selecting data from the parent app store", () => {
		const { container } = render(() => <AppNeighbour />)
		expect(exampleStore.state()).toEqual({ counter: { value: 0 } })
		expect(container).toHaveTextContent("Current count is: 0")

		exampleStore.increment()

		expect(exampleStore.state()).toEqual({ counter: { value: 1 } })
		expect(container).toHaveTextContent("Current count is: 1")
	})
})

const AppParent = (props: { spy?: (arg: number) => unknown }) => {
	const Comp = (): null => {
		const chartHeight = useAppSelector(selectChartHeight)
		if (chartHeight == null) {
			throw new Error("Expected chart height")
		}
		props.spy?.(chartHeight)
		return null
	}
	return (
		<ExampleContext.Provider value={exampleStore}>
			<LineChart width={200} height={100}>
				<Line dataKey="value" />
				<Comp />
				{/*
				 * Custom app with custom state, _inside_ the Recharts chart.
				 * This should work too - Recharts uses its own context independently.
				 */}
				<Counter />
			</LineChart>
		</ExampleContext.Provider>
	)
}

describe("when a Recharts chart is used in another app as a parent", () => {
	beforeEach(() => {
		exampleStore.reset()
	})
	it("should allow selecting data from recharts store", () => {
		const spy = vi.fn()
		render(() => <AppParent spy={spy} />)
		expect(spy).toHaveBeenCalledTimes(1)
		expectLastCalledWith(spy, 100)
	})
	it("should allow selecting data from the parent app store", () => {
		const { container } = render(() => <AppParent />)
		expect(exampleStore.state()).toEqual({ counter: { value: 0 } })
		expect(container).toHaveTextContent("Current count is: 0")

		exampleStore.increment()

		expect(exampleStore.state()).toEqual({ counter: { value: 1 } })
		expect(container).toHaveTextContent("Current count is: 1")
	})
})
