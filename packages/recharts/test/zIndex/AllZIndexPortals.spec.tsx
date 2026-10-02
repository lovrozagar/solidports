import { describe, expect, it, vi } from "vitest"
import { flush } from "solid-js"
import { render } from "../helper/render"
import { AllZIndexPortals } from "../../src/zIndex/ZIndexPortal"
import { createRechartsStore } from "../../src/state/store"
import { RechartsStoreContext } from "../../src/state/RechartsStoreContext"
import { createActions } from "../../src/state/actions"
import { createEventHandlers } from "../../src/state/events"
import { selectAllRegisteredZIndexes } from "../../src/zIndex/zIndexSelectors"
import { DefaultZIndexes } from "../../src/zIndex/DefaultZIndexes"
import { isNotNil } from "../../src/util/DataUtils"

describe("AllZIndexPortals", () => {
	it("should add z-index portal when z-index consumer is registered", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const events = createEventHandlers(store, setStore, actions)

		const { container } = render(() => (
			<svg>
				<RechartsStoreContext value={{ actions, events, setStore, store }}>
					<AllZIndexPortals isPanorama={false}>child</AllZIndexPortals>
				</RechartsStoreContext>
			</svg>
		))

		const allZIndexes = selectAllRegisteredZIndexes(store)

		const newZIndexDefinitelyNotOneOfTheDefaults =
			Object.values(DefaultZIndexes).reduce(
				(acc, val) => Math.max(acc, val),
				Number.NEGATIVE_INFINITY,
			) + 1

		expect(container.querySelectorAll('g[tabindex="-1"]')).toHaveLength(allZIndexes.length)

		actions.registerZIndexPortal({ zIndex: newZIndexDefinitelyNotOneOfTheDefaults })
		flush()
		vi.advanceTimersByTime(0)
		flush()

		const zIndexPortals = container.querySelectorAll('g[tabindex="-1"]')
		expect(zIndexPortals).toHaveLength(allZIndexes.length + 1)
	})
	it("should render one child for each of the registered elements", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		const events = createEventHandlers(store, setStore, actions)

		const { container } = render(() => (
			<svg>
				<RechartsStoreContext value={{ actions, events, setStore, store }}>
					<AllZIndexPortals isPanorama={false}>
						<div data-testid="child">child</div>
					</AllZIndexPortals>
				</RechartsStoreContext>
			</svg>
		))

		const renderedElements = Array.from(container.querySelectorAll('g[tabindex="-1"]'))
		const storedElementIds = Object.values(store.zIndex.zIndexMap)
			.map((entry) => entry.element?.id)
			.filter(isNotNil)

		expect(renderedElements).toHaveLength(storedElementIds.length)

		renderedElements.forEach((el) => {
			expect(storedElementIds).toContain(el.id)
		})
	})
})
