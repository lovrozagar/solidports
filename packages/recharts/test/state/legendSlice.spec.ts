import { describe, it, expect } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../src/state/store"
import { createActions } from "../../src/state/actions"
import type { LegendPayload } from "../../src/component/DefaultLegendContent"

describe("legendSlice", () => {
	it("should add and remove legend payload from state", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		expect(store.legend.payload).toHaveLength(0)

		const payload1: ReadonlyArray<LegendPayload> = [{ dataKey: "key", value: "value" }]
		const payload2: ReadonlyArray<LegendPayload> = [{ dataKey: "key", value: "value" }]
		actions.addLegendPayload(payload1)
		flush()
		expect(store.legend.payload).toHaveLength(1)

		actions.addLegendPayload(payload2)
		flush()
		expect(store.legend.payload).toHaveLength(2)

		actions.removeLegendPayload(payload1)
		flush()
		expect(store.legend.payload).toHaveLength(1)

		actions.removeLegendPayload(payload2)
		flush()
		expect(store.legend.payload).toHaveLength(0)

		actions.removeLegendPayload(payload1)
		flush()
		expect(store.legend.payload).toHaveLength(0)
	})
})
