import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { createEffect } from "solid-js"
import { useAppDispatch, useAppSelector } from "../helper/legacyDispatch"
import { RechartsStoreProvider } from "../../src/state/RechartsStoreProvider"
import { setChartData } from "../../src/state/chartDataSlice"

describe("useAppSelector", () => {
	it("should return undefined when used outside of Redux context", () => {
		expect.assertions(1)
		const Spy = (): null => {
			const state = useAppSelector((s) => s)
			expect(state).toBe(undefined)
			return null
		}
		render(() => <Spy />)
	})

	it("should not throw an error when used outside of Redux context", () => {
		const Spy = (): null => {
			useAppSelector((s) => s)
			return null
		}
		expect(() => render(() => <Spy />)).not.toThrow()
	})

	it("should return state when inside a Redux context", () => {
		expect.assertions(1)
		const Spy = (): null => {
			const state = useAppSelector((s) => s)
			expect(state).not.toBe(undefined)
			return null
		}
		render(() => (
			<RechartsStoreProvider>
				<Spy />
			</RechartsStoreProvider>
		))
	})

	it("should trigger update after an action changes the state", () => {
		/* Solid's reactivity is via signals/createEffect, not re-rendering the component.
		   Mirror the original Redux contract by tracking state inside an effect: first run
		   sees `chartData == null`, dispatch flips it, the effect re-fires with the new
		   value. Both assertions land off a single tracked read. */
		expect.assertions(2)
		const Spy = (): null => {
			const state = useAppSelector((s) => s)
			const dispatch = useAppDispatch()
			let dispatched = false
			createEffect(() => {
				const data = state?.chartData.chartData
				if (!dispatched) {
					expect(data).toBe(undefined)
					dispatched = true
					dispatch(setChartData([]))
					return
				}
				expect(data).toEqual([])
			})
			return null
		}
		render(() => (
			<RechartsStoreProvider>
				<Spy />
			</RechartsStoreProvider>
		))
	})
})

describe("useAppDispatch", () => {
	const dummyAction = { type: "dummy" }
	it("should do nothing when called outside of Redux context", () => {
		expect.assertions(1)
		const Dispatcher = (): null => {
			const dispatch = useAppDispatch()
			dispatch(dummyAction)
			return null
		}
		expect(() => render(() => <Dispatcher />)).not.toThrow()
	})

	it("should dispatch action thunks against the store when inside a Solid chart context", () => {
		/* Original test exercised react-redux's `subscribe` notification fan-out;
		   Solid's createStore has no global subscribe — reactivity is per-property.
		   Equivalent contract: the dispatched thunk runs against the live setStore,
		   visible side-effects land on the store. */
		expect.assertions(1)
		const calls: Array<unknown> = []
		const Dispatcher = (): null => {
			const dispatch = useAppDispatch()
			dispatch((setStore) => {
				calls.push("ran")
				setStore("chartData", "chartData", [])
			})
			return null
		}
		render(() => (
			<RechartsStoreProvider>
				<Dispatcher />
			</RechartsStoreProvider>
		))
		expect(calls).toHaveLength(1)
	})
})
